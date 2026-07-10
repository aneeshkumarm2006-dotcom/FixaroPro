"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { rejectPaintingAndRefund } from "@/lib/painting-workflow";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

interface Input {
  jobId: string;
  /** What happened on the call. Required — SOP §6 says log the call attempt. */
  reason: string;
}

// SOP §6 / §11 — "No phone answer → cancel appointment".
//
// A painting final offer that goes unanswered inside 24h is flagged for a phone
// follow-up (cron sets `followUpFlaggedAt`). If ops calls and nobody answers,
// they cancel here: the booking is cancelled and the captured $119 flat
// materials/equipment charge is refunded, per the painting rules.
//
// The call attempt, the cancellation reason and the refund status are all
// recorded — the doc requires "Log call attempt, cancellation reason, and
// refund status."
export async function cancelPaintingNoAnswer(input: Input) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }
    if (!input.reason?.trim()) {
      return { success: false, error: "A reason is required (log the call attempt)" };
    }

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: { id: true, jobNumber: true, jobType: true, paintingStatus: true },
    });
    if (!job || job.jobType !== "PAINTING") {
      return { success: false, error: "Not a painting job" };
    }
    if (job.paintingStatus !== "OFFER_SENT") {
      return {
        success: false,
        error: "Only an offer still awaiting a client response can be cancelled this way.",
      };
    }

    const result = await rejectPaintingAndRefund(job.id, {
      reason: `No phone answer before the job. ${input.reason.trim()}`,
      cancelledBy: session.user.id,
    });
    if (!result.success) {
      return { success: false, error: result.error ?? "Failed to cancel and refund" };
    }

    await logAudit({
      entityType: "Job",
      entityId: job.id,
      action: "PAINTING_CANCELLED_NO_ANSWER",
      description: `Ops phoned the client with no answer inside 24h. Booking #${job.jobNumber} cancelled; $${result.refunded.toFixed(2)} materials/equipment charge refunded.`,
      field: "paintingStatus",
      oldValue: "OFFER_SENT",
      newValue: "REJECTED",
      reason: input.reason.trim(),
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidatePath(`/jobs/${job.id}`);
    revalidatePath("/jobs");
    return { success: true, refunded: result.refunded };
  } catch (error) {
    console.error("cancelPaintingNoAnswer error:", error);
    return { success: false, error: "Failed to cancel the appointment" };
  }
}
