"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

// Handyman bought equipment for a job and submits the receipt/details to ops
// for compensation (SOP §8 — "buy equipment and send receipt/details to ops").
// Raises an admin alert and an audit record so ops can review and reimburse.
export async function requestEquipmentReimbursement(input: {
  jobId?: string;
  description: string;
  amount: number;
  receiptUrl?: string;
}) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (role === "CLIENT") return { success: false, error: "Not authorized" };

    if (!input.description?.trim()) return { success: false, error: "Describe what you bought" };
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { success: false, error: "Enter a valid amount" };
    }

    let jobNumber: number | null = null;
    if (input.jobId) {
      const job = await db.job.findUnique({
        where: { id: input.jobId },
        select: { jobNumber: true },
      });
      jobNumber = job?.jobNumber ?? null;
    }

    const admins = await db.user.findMany({
      where: { role: { in: ["OWNER", "ADMIN", "OPS_MANAGER"] } },
      select: { id: true },
    });
    const ref = jobNumber ? ` (job #${jobNumber})` : "";
    await db.alert.createMany({
      data: admins.map((a) => ({
        type: "GENERAL" as const,
        severity: "INFO" as const,
        title: "Equipment reimbursement request",
        message: `${session.user.name} requests $${input.amount.toFixed(2)} for equipment${ref}: ${input.description.trim()}${input.receiptUrl ? ` — receipt: ${input.receiptUrl}` : ""}`,
        relatedId: input.jobId ?? null,
        relatedType: "equipment_reimbursement",
        recipientUserId: a.id,
      })),
    });

    await logAudit({
      entityType: "EquipmentReimbursement",
      entityId: input.jobId ?? session.user.id,
      action: "REIMBURSEMENT_REQUESTED",
      newValue: String(input.amount),
      reason: input.description.trim(),
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      description: `Equipment reimbursement requested: $${input.amount.toFixed(2)}${ref}.`,
    });

    if (input.jobId) revalidatePath(`/my-jobs/${input.jobId}`);
    return { success: true };
  } catch (error) {
    console.error("Error requesting reimbursement:", error);
    return { success: false, error: "Failed to submit request" };
  }
}
