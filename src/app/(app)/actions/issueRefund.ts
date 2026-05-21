"use server";

import { db } from "@/db";
import { stripe } from "@/lib/stripe";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { queueAndSendRefund } from "@/lib/email";

interface IssueRefundInput {
  jobId: string;
  amount: number;
  reason?: string;
}

export async function issueRefund(input: IssueRefundInput) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (role !== "OWNER" && role !== "ADMIN") {
      return { success: false, error: "Not authorized" };
    }
    if (!input.jobId) return { success: false, error: "Missing jobId" };
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { success: false, error: "Refund amount must be positive" };
    }

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      include: { client: { select: { email: true, name: true } } },
    });
    if (!job) return { success: false, error: "Job not found" };

    const totalCharged = job.price ?? 0;
    const alreadyRefunded = job.refundedAmount ?? 0;
    const refundableRemaining = Math.max(0, totalCharged - alreadyRefunded);

    if (input.amount > refundableRemaining + 0.001) {
      return {
        success: false,
        error: `Cannot refund more than $${refundableRemaining.toFixed(2)} (already refunded $${alreadyRefunded.toFixed(2)})`,
      };
    }

    let stripeRefundId: string | null = null;

    // If this job was paid via Stripe, issue the refund through Stripe too
    if (job.stripePaymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: job.stripePaymentIntentId,
          amount: Math.round(input.amount * 100),
          reason: "requested_by_customer",
          metadata: { jobId: job.id, jobNumber: String(job.jobNumber) },
        });
        stripeRefundId = refund.id;
      } catch (stripeErr: any) {
        const msg = stripeErr?.raw?.message ?? stripeErr?.message ?? "Stripe refund failed";
        return { success: false, error: `Stripe error: ${msg}` };
      }
    }

    const description = stripeRefundId
      ? `Stripe refund — Job #${job.jobNumber} (refund: ${stripeRefundId})`
      : `Refund — Job #${job.jobNumber}`;

    await db.$transaction([
      db.job.update({
        where: { id: input.jobId },
        data: { refundedAmount: alreadyRefunded + input.amount },
      }),
      db.transaction.create({
        data: {
          date: new Date(),
          category: "REVENUE",
          amount: -input.amount,
          description,
          notes: input.reason?.trim() || null,
          jobId: input.jobId,
          source: "refund",
          isAuto: true,
        },
      }),
      db.jobLog.create({
        data: {
          jobId: input.jobId,
          userId: session.user.id,
          action: "UPDATED",
          field: "refundedAmount",
          oldValue: String(alreadyRefunded),
          newValue: String(alreadyRefunded + input.amount),
          description: `Refund of $${input.amount.toFixed(2)} issued${input.reason ? `: ${input.reason}` : ""}${stripeRefundId ? ` (Stripe: ${stripeRefundId})` : ""}`,
        },
      }),
      ...(job.client?.email
        ? [
            db.emailLog.create({
              data: {
                kind: "REFUND" as const,
                recipient: job.client.email,
                subject: `Refund processed — Job #${job.jobNumber}`,
                status: "PENDING" as const,
                jobId: input.jobId,
              },
            }),
          ]
        : []),
    ]);

    queueAndSendRefund(input.jobId, input.amount, input.reason).catch(() => {});

    revalidatePath(`/jobs/${input.jobId}`);
    revalidatePath("/jobs");
    revalidatePath("/finances");

    return { success: true, refundedTotal: alreadyRefunded + input.amount };
  } catch (error) {
    console.error("Error issuing refund:", error);
    return { success: false, error: "Failed to issue refund" };
  }
}
