"use server";

/**
 * "On my way" + arrival tracking (Phase 2 item A).
 *
 * Two explicit provider taps, both stamped server-side:
 *
 *   markOnMyWay(jobId)  -> Job.onMyWayAt  + customer SMS + admin notification
 *   markArrived(jobId)  -> Job.arrivedAt  + punctuality (lateArrivalAt / cap)
 *
 * ARRIVAL IS INDEPENDENT OF CLOCK-IN. `arrivedAt` is the moment the Pro says
 * they are on site, which is what punctuality should be measured against —
 * clock-in can happen minutes later (parking, greeting the customer, finding
 * the unit). If the Pro never taps "I've arrived", `backfillArrivalFromClockIn`
 * stamps `arrivedAt` from `clockInTime` so the record is never empty.
 *
 * Both mutations are idempotent by construction: they claim the job with a
 * conditional `updateMany` (`where: { <field>: null }`), so a double tap or a
 * duplicated POST updates zero rows and short-circuits before any send.
 */

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAdminRole } from "@/lib/role-routing";
import { computeLateArrivalRatingCap } from "@/lib/policy";
import { getRuntimeConfig } from "@/lib/config/service-config";
import { smsOnTheWay, smsAdminOnTheWay } from "@/lib/sms";

type ActionResult<T = Record<string, unknown>> =
  | ({ success: true } & T)
  | { success: false; error: string };

/** Generic client-facing failure. Detail stays in the server log. */
const GENERIC = "Could not update this job right now.";

/**
 * Authorization: server-derived identity only. The caller must be the assigned
 * employee, one of the assigned Pros on the job, or an admin-role user.
 * Anything else — no session, unknown job, unassigned Pro — fails closed.
 */
async function authorizeJobActor(jobId: string) {
  if (typeof jobId !== "string" || jobId.length === 0 || jobId.length > 64) {
    return { ok: false as const, error: GENERIC };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false as const, error: "Not authenticated" };

  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      jobNumber: true,
      clientName: true,
      employeeId: true,
      startTime: true,
      clockInTime: true,
      onMyWayAt: true,
      arrivedAt: true,
      cleaners: { select: { id: true } },
      client: { select: { phone: true } },
    },
  });

  // Do not distinguish "no such job" from "not yours" to the client.
  if (!job) return { ok: false as const, error: "Job not found" };

  const userId = session.user.id;
  const isAdmin = isAdminRole((session.user as { role?: string }).role);
  const isAssigned =
    job.employeeId === userId || job.cleaners.some((c) => c.id === userId);

  if (!isAdmin && !isAssigned) {
    return { ok: false as const, error: "You are not assigned to this job" };
  }

  return { ok: true as const, job, user: session.user };
}

/* ---------------------------------------------------------------------- */
/* 1. On my way                                                            */
/* ---------------------------------------------------------------------- */

export async function markOnMyWay(
  jobId: string
): Promise<ActionResult<{ onMyWayAt: string; alreadySent?: true }>> {
  const authz = await authorizeJobActor(jobId);
  if (!authz.ok) return { success: false, error: authz.error };

  const { job, user } = authz;

  try {
    const now = new Date();

    // Atomic claim — the `onMyWayAt: null` predicate is the idempotency guard.
    // A second tap (or a replayed POST) matches zero rows and sends nothing.
    const claimed = await db.job.updateMany({
      where: { id: job.id, onMyWayAt: null },
      data: { onMyWayAt: now },
    });

    if (claimed.count === 0) {
      return {
        success: true,
        onMyWayAt: (job.onMyWayAt ?? now).toISOString(),
        alreadySent: true,
      };
    }

    const proName = user.name ?? "Your Fixaro Pro";
    const { policy } = await getRuntimeConfig();
    const etaMin = policy.onTheWayEtaMin;

    await db.jobLog.create({
      data: {
        jobId: job.id,
        userId: user.id,
        action: "NOTE_ADDED",
        description: `${proName} is on the way (ETA ~${etaMin} min).`,
      },
    });

    // Customer SMS. sendSms internally honours the `cust.booking.on_the_way`
    // catalog toggle, so an opted-out customer is skipped without branching.
    if (job.client?.phone) {
      smsOnTheWay({
        to: job.client.phone,
        proName,
        etaMin,
      }).catch((e) => console.error("on-my-way customer sms", e));
    }

    // Admin notification — the existing `admin.clock.on_the_way` key.
    // In-app ops alert always; SMS only if an admin enabled that channel.
    await db.alert
      .create({
        data: {
          type: "GENERAL",
          severity: "INFO",
          title: `Pro on the way — #${job.jobNumber}`,
          message: `${proName} is on the way to ${job.clientName} (booking #${job.jobNumber}), ETA ~${etaMin} min.`,
          relatedId: job.id,
          relatedType: "Job",
        },
      })
      .catch((e) => console.error("on-my-way admin alert", e));

    const admins = await db.user.findMany({
      where: { role: { in: ["OWNER", "ADMIN", "OPS_MANAGER", "FIELD_LEAD"] } },
      select: { phone: true },
    });
    for (const admin of admins) {
      if (!admin.phone) continue;
      smsAdminOnTheWay({
        to: admin.phone,
        proName,
        jobNumber: job.jobNumber,
        etaMin,
      }).catch((e) => console.error("on-my-way admin sms", e));
    }

    revalidatePath("/my-jobs");
    revalidatePath(`/my-jobs/${job.id}`);
    revalidatePath(`/my-jobs/${job.id}/clock`);
    revalidatePath(`/jobs/${job.id}`);

    return { success: true, onMyWayAt: now.toISOString() };
  } catch (error) {
    console.error("markOnMyWay failed", { jobId, error });
    return { success: false, error: GENERIC };
  }
}

/* ---------------------------------------------------------------------- */
/* 2. Arrived                                                              */
/* ---------------------------------------------------------------------- */

export async function markArrived(
  jobId: string
): Promise<
  ActionResult<{
    arrivedAt: string;
    minutesLate: number;
    ratingCap: number | null;
    alreadyArrived?: true;
  }>
> {
  const authz = await authorizeJobActor(jobId);
  if (!authz.ok) return { success: false, error: authz.error };

  const { job, user } = authz;

  try {
    const now = new Date();

    // Same convention clockIn.ts uses: whole minutes past scheduled start,
    // floored at 0 (early arrival is never negative-late).
    const minutesLate = Math.max(
      0,
      Math.floor((now.getTime() - job.startTime.getTime()) / 60_000)
    );
    const { policy } = await getRuntimeConfig();
    const ratingCap = computeLateArrivalRatingCap(minutesLate, policy);

    // Atomic claim on `arrivedAt: null` — idempotent double tap.
    const claimed = await db.job.updateMany({
      where: { id: job.id, arrivedAt: null },
      data: {
        arrivedAt: now,
        ...(ratingCap !== null
          ? { lateArrivalAt: now, lateArrivalRatingCap: ratingCap }
          : {}),
      },
    });

    if (claimed.count === 0) {
      return {
        success: true,
        arrivedAt: (job.arrivedAt ?? now).toISOString(),
        minutesLate: 0,
        ratingCap: null,
        alreadyArrived: true,
      };
    }

    await db.jobLog.create({
      data: {
        jobId: job.id,
        userId: user.id,
        action: "NOTE_ADDED",
        description:
          ratingCap !== null
            ? `Arrived on site ${minutesLate} min after scheduled start. Rating cap for this job set to ${ratingCap} stars.`
            : `Arrived on site${minutesLate > 0 ? ` (${minutesLate} min after scheduled start, within grace)` : " on time"}.`,
      },
    });

    revalidatePath("/my-jobs");
    revalidatePath(`/my-jobs/${job.id}`);
    revalidatePath(`/my-jobs/${job.id}/clock`);
    revalidatePath(`/jobs/${job.id}`);

    return { success: true, arrivedAt: now.toISOString(), minutesLate, ratingCap };
  } catch (error) {
    console.error("markArrived failed", { jobId, error });
    return { success: false, error: GENERIC };
  }
}

/* ---------------------------------------------------------------------- */
/* 3. Fallback: never leave arrivedAt empty                                */
/* ---------------------------------------------------------------------- */

/**
 * Backfill `arrivedAt` from `clockInTime` for a Pro who clocked in without
 * ever tapping "I've arrived". Called from the clock page after a successful
 * clock-in so the arrival record is never empty. Purely a backfill: it only
 * writes when `arrivedAt` is still null, so an explicit tap always wins and
 * punctuality is never rewritten by the later clock-in timestamp.
 */
export async function backfillArrivalFromClockIn(
  jobId: string
): Promise<ActionResult<{ backfilled: boolean }>> {
  const authz = await authorizeJobActor(jobId);
  if (!authz.ok) return { success: false, error: authz.error };

  const { job } = authz;

  try {
    if (!job.clockInTime) return { success: true, backfilled: false };

    const claimed = await db.job.updateMany({
      where: { id: job.id, arrivedAt: null },
      data: { arrivedAt: job.clockInTime },
    });

    return { success: true, backfilled: claimed.count > 0 };
  } catch (error) {
    console.error("backfillArrivalFromClockIn failed", { jobId, error });
    return { success: false, error: GENERIC };
  }
}
