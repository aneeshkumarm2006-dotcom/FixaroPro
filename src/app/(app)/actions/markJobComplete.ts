"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ensureRatingRequest } from "@/lib/rating";
import { logAudit } from "@/lib/audit";
import { checkAfterPhotoGate } from "@/lib/after-photo-gate";

/**
 * Admin "mark complete" from the job detail view (SOP §9).
 *
 * The provider-facing equivalent is completeJobAsProvider (SOP §8); clock-out
 * is the normal path for both. This one exists for ops closing out a job the
 * crew never closed themselves.
 *
 * NB: this previously checked only that a session existed — any signed-in user,
 * including a CLIENT, could complete any job by id. It is now admin-only and
 * audit-logged, like every other high-impact status change.
 */
export async function markJobComplete(
  jobId: string,
  // Escape hatch for ops closing out a job whose crew never uploaded the
  // completion photo. NOT settable by the crew (this action is admin-only),
  // requires a written reason, and is recorded in the audit log below.
  options?: { skipPhotoGate?: boolean; photoGateReason?: string }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { error: "Not authenticated" };

  const role = (session.user as { role?: string }).role;
  const isAdmin = role === "OWNER" || role === "ADMIN" || role === "OPS_MANAGER";
  if (!isAdmin) return { error: "Not authorized" };

  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      jobNumber: true,
      afterPhotoConsent: true,
      afterPhotoOverrideAt: true,
    },
  });
  if (!job) return { error: "Job not found" };

  if (job.status === "CANCELLED") return { error: "This job was cancelled." };
  if (job.status === "COMPLETED" || job.status === "PAID") {
    // Idempotent: already closed, nothing to gate or re-log.
    return { success: true };
  }

  // Completion-photo gate (Fix #3c / #8b) — enforced for ops too. The bypass
  // must be explicit AND justified; a bare `skipPhotoGate` with no reason is
  // refused rather than honoured (fail closed).
  const bypassReason = options?.photoGateReason?.trim();
  const bypassRequested = options?.skipPhotoGate === true;
  let photoGateNote: string | null = null;

  if (bypassRequested && !bypassReason) {
    return { error: "A reason is required to complete a job without completion photos." };
  }
  if (!bypassRequested) {
    const photoGate = await checkAfterPhotoGate(jobId, job);
    if (!photoGate.ok) return { error: photoGate.error };
    if (photoGate.waived) {
      photoGateNote =
        photoGate.reason === "ADMIN_OVERRIDE"
          ? "closed without after-photos under the admin after-photo override"
          : "closed without after-photos (customer did not consent)";
    }
  } else {
    photoGateNote = `after-photo requirement bypassed by admin — ${bypassReason}`;
  }

  const now = new Date();

  await db.job.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: now,
      completedById: session.user.id,
    },
  });

  await db.jobLog.create({
    data: {
      jobId,
      userId: session.user.id,
      action: "STATUS_CHANGED",
      field: "status",
      oldValue: job.status,
      newValue: "COMPLETED",
      description: `Status changed from ${job.status} to COMPLETED by ${session.user.name ?? "admin"}${photoGateNote ? ` — ${photoGateNote}` : ""}`,
    },
  });

  // SOP §8/§9: audit job status changes — old, new, actor, timestamp.
  await logAudit({
    entityType: "Job",
    entityId: jobId,
    action: "JOB_COMPLETED",
    field: "status",
    oldValue: job.status,
    newValue: "COMPLETED",
    reason: photoGateNote
      ? `Marked complete by admin — ${photoGateNote}`
      : "Marked complete by admin",
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    description: `${session.user.name ?? "Admin"} marked job #${job.jobNumber} complete.`,
  });

  // Mint the rating token + send the "rate us" email once (idempotent).
  await ensureRatingRequest(jobId).catch((e) =>
    console.error("ensureRatingRequest (markJobComplete)", e)
  );

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { success: true };
}
