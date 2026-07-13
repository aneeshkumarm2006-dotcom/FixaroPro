"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

function parseFloatSafe(v: FormDataEntryValue | null): number {
  if (v === null || v === "") return 0;
  const n = parseFloat(v as string);
  return Number.isFinite(n) ? n : 0;
}

export async function updatePayout(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "OWNER") {
    return { error: "Forbidden" };
  }

  const id = formData.get("id") as string;
  if (!id) return { error: "Payout id is required" };

  try {
    const payout = await db.payout.findUnique({
      where: { id },
      include: { payPeriod: true },
    });
    if (!payout) return { error: "Payout not found" };
    if (payout.payPeriod.status === "PAID") {
      return { error: "Cannot edit a paid payout" };
    }

    const baseAmount = parseFloatSafe(formData.get("baseAmount"));
    const adjustments = parseFloatSafe(formData.get("adjustments"));
    const deductions = parseFloatSafe(formData.get("deductions"));
    const reimbursements = parseFloatSafe(formData.get("reimbursements"));
    const notes = (formData.get("notes") as string) || null;

    const finalAmount = baseAmount + adjustments - deductions + reimbursements;

    const newFinal = Number(finalAmount.toFixed(2));
    await db.payout.update({
      where: { id },
      data: {
        baseAmount,
        adjustments,
        deductions,
        reimbursements,
        finalAmount: newFinal,
        notes,
      },
    });

    // Audit the payout edit (SOP §9/§12 — provider pay is a high-impact money
    // change). Records who changed it and the old→new final amount + components.
    logAudit({
      entityType: "Payout",
      entityId: id,
      action: "PAYOUT_UPDATED",
      field: "finalAmount",
      oldValue: String(payout.finalAmount),
      newValue: String(newFinal),
      reason: notes,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      description: `Payout for period ${payout.payPeriodId}: final $${payout.finalAmount.toFixed(
        2
      )} → $${newFinal.toFixed(2)} (base ${baseAmount}, adj ${adjustments}, ded ${deductions}, reimb ${reimbursements}).`,
    });

    revalidatePath("/payouts");
    revalidatePath(`/payouts/${payout.payPeriodId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating payout:", error);
    return { error: "Failed to update payout" };
  }
}
