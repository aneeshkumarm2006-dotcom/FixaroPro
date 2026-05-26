"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { issueRefund } from "./issueRefund";

interface CancelJobInput {
  jobId: string;
  refundDeposit: boolean;
  reason?: string;
}

export async function cancelJobByAdmin(input: CancelJobInput) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (role !== "OWNER" && role !== "ADMIN") {
      return { success: false, error: "Not authorized" };
    }

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: {
        id: true,
        status: true,
        jobNumber: true,
        depositPaid: true,
        refundedAmount: true,
      },
    });
    if (!job) return { success: false, error: "Job not found" };
    if (job.status === "CANCELLED") {
      return { success: false, error: "Job is already cancelled" };
    }
    if (job.status === "COMPLETED") {
      return { success: false, error: "Cannot cancel a completed job" };
    }

    await db.$transaction([
      db.job.update({
        where: { id: input.jobId },
        data: { status: "CANCELLED", cancellationRequestedAt: null },
      }),
      db.jobLog.create({
        data: {
          jobId: input.jobId,
          userId: session.user.id,
          action: "STATUS_CHANGED",
          field: "status",
          newValue: "CANCELLED",
          description: `Job cancelled by admin${input.reason ? `: ${input.reason}` : ""}`,
        },
      }),
    ]);

    // Optionally refund the $20 deposit (capped at remaining deposit balance).
    let refund: { success: boolean; error?: string } | null = null;
    if (input.refundDeposit && job.depositPaid) {
      const remaining = 20 - (job.refundedAmount ?? 0);
      if (remaining > 0.001) {
        refund = await issueRefund({
          jobId: input.jobId,
          amount: remaining,
          reason: input.reason ?? "Booking cancelled",
        });
      }
    }

    revalidatePath(`/jobs/${input.jobId}`);
    revalidatePath("/jobs");
    return { success: true, refund };
  } catch (err) {
    console.error("cancelJobByAdmin error:", err);
    return { success: false, error: "Failed to cancel job" };
  }
}
