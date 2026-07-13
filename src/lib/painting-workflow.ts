// Painting bid workflow engine (SOP §6). Server-only — imported by server
// actions and cron routes.
//
// Lifecycle:  QUOTED → BIDDING → OFFER_SENT → ACCEPTED / REJECTED / CANCELLED
//   • On booking submit: status BIDDING, painting-eligible providers notified.
//   • Providers place bids (one active bid each).
//   • Bidding closes (admin action or cron window) → the LOWEST valid bid is
//     auto-selected by the software, 35% surplus applied, client offer sent.
//   • Client accepts (confirm) or rejects (cancel + refund/remove the $119
//     materials/equipment charge).
//
// Provider override is independent of price (tracker decision D3): swapping the
// attached provider keeps the client's agreed final price and does NOT re-send
// the offer — see overridePaintingProvider in the admin action.

import { db } from "@/db";
import { stripe } from "@/lib/stripe";
import { isUpfrontMaterials } from "@/app/(book)/book/types";
import { paintingFinalAmount } from "@/lib/painting";
import { getEligibleProviderIdsFor } from "@/lib/eligibility";
import { sendCustomerPaintingOffer, sendCustomerPaintingRejected } from "@/lib/email";
import { smsPaintingOffer } from "@/lib/sms";

// How long bidding stays open before the cron auto-closes it and sends the
// lowest-bid offer (measured from booking submission). Admin can close sooner.
export const PAINTING_BID_WINDOW_HOURS = 24;

/**
 * Providers eligible to bid on / be notified about a painting job (SOP §6/§8):
 * field providers with an active admin-approved PAINTING eligibility row.
 *
 * Note: with no PAINTING eligibility set, this returns [] — by design, painting
 * stays dormant until an admin approves at least one provider.
 */
export async function getPaintingEligibleProviderIds(): Promise<string[]> {
  const approvedIds = await getEligibleProviderIdsFor("PAINTING");
  if (approvedIds.length === 0) return [];
  const providers = await db.user.findMany({
    where: { id: { in: approvedIds }, role: { in: ["EMPLOYEE", "FIELD_LEAD"] } },
    select: { id: true },
  });
  return providers.map((p) => p.id);
}

/** Notify painting-eligible providers of a new painting job to bid on. */
export async function notifyPaintingProviders(jobId: string): Promise<number> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { id: true, jobNumber: true, location: true, paintingScope: true },
  });
  if (!job) return 0;

  const providerIds = await getPaintingEligibleProviderIds();
  if (providerIds.length === 0) return 0;

  await db.alert.createMany({
    data: providerIds.map((uid) => ({
      type: "GENERAL" as const,
      severity: "INFO" as const,
      title: "New painting job — open for bids",
      message: `Painting booking #${job.jobNumber}${job.location ? ` · ${job.location}` : ""} is open for bids. Submit your lowest bid to win the job.`,
      relatedId: job.id,
      relatedType: "painting_bid",
      recipientUserId: uid,
    })),
  });
  return providerIds.length;
}

interface CloseBiddingResult {
  sent: boolean;
  reason?: "not_bidding" | "no_bids" | "not_found";
  finalAmount?: number;
  winningBidId?: string;
}

/**
 * Close bidding on a painting job: the software auto-selects the LOWEST valid
 * bid (earliest wins ties), applies the 35% surplus, assigns the winning
 * provider, and sends the client the final offer. Idempotent — only acts while
 * the job is in BIDDING.
 */
export async function closeBiddingAndSendOffer(
  jobId: string
): Promise<CloseBiddingResult> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      client: { select: { email: true, phone: true } },
      paintingBids: { where: { isValid: true } },
    },
  });
  if (!job) return { sent: false, reason: "not_found" };
  if (job.paintingStatus !== "BIDDING") return { sent: false, reason: "not_bidding" };
  if (job.paintingBids.length === 0) return { sent: false, reason: "no_bids" };

  // Lowest valid bid wins; earliest bid breaks ties.
  const winner = [...job.paintingBids].sort(
    (a, b) => a.amount - b.amount || a.createdAt.getTime() - b.createdAt.getTime()
  )[0];

  const surplus = job.paintingSurplusRate ?? 1.35;
  const finalAmount = paintingFinalAmount(winner.amount, surplus);

  await db.$transaction([
    // Mark the winning bid; clear any stale winner flags on this job.
    db.paintingBid.updateMany({
      where: { jobId: job.id },
      data: { isWinning: false, autoAcceptedAt: null },
    }),
    db.paintingBid.update({
      where: { id: winner.id },
      data: { isWinning: true, autoAcceptedAt: new Date() },
    }),
    db.job.update({
      where: { id: job.id },
      data: {
        paintingStatus: "OFFER_SENT",
        acceptedBidId: winner.id,
        acceptedBidAmount: winner.amount,
        paintingFinalAmount: finalAmount,
        offerSentAt: new Date(),
        // Assign the auto-accepted lowest bidder as the provider (admin may
        // override later without changing the client-agreed price).
        employeeId: winner.bidderId,
      },
    }),
    db.jobLog.create({
      data: {
        jobId: job.id,
        action: "UPDATED",
        field: "paintingStatus",
        newValue: "OFFER_SENT",
        description: `Lowest bid auto-accepted ($${winner.amount.toFixed(2)}). Final offer $${finalAmount.toFixed(2)} (×${surplus}) sent to client.`,
      },
    }),
  ]);

  // Final amount goes out on all available channels (Appendix-A Q4): email,
  // SMS, and the in-app portal (the offer panel the client sees on login).
  if (job.client?.email) {
    await sendCustomerPaintingOffer({
      to: job.client.email,
      clientName: job.clientName,
      jobId: job.id,
      jobNumber: job.jobNumber,
      finalAmount,
    }).catch((err) => console.error("painting offer email failed", err));
  }
  if (job.client?.phone) {
    smsPaintingOffer({
      to: job.client.phone,
      jobNumber: job.jobNumber,
      finalAmount,
    }).catch((err) => console.error("painting offer SMS failed", err));
  }

  return { sent: true, finalAmount, winningBidId: winner.id };
}

/**
 * Refund the painting $119 materials/equipment charge and cancel the booking (SOP §6 — client
 * rejects the final offer, or ops cancels when the client can't be reached).
 * System-initiated (no admin session). Idempotent via `materialsRefundedAt`.
 */
export async function rejectPaintingAndRefund(
  jobId: string,
  opts: { reason: string; cancelledBy?: string }
): Promise<{ success: boolean; refunded: number; error?: string }> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { client: { select: { email: true } } },
  });
  if (!job) return { success: false, refunded: 0, error: "Job not found" };
  if (job.materialsRefundedAt) {
    return { success: true, refunded: 0 }; // already refunded
  }

  // Amount collected at booking: the painting $119 flat materials/equipment
  // charge when one applied, otherwise the $20 base deposit.
  const depositAmount =
    isUpfrontMaterials(job.materialsType) && job.materialsAmount
      ? job.materialsAmount
      : job.depositPaid
      ? 20
      : 0;

  let stripeRefundId: string | null = null;
  if (job.depositPaymentIntentId && depositAmount > 0) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: job.depositPaymentIntentId,
        amount: Math.round(depositAmount * 100),
        reason: "requested_by_customer",
        metadata: { jobId: job.id, jobNumber: String(job.jobNumber), kind: "painting_deposit" },
      });
      stripeRefundId = refund.id;
    } catch (err: any) {
      const msg = err?.raw?.message ?? err?.message ?? "Stripe refund failed";
      return { success: false, refunded: 0, error: `Stripe error: ${msg}` };
    }
  }

  await db.$transaction([
    db.job.update({
      where: { id: job.id },
      data: {
        paintingStatus: "REJECTED",
        offerResponse: "REJECTED",
        offerRespondedAt: new Date(),
        status: "CANCELLED",
        materialsRefundedAt: new Date(),
        refundedAmount: (job.refundedAmount ?? 0) + depositAmount,
      },
    }),
    ...(depositAmount > 0
      ? [
          db.transaction.create({
            data: {
              date: new Date(),
              category: "REVENUE" as const,
              amount: -depositAmount,
              description: `Painting materials/equipment charge refund — Job #${job.jobNumber}${stripeRefundId ? ` (Stripe: ${stripeRefundId})` : ""}`,
              notes: opts.reason,
              jobId: job.id,
              source: "refund",
              isAuto: true,
            },
          }),
        ]
      : []),
    db.jobLog.create({
      data: {
        jobId: job.id,
        userId: opts.cancelledBy ?? null,
        action: "STATUS_CHANGED",
        field: "paintingStatus",
        newValue: "REJECTED",
        description: `Painting offer rejected — booking cancelled, $${depositAmount.toFixed(2)} materials/equipment charge refunded. ${opts.reason}`,
      },
    }),
  ]);

  if (job.client?.email) {
    await sendCustomerPaintingRejected({
      to: job.client.email,
      clientName: job.clientName,
      jobId: job.id,
      jobNumber: job.jobNumber,
      refundAmount: depositAmount,
    }).catch((err) => console.error("painting rejected email failed", err));
  }

  return { success: true, refunded: depositAmount };
}

/** Send a daily reminder while a painting offer awaits a response (SOP §6). */
export async function sendPaintingOfferReminder(jobId: string): Promise<boolean> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { client: { select: { email: true } } },
  });
  if (!job || job.paintingStatus !== "OFFER_SENT" || !job.paintingFinalAmount) return false;
  if (!job.client?.email) return false;

  await sendCustomerPaintingOffer({
    to: job.client.email,
    clientName: job.clientName,
    jobId: job.id,
    jobNumber: job.jobNumber,
    finalAmount: job.paintingFinalAmount,
    reminder: true,
  });
  await db.job.update({
    where: { id: job.id },
    data: { offerLastReminderAt: new Date() },
  });
  return true;
}
