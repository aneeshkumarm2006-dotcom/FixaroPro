"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

// Phone outcomes for the <24h painting follow-up (SOP §6/§11). "Reached" and
// "voicemail" record the attempt WITHOUT cancelling — the only prior way to log
// a call outcome was cancelPaintingNoAnswer, which forces a cancellation.
export type CallOutcome = "REACHED" | "NO_ANSWER" | "VOICEMAIL";

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  REACHED: "Reached client",
  NO_ANSWER: "No answer",
  VOICEMAIL: "Left voicemail",
};

interface Input {
  jobId: string;
  outcome: CallOutcome;
  /** Free-text notes on the call. Optional. */
  notes?: string;
}

// Lightweight "log call attempt" for the admin painting panel. Records the
// attempt time, outcome and notes to JobLog so ops can track their follow-up
// calls without being forced to cancel the appointment.
export async function logPaintingCallAttempt(input: Input) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }
    if (!input.outcome || !OUTCOME_LABEL[input.outcome]) {
      return { success: false, error: "Select a call outcome" };
    }

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: { id: true, jobNumber: true, jobType: true },
    });
    if (!job || job.jobType !== "PAINTING") {
      return { success: false, error: "Not a painting job" };
    }

    const when = new Date();
    const notes = input.notes?.trim();
    const description = `Follow-up call ${when.toLocaleString()} — ${OUTCOME_LABEL[input.outcome]}${notes ? `: ${notes}` : ""}`;

    await db.jobLog.create({
      data: {
        jobId: job.id,
        userId: session.user.id,
        action: "NOTE_ADDED",
        field: "paintingFollowUpCall",
        newValue: OUTCOME_LABEL[input.outcome],
        description,
      },
    });

    revalidatePath(`/jobs/${job.id}`);
    revalidatePath("/jobs");
    return { success: true };
  } catch (error) {
    console.error("logPaintingCallAttempt error:", error);
    return { success: false, error: "Failed to log the call attempt" };
  }
}
