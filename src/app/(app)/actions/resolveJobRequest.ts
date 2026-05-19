"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

type RequestKind = "cancellation" | "reschedule";
type Decision = "approve" | "deny";

export async function resolveJobRequest(input: {
  jobId: string;
  kind: RequestKind;
  decision: Decision;
  note?: string;
}) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (role !== "OWNER" && role !== "ADMIN") {
      return { success: false, error: "Not authorized" };
    }

    const job = await db.job.findUnique({ where: { id: input.jobId } });
    if (!job) return { success: false, error: "Job not found" };

    // Clear the request flag, optionally update status, and log the decision.
    const updates: Record<string, unknown> = {};
    if (input.kind === "cancellation") {
      updates.cancellationRequestedAt = null;
      if (input.decision === "approve") updates.status = "CANCELLED";
    } else {
      updates.rescheduleRequestedAt = null;
    }

    const desc =
      input.kind === "cancellation"
        ? input.decision === "approve"
          ? "Cancellation approved — job cancelled"
          : "Cancellation request denied"
        : input.decision === "approve"
        ? "Reschedule approved — admin will follow up to set a new time"
        : "Reschedule request denied";

    await db.$transaction([
      db.job.update({ where: { id: input.jobId }, data: updates }),
      db.jobLog.create({
        data: {
          jobId: input.jobId,
          userId: session.user.id,
          action: "NOTE_ADDED",
          description: input.note?.trim()
            ? `${desc} · ${input.note.trim()}`
            : desc,
        },
      }),
    ]);

    revalidatePath("/requests");
    revalidatePath(`/jobs/${input.jobId}`);
    return { success: true };
  } catch (error) {
    console.error("Error resolving job request:", error);
    return { success: false, error: "Failed to resolve request" };
  }
}
