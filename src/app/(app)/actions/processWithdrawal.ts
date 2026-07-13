"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import type { WithdrawalStatus } from "@prisma/client";

type Action = "APPROVE" | "REJECT" | "COMPLETE";

export async function processWithdrawal(
  withdrawalId: string,
  action: Action,
  notes?: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "OWNER") {
    return { success: false, error: "Not authorized" };
  }

  try {
    const withdrawal = await db.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      return { success: false, error: "Withdrawal not found" };
    }

    let nextStatus: WithdrawalStatus;
    switch (action) {
      case "APPROVE":
        if (withdrawal.status !== "PENDING") {
          return {
            success: false,
            error: "Only pending withdrawals can be approved",
          };
        }
        nextStatus = "APPROVED";
        break;
      case "REJECT":
        if (withdrawal.status !== "PENDING" && withdrawal.status !== "APPROVED") {
          return {
            success: false,
            error: "This withdrawal cannot be rejected",
          };
        }
        nextStatus = "REJECTED";
        break;
      case "COMPLETE":
        if (withdrawal.status !== "APPROVED" && withdrawal.status !== "PENDING") {
          return {
            success: false,
            error: "Only pending or approved withdrawals can be completed",
          };
        }
        nextStatus = "COMPLETED";
        break;
      default:
        return { success: false, error: "Invalid action" };
    }

    const updated = await db.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: nextStatus,
        processedAt:
          nextStatus === "COMPLETED" || nextStatus === "REJECTED"
            ? new Date()
            : withdrawal.processedAt,
        notes: notes?.trim() ? notes.trim() : withdrawal.notes,
      },
    });

    // Audit the withdrawal decision (SOP §9/§12) — records WHICH admin released
    // or rejected the provider cash-out, the status change, and the amount.
    logAudit({
      entityType: "Withdrawal",
      entityId: withdrawalId,
      action: `WITHDRAWAL_${action}`,
      field: "status",
      oldValue: withdrawal.status,
      newValue: nextStatus,
      reason: notes?.trim() || null,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      description: `Withdrawal of $${withdrawal.amount.toFixed(2)} for provider ${withdrawal.employeeId}: ${withdrawal.status} → ${nextStatus}.`,
    });

    revalidatePath("/my-pay");
    revalidatePath("/withdrawals");

    return { success: true, withdrawal: updated };
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return { success: false, error: "Failed to process withdrawal" };
  }
}
