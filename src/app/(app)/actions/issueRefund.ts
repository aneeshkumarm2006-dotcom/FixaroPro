"use server";

import { db } from "@/db";
import { stripe } from "@/lib/stripe";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { queueAndSendRefund } from "@/lib/email";
import { applyStrike } from "@/lib/strikes";
import { STRIKE_REFUND_FRACTION } from "@/lib/strikes-constants";
import { depositCollected, getBillingConfig } from "@/lib/billing";
import { logAudit } from "@/lib/audit";

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
      include: {
        client: { select: { email: true, name: true } },
        cleaners: { select: { id: true } },
      },
    });
    if (!job) return { success: false, error: "Job not found" };

    const totalCharged = job.price ?? 0;
    // Amount collected at booking: a materials deposit, the painting $119
    // materials charge, or otherwise the base booking deposit. Read from the
    // shared config helper (NOT a hardcoded 20) so this cap can't drift from
    // what /api/stripe/charge-deposit actually captured — once the base deposit
    // was made admin-editable, a literal 20 here rejected a legitimate
    // config-sized deposit refund (and would over-refund if it were lowered).
    const depositAmount = depositCollected(job, await getBillingConfig());
    const alreadyRefunded = job.refundedAmount ?? 0;

    // Pick the Stripe PI to refund against and the matching ceiling.
    // Prefer the full charge if it exists; otherwise fall back to the deposit.
    let targetPI: string | null = null;
    let cap: number;
    let isDepositRefund = false;
    if (job.stripePaymentIntentId) {
      targetPI = job.stripePaymentIntentId;
      cap = totalCharged - alreadyRefunded;
    } else if (job.depositPaymentIntentId) {
      targetPI = job.depositPaymentIntentId;
      cap = depositAmount - alreadyRefunded;
      isDepositRefund = true;
    } else {
      cap = totalCharged - alreadyRefunded; // manual / cash-only refund record
    }

    const refundableRemaining = Math.max(0, cap);
    if (input.amount > refundableRemaining + 0.001) {
      return {
        success: false,
        error: `Cannot refund more than $${refundableRemaining.toFixed(2)} (already refunded $${alreadyRefunded.toFixed(2)})`,
      };
    }

    let stripeRefundId: string | null = null;
    if (targetPI) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: targetPI,
          amount: Math.round(input.amount * 100),
          reason: "requested_by_customer",
          metadata: {
            jobId: job.id,
            jobNumber: String(job.jobNumber),
            kind: isDepositRefund ? "deposit" : "charge",
          },
        });
        stripeRefundId = refund.id;
      } catch (stripeErr: any) {
        const msg = stripeErr?.raw?.message ?? stripeErr?.message ?? "Stripe refund failed";
        return { success: false, error: `Stripe error: ${msg}` };
      }
    }

    const refundLabel = isDepositRefund ? "Stripe refund (deposit)" : "Stripe refund";
    const description = stripeRefundId
      ? `${refundLabel} — Job #${job.jobNumber} (refund: ${stripeRefundId})`
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

    // Central audit trail (SOP §9/§12): every card refund records actor +
    // old/new refunded total + reason. This is the money-out chokepoint every
    // refund path (JobDetailView, refundJobDeposit, adjustMaterialsDeposit,
    // painting reject) routes through, so logging here means the /audit page —
    // whose header advertises "refunds" — actually shows them.
    logAudit({
      entityType: "Job",
      entityId: input.jobId,
      action: "REFUND_ISSUED",
      field: "refundedAmount",
      oldValue: String(alreadyRefunded),
      newValue: String(alreadyRefunded + input.amount),
      reason: input.reason?.trim() || null,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      description: `Refund of $${input.amount.toFixed(2)} issued on job #${job.jobNumber}${
        stripeRefundId ? ` (Stripe: ${stripeRefundId})` : ""
      }.`,
    });

    // Three-strike accountability: a refund of half or more of the job price
    // strikes each assigned cleaner (deduped per job + reason).
    if (totalCharged > 0 && input.amount >= STRIKE_REFUND_FRACTION * totalCharged) {
      const cleanerIds = new Set<string>();
      if (job.employeeId) cleanerIds.add(job.employeeId);
      for (const c of job.cleaners) cleanerIds.add(c.id);
      for (const cleanerId of cleanerIds) {
        await applyStrike({
          cleanerId,
          jobId: input.jobId,
          reason: "REFUND_ISSUED",
          note: `Refund of $${input.amount.toFixed(2)} on job #${job.jobNumber} (${Math.round(
            (input.amount / totalCharged) * 100
          )}% of price).`,
          actionBy: session.user.id,
        }).catch((e) => console.error("refund strike", e));
      }
    }

    revalidatePath(`/jobs/${input.jobId}`);
    revalidatePath("/jobs");
    revalidatePath("/finances");

    return { success: true, refundedTotal: alreadyRefunded + input.amount };
  } catch (error) {
    console.error("Error issuing refund:", error);
    return { success: false, error: "Failed to issue refund" };
  }
}
