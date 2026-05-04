"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { PaymentType } from "@prisma/client";

interface RequestWithdrawalInput {
  amount: number;
  paymentMethod: PaymentType;
  notes?: string;
}

type WithdrawalResult =
  | { success: true; withdrawalId: string }
  | { success: false; error: string };

export async function requestWithdrawal(
  input: RequestWithdrawalInput
): Promise<WithdrawalResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const userId = session.user.id;
  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Amount must be greater than zero" };
  }

  try {
    const [payouts, withdrawals] = await Promise.all([
      db.payout.findMany({
        where: { employeeId: userId },
        include: { payPeriod: true },
      }),
      db.withdrawal.findMany({
        where: { employeeId: userId },
      }),
    ]);

    const paidTotal = payouts
      .filter((p) => p.payPeriod.status === "PAID")
      .reduce((sum, p) => sum + p.finalAmount, 0);

    const reservedTotal = withdrawals
      .filter(
        (w) =>
          w.status === "PENDING" ||
          w.status === "APPROVED" ||
          w.status === "COMPLETED"
      )
      .reduce((sum, w) => sum + w.amount, 0);

    const available = paidTotal - reservedTotal;

    if (amount > available + 0.001) {
      return {
        success: false,
        error: `Amount exceeds available balance ($${available.toFixed(2)})`,
      };
    }

    const withdrawal = await db.withdrawal.create({
      data: {
        employeeId: userId,
        amount,
        paymentMethod: input.paymentMethod,
        status: "PENDING",
        notes: input.notes?.trim() || null,
      },
    });

    await db.alert.create({
      data: {
        type: "GENERAL",
        severity: "INFO",
        title: "Withdrawal request",
        message: `${session.user.name} requested a withdrawal of $${amount.toFixed(2)} via ${input.paymentMethod}`,
        relatedId: withdrawal.id,
        relatedType: "Withdrawal",
      },
    });

    revalidatePath("/my-pay");

    return { success: true, withdrawalId: withdrawal.id };
  } catch (error) {
    console.error("Error requesting withdrawal:", error);
    return { success: false, error: "Failed to request withdrawal" };
  }
}
