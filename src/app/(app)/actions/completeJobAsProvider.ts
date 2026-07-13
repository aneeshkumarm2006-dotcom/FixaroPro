"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ensureRatingRequest } from "@/lib/rating";
import { logAudit } from "@/lib/audit";

const MAX_NOTES = 4000;

/**
 * Provider-facing job completion (SOP §8 "Job completion tools: notes, photos,
 * status updates, completed marker" / "Audit job status changes").
 *
 * Clock-out is the PRIMARY completion path — it already sets COMPLETED and it
 * is what produces the billable hours — so completion notes ride on it (see
 * clockOut.ts). This action covers the two cases clock-out cannot:
 *
 *   1. a job with no clock record at all (the provider never clocked in, or the
 *      service isn't clocked), which otherwise has no way for the handyman to
 *      close it out themselves;
 *   2. adding or correcting the write-up AFTER the job is already complete.
 *
 * It deliberately REFUSES to complete a job with an open clock. Marking such a
 * job COMPLETED would leave clockInTime set and clockOutTime null forever:
 * computeChargeAmount would see a broken clock, the Stage-1 charge guard would
 * block the invoice, and the provider's hours would simply evaporate. The fix
 * is to clock out, not to route around it.
 */
export async function completeJobAsProvider(input: {
  jobId: string;
  completionNotes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Not authenticated" };

    const role = (session.user as { role?: string }).role;
    if (!role || role === "CLIENT") return { success: false, error: "Not authorized" };

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      include: { cleaners: { select: { id: true } } },
    });
    if (!job) return { success: false, error: "Job not found" };

    const isAdmin = role === "OWNER" || role === "ADMIN" || role === "OPS_MANAGER";
    const isAssigned =
      job.employeeId === session.user.id ||
      job.cleaners.some((c) => c.id === session.user.id);
    if (!isAdmin && !isAssigned) {
      return { success: false, error: "You are not assigned to this job" };
    }

    if (job.status === "CANCELLED") {
      return { success: false, error: "This job was cancelled." };
    }

    // Once the client has paid, the write-up is part of the billing record.
    // Providers can't revise it after the fact; ops still can.
    if (job.status === "PAID" && !isAdmin) {
      return { success: false, error: "This job has been paid — completion notes are locked." };
    }

    // "Did the caller mean to set the notes field?" is a different question from
    // "are the notes non-empty?" — otherwise clearing your notes on an already
    // complete job is indistinguishable from a no-op, and gets rejected.
    const notesProvided = typeof input.completionNotes === "string";
    const notes = input.completionNotes?.trim() ?? "";
    if (notes.length > MAX_NOTES) {
      return { success: false, error: `Completion notes are limited to ${MAX_NOTES} characters.` };
    }

    const alreadyComplete = job.status === "COMPLETED" || job.status === "PAID";

    // An open clock must be closed by clocking out — that is what bills the job.
    if (!alreadyComplete && job.clockInTime && !job.clockOutTime) {
      return {
        success: false,
        error: "You're still clocked in. Clock out to complete this job — that's what records your billable hours.",
      };
    }

    if (alreadyComplete && !notesProvided) {
      return { success: false, error: "This job is already complete." };
    }

    const now = new Date();
    const data: {
      completionNotes?: string | null;
      status?: "COMPLETED";
      completedAt?: Date;
      completedById?: string;
    } = {};

    if (notesProvided) data.completionNotes = notes || null;
    if (!alreadyComplete) {
      data.status = "COMPLETED";
      data.completedAt = now;
      data.completedById = session.user.id;
    }

    await db.job.update({ where: { id: input.jobId }, data });

    const actor = session.user.name ?? "Provider";

    if (!alreadyComplete) {
      const noClock = !job.clockInTime;

      await db.jobLog.create({
        data: {
          jobId: input.jobId,
          userId: session.user.id,
          action: "STATUS_CHANGED",
          field: "status",
          oldValue: job.status,
          newValue: "COMPLETED",
          description: `${actor} marked this job complete${noClock ? " (no clock record — hours must be added by ops before charging)" : ""}`,
        },
      });

      // SOP §8: "Audit job status changes." Old/new/actor/timestamp.
      await logAudit({
        entityType: "Job",
        entityId: input.jobId,
        action: "JOB_COMPLETED",
        field: "status",
        oldValue: job.status,
        newValue: "COMPLETED",
        reason: noClock ? "Completed by provider with no clock record" : null,
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        description: `${actor} marked job #${job.jobNumber} complete from the provider portal.`,
      });
    }

    if (notesProvided && notes !== (job.completionNotes ?? "")) {
      const verb = !notes ? "cleared" : job.completionNotes ? "updated" : "added";
      await db.jobLog.create({
        data: {
          jobId: input.jobId,
          userId: session.user.id,
          action: "NOTE_ADDED",
          field: "completionNotes",
          description: `${actor} ${verb} completion notes`,
        },
      });
    }

    // COMPLETED now — mint the rating token + send the "rate us" email once
    // (idempotent; shares the token used by clockOut and markJobComplete).
    if (!alreadyComplete) {
      ensureRatingRequest(input.jobId).catch((e) =>
        console.error("ensureRatingRequest (completeJobAsProvider)", e)
      );
    }

    revalidatePath("/my-jobs");
    revalidatePath(`/my-jobs/${input.jobId}`);
    revalidatePath(`/jobs/${input.jobId}`);
    return { success: true };
  } catch (error) {
    console.error("Error completing job:", error);
    return { success: false, error: "Failed to complete job" };
  }
}
