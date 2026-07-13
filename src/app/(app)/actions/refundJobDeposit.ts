"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { issueRefund } from "./issueRefund";
import { depositCollected, getBillingConfig } from "@/lib/billing";

// One-click "refund deposit" for the admin cancellation-review panel (decision
// D0.6 / TODO 4.1). The deposit refund is intentionally NOT automatic inside
// requestCancellation — it stays an ops-reviewable step. This action refunds
// whatever was collected at booking (a materials deposit, the painting $119
// materials charge, or the $20 base deposit) via the shared issueRefund flow
// (Stripe refund + transaction + jobLog + customer email) and additionally
// records the movement in the central AuditLog. Idempotent: re-clicking after a
// full deposit refund is a no-op guarded on refundedAmount.
export async function refundJobDeposit(jobId: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (role !== "OWNER" && role !== "ADMIN") {
      return { success: false, error: "Not authorized" };
    }
    if (!jobId) return { success: false, error: "Missing jobId" };

    const job = await db.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        jobNumber: true,
        depositPaid: true,
        materialsType: true,
        materialsAmount: true,
        refundedAmount: true,
      },
    });
    if (!job) return { success: false, error: "Booking not found" };
    if (!job.depositPaid) {
      return {
        success: false,
        error: "No deposit was collected for this booking.",
      };
    }

    const collected = depositCollected(job, await getBillingConfig());
    const alreadyRefunded = job.refundedAmount ?? 0;
    const remaining = collected - alreadyRefunded;
    if (remaining <= 0.001) {
      return { success: false, error: "The deposit has already been refunded." };
    }

    // Reuse the audited, capped, Stripe-backed refund path (also fires the
    // customer refund email and records the transaction).
    const refund = await issueRefund({
      jobId,
      amount: remaining,
      reason: "Deposit refunded on cancellation",
    });
    if (!refund.success) {
      return { success: false, error: refund.error ?? "Refund failed" };
    }

    // The refund itself is audit-logged centrally inside issueRefund
    // (action REFUND_ISSUED, with actor + old/new refunded total + this reason),
    // so the deposit refund appears on the /audit page without a duplicate row.

    revalidatePath("/requests");
    revalidatePath(`/jobs/${jobId}`);
    return { success: true, amount: remaining };
  } catch (error) {
    console.error("Error refunding deposit:", error);
    return { success: false, error: "Failed to refund deposit" };
  }
}
