"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isEligibleFor } from "@/lib/eligibility";
import {
  getEquipmentReadiness,
  getEquipmentReadinessMode,
} from "@/lib/equipment-readiness";
import { logAudit } from "@/lib/audit";
import {
  businessDateKey,
  dateKeyToStoredDate,
} from "@/lib/availability-exceptions";

export interface ClaimJobResult {
  success: boolean;
  error?: string;
  /**
   * "strict" mode: the provider is provably short a required tool and the claim
   * was refused. A dead end in the UI — they must top up their kit first.
   */
  blocked?: boolean;
  /**
   * "warn" mode: the provider is provably short a required tool. NOTHING has
   * been claimed. The UI shows `missingEquipment` and re-calls with
   * `acknowledgeMissingEquipment: true` if they want to proceed anyway — D6.1's
   * "notify anyway, warn on claim".
   */
  requiresEquipmentAck?: boolean;
  /** Tools we can positively prove they hold none of. Never untracked items. */
  missingEquipment?: string[];
}

/**
 * Claim an open job (SOP §8).
 *
 * Two independent server-side gates, in this order:
 *
 *   1. ELIGIBILITY — the admin-approved provider service matrix. This is
 *      AUTHORIZATION: a provider not approved for the service cannot claim it,
 *      full stop, and no acknowledgement can talk them past it.
 *   2. EQUIPMENT READINESS — the per-service tool checklist vs their equipment
 *      profile, under the admin's configured mode (§3.3: "Missing equipment
 *      produces a clear blocking or warning flow as configured"):
 *        off    → ignored entirely
 *        warn   → claim allowed, but only after the provider acknowledges what
 *                 they appear to be short of (DEFAULT, per D6.1)
 *        strict → claim refused
 *
 * Readiness is deliberately fail-open: it can only ever cite a tool that maps
 * to a TOOL-category product the provider holds none of, so while no product is
 * categorised TOOL it blocks nobody. See src/lib/equipment-readiness.ts.
 */
export async function claimJob(
  jobId: string,
  opts?: { acknowledgeMissingEquipment?: boolean }
): Promise<ClaimJobResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };

  const role = (session.user as { role?: string }).role;
  if (!role || role === "CLIENT") return { success: false, error: "Not authorized" };

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { cleaners: { select: { id: true } } },
  });
  if (!job) return { success: false, error: "Job not found" };

  // Painting is won by bidding, not claimed (SOP §6).
  if (job.jobType === "PAINTING") {
    return { success: false, error: "Painting jobs are won by bidding, not claiming." };
  }

  // SOP §8: provider must be admin-approved for this service type. Enforced
  // server-side so a crafted request can't bypass the UI filter.
  const eligible = await isEligibleFor(session.user.id, job.jobType);
  if (!eligible) {
    return { success: false, error: "You're not approved for this service type." };
  }

  const alreadyCleaner = job.cleaners.some((c) => c.id === session.user.id);
  if (alreadyCleaner) return { success: false, error: "You already claimed this job" };

  const currentCount = job.cleaners.length;
  if (currentCount >= job.requiredCleaners) {
    return { success: false, error: "This job is already fully staffed" };
  }

  // One-off time off (AvailabilityException) beats the recurring weekly rule: a
  // provider cannot claim a job that lands on a day they've blocked off.
  // Enforced server-side so a crafted request can't bypass the board filter.
  // Fails closed — anything but a clean "no block found" refuses the claim.
  const storedDate = dateKeyToStoredDate(businessDateKey(job.startTime));
  if (storedDate) {
    const blockedDate = await db.availabilityException.findUnique({
      where: {
        employeeId_date: { employeeId: session.user.id, date: storedDate },
      },
      select: { id: true },
    });
    if (blockedDate) {
      return {
        success: false,
        error:
          "You've marked this date as time off. Remove it from your availability before claiming this job.",
      };
    }
  }

  // SOP §8 "Missing equipment validation". Checked AFTER eligibility and
  // staffing so we never send a provider to the locker for a job they could not
  // have claimed anyway.
  const mode = await getEquipmentReadinessMode();
  let acknowledgedMissing: string[] = [];

  if (mode !== "off") {
    const readiness = await getEquipmentReadiness(job.jobType, session.user.id);

    if (!readiness.ready) {
      const missingEquipment = readiness.missing;
      const list = missingEquipment.join(", ");

      if (mode === "strict") {
        return {
          success: false,
          blocked: true,
          missingEquipment,
          error: `You're missing required equipment for this job: ${list}. Pick it up from the locker — or buy it and send ops the receipt — then claim again.`,
        };
      }

      // warn — the provider decides, but with their eyes open.
      if (!opts?.acknowledgeMissingEquipment) {
        return {
          success: false,
          requiresEquipmentAck: true,
          missingEquipment,
          error: `You appear to be missing: ${list}.`,
        };
      }
      acknowledgedMissing = missingEquipment;
    }
  }

  await db.job.update({
    where: { id: jobId },
    data: { cleaners: { connect: { id: session.user.id } } },
  });

  const shortfall =
    acknowledgedMissing.length > 0
      ? ` (acknowledged missing equipment: ${acknowledgedMissing.join(", ")})`
      : "";

  await db.jobLog.create({
    data: {
      jobId,
      userId: session.user.id,
      action: "UPDATED",
      field: "cleaners",
      description: `${session.user.name} claimed this job${shortfall}`,
    },
  });

  // Assignment is a high-impact change (SOP §9: old/new/actor/timestamp/reason).
  // The acknowledged shortfall rides along so ops can see who took a job knowing
  // they were short, and chase the locker visit.
  await logAudit({
    entityType: "Job",
    entityId: jobId,
    action: "JOB_CLAIMED",
    field: "cleaners",
    oldValue: String(currentCount),
    newValue: String(currentCount + 1),
    reason:
      acknowledgedMissing.length > 0
        ? `Missing equipment acknowledged: ${acknowledgedMissing.join(", ")}`
        : null,
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    description: `${session.user.name} claimed job #${job.jobNumber}${shortfall}.`,
  });

  revalidatePath("/available-jobs");
  revalidatePath("/my-jobs");
  return { success: true };
}
