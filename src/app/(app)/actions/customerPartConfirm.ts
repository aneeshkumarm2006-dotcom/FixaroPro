"use server";

// Phase 2C — pre-appointment confirmation that the CUSTOMER-SUPPLIED replacement
// item (the lock, the faucet, the panels…) is on site.
//
// This is the INVERSE of `Job.customerRequestsMaterials`, which means "Fixaro
// supplies the consumables and equipment" and adds a surcharge. A job can carry
// both: Fixaro brings the caulk and the tools AND the customer must still have
// bought the faucet. Nothing here touches pricing — it is purely a readiness
// stamp so dispatch knows the Pro won't arrive to a job they can't start.

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getRuntimeConfig } from "@/lib/config/service-config";
import { customerPartFor } from "@/lib/config/types";
import { rateLimit } from "@/lib/rate-limit";

export interface CustomerPartConfirmResult {
  success: boolean;
  /** ISO stamp when the confirmation is (or already was) recorded. */
  confirmedAt?: string;
  error?: string;
}

export async function customerPartConfirm(
  jobId: string
): Promise<CustomerPartConfirmResult> {
  try {
    // Allow-list the shape before it reaches the database. cuid()s are short and
    // alphanumeric; anything else is not an id we ever issued.
    if (typeof jobId !== "string" || !/^[a-z0-9]{20,40}$/i.test(jobId)) {
      return { success: false, error: "Booking not found" };
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Not authenticated" };

    const email = session.user.email?.toLowerCase();
    if (!email) return { success: false, error: "Not authorized" };

    // Bound write attempts per session. Generous enough that a customer tapping
    // twice is unaffected; the message never leaks the limit or the window.
    const limited = rateLimit(session.user.id, {
      name: "customer-part-confirm",
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return {
        success: false,
        error: "Too many requests. Please wait a moment and try again.",
      };
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        jobType: true,
        jobNumber: true,
        status: true,
        customerPartConfirmedAt: true,
        client: { select: { email: true } },
      },
    });
    // Same generic message for "no such job" and "not yours" — an enumeration
    // oracle over job ids is exactly the IDOR we're guarding against.
    if (!job) return { success: false, error: "Booking not found" };
    if (job.client?.email?.toLowerCase() !== email) {
      return { success: false, error: "Booking not found" };
    }

    // Idempotent: re-confirming is a no-op that reports the ORIGINAL stamp, so a
    // double submit or a retried request can't move the timestamp forward.
    if (job.customerPartConfirmedAt) {
      return {
        success: true,
        confirmedAt: job.customerPartConfirmedAt.toISOString(),
      };
    }

    if (
      job.status === "CANCELLED" ||
      job.status === "COMPLETED" ||
      job.status === "PAID"
    ) {
      return {
        success: false,
        error: "This booking can no longer be updated — please contact us.",
      };
    }

    // Fail closed: only stamp when the LIVE catalog says this service actually
    // needs a customer-supplied part. Without this, a crafted request could set
    // the readiness flag on any job and tell dispatch a part had arrived for a
    // service that never required one.
    const cfg = await getRuntimeConfig();
    if (!customerPartFor(cfg, job.jobType)) {
      return {
        success: false,
        error: "This booking doesn't need a part confirmation.",
      };
    }

    const now = new Date();
    // Conditional update — the `null` guard makes the write itself idempotent
    // even if two requests pass the read check concurrently.
    const written = await db.job.updateMany({
      where: { id: jobId, customerPartConfirmedAt: null },
      data: { customerPartConfirmedAt: now },
    });

    if (written.count > 0) {
      await db.jobLog.create({
        data: {
          jobId,
          userId: session.user.id,
          action: "NOTE_ADDED",
          description: "Customer confirmed the customer-supplied part is on site.",
        },
      });
    }

    revalidatePath("/portal");
    revalidatePath("/portal/bookings");
    revalidatePath(`/portal/bookings/${jobId}`);

    if (written.count === 0) {
      const fresh = await db.job.findUnique({
        where: { id: jobId },
        select: { customerPartConfirmedAt: true },
      });
      return {
        success: true,
        confirmedAt: fresh?.customerPartConfirmedAt?.toISOString() ?? now.toISOString(),
      };
    }

    return { success: true, confirmedAt: now.toISOString() };
  } catch (error) {
    // Detail stays in the server log; the client gets a generic message.
    console.error("customerPartConfirm failed", error);
    return { success: false, error: "Could not save your confirmation." };
  }
}
