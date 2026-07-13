"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { issueRefund } from "./issueRefund";
import { logAudit } from "@/lib/audit";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

interface AdjustInput {
  jobId: string;
  // How much of the collected materials deposit applies to the final bill.
  appliedAmount: number;
  // How much of the unused deposit to refund now (optional).
  refundAmount?: number;
  // Mandatory — every deposit adjustment must say why (SOP §10.5).
  reason: string;
}

// Admin reconciles a materials deposit before final charge (SOP §10): apply
// some/all to the bill and refund the unused balance. Audit-logged.
export async function adjustMaterialsDeposit(input: AdjustInput) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }

    const reason = input.reason?.trim();
    if (!reason) {
      return { success: false, error: "A reason is required for deposit adjustments" };
    }

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: {
        id: true,
        jobNumber: true,
        depositPaid: true,
        materialsType: true,
        materialsAmount: true,
        materialsAppliedAmount: true,
      },
    });
    if (!job) return { success: false, error: "Job not found" };
    if (!job.depositPaid || job.materialsType !== "deposit") {
      return { success: false, error: "No materials deposit on this job" };
    }

    const collected = job.materialsAmount ?? 0;
    const applied = Math.max(0, Math.min(input.appliedAmount, collected));
    const refundAmount = input.refundAmount ?? 0;
    if (applied + refundAmount > collected + 0.001) {
      return {
        success: false,
        error: `Applied + refunded cannot exceed the $${collected.toFixed(2)} deposit.`,
      };
    }

    await db.job.update({
      where: { id: job.id },
      data: { materialsAppliedAmount: applied },
    });

    let refund: { success: boolean; error?: string } | null = null;
    if (refundAmount > 0.001) {
      refund = await issueRefund({
        jobId: job.id,
        amount: refundAmount,
        reason,
      });
      if (refund.success) {
        await db.job.update({
          where: { id: job.id },
          data: { materialsRefundedAt: new Date() },
        });
      }
    }

    logAudit({
      entityType: "Deposit",
      entityId: job.id,
      action: "MATERIALS_DEPOSIT_ADJUSTED",
      field: "materialsAppliedAmount",
      oldValue: String(job.materialsAppliedAmount ?? 0),
      newValue: String(applied),
      reason,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      description: `Materials deposit on job #${job.jobNumber}: $${applied.toFixed(2)} applied to bill${refundAmount > 0 ? `, $${refundAmount.toFixed(2)} refunded` : ""}.`,
    });

    revalidatePath(`/jobs/${job.id}`);
    return { success: true, applied, refund };
  } catch (error) {
    console.error("Error adjusting materials deposit:", error);
    return { success: false, error: "Failed to adjust deposit" };
  }
}
