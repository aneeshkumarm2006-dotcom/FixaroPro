"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { stripe } from "@/lib/stripe";
import {
  queueAndSendReceipt,
  sendCustomerBookingCharged,
  sendCustomerCardDeclined,
  sendAdminCardDeclined,
} from "@/lib/email";

export async function chargeJob(jobId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };

  const role = (session.user as any).role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { success: false, error: "Not authorized" };
  }

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { client: true, cleaners: { select: { id: true } } },
  });

  if (!job) return { success: false, error: "Job not found" };
  if (job.paymentReceived) return { success: false, error: "Already paid" };
  if (job.isCashJob) return { success: false, error: "This is a cash job — mark payment manually" };

  // SOP §10: never charge an unassigned booking — prevents charging a card
  // before a provider is validated for the job.
  if (!job.employeeId && job.cleaners.length === 0) {
    return { success: false, error: "Cannot charge an unassigned booking — assign a provider first." };
  }

  const client = job.client;
  if (!client) return { success: false, error: "No client on this job" };

  const grossAmount = (job.price ?? 0) - (job.discountAmount ?? 0);
  if (grossAmount <= 0) {
    return { success: false, error: "Invalid charge amount" };
  }

  // Credit the deposit already collected at booking (SOP §10 — deposits are
  // applied to the final bill). For a refundable materials deposit or the
  // painting $119 materials charge the admin-applied portion credits here; any
  // unused balance is refunded via the deposit-adjust action. Otherwise the $20
  // base booking deposit credits.
  let depositCredit = 0;
  if (job.depositPaid) {
    if (job.materialsType === "deposit") {
      const collected = job.materialsAmount ?? 0;
      depositCredit = job.materialsAppliedAmount ?? Math.min(collected, grossAmount);
    } else {
      depositCredit = 20;
    }
  }
  const totalAmount = Math.max(0, grossAmount - depositCredit);
  if (totalAmount <= 0) {
    // Fully covered by the deposit already paid — settle without a new charge.
    await db.$transaction([
      db.job.update({
        where: { id: jobId },
        data: { paymentReceived: true, paidAt: new Date() },
      }),
      db.jobLog.create({
        data: {
          jobId,
          userId: session.user.id,
          action: "PAYMENT_RECEIVED",
          description: `Booking settled — covered by $${depositCredit.toFixed(2)} deposit already paid.`,
        },
      }),
    ]);
    queueAndSendReceipt(jobId).catch(() => {});
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs");
    revalidatePath("/finances");
    return { success: true, amount: grossAmount, giftCardApplied: 0, stripeCharged: 0 };
  }

  // Auto-apply gift card balance before hitting Stripe. We draw the
  // balance down to zero (or until the booking total is satisfied),
  // whichever comes first.
  const giftCardApplied = Math.min(client.giftCardBalance, totalAmount);
  const remainingDue = Math.max(0, totalAmount - giftCardApplied);
  const amountCents = Math.round(remainingDue * 100);

  // If gift card credit covers the booking entirely, skip Stripe.
  if (amountCents === 0) {
    await db.$transaction([
      db.job.update({
        where: { id: jobId },
        data: { paymentReceived: true, paidAt: new Date() },
      }),
      db.client.update({
        where: { id: client.id },
        data: { giftCardBalance: { decrement: giftCardApplied } },
      }),
      db.transaction.create({
        data: {
          date: new Date(),
          category: "REVENUE",
          amount: giftCardApplied,
          description: `Gift card credit applied — job #${job.jobNumber}`,
          jobId,
          source: "GIFT_CARD",
          isAuto: true,
        },
      }),
      db.jobLog.create({
        data: {
          jobId,
          userId: session.user.id,
          action: "PAYMENT_RECEIVED",
          description: `Booking fully covered by gift card credit ($${giftCardApplied.toFixed(2)}).`,
        },
      }),
    ]);

    queueAndSendReceipt(jobId).catch(() => {});

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs");
    revalidatePath("/finances");
    return {
      success: true,
      amount: totalAmount,
      giftCardApplied,
      stripeCharged: 0,
    };
  }

  // Stripe path is required for the remaining amount.
  if (!client.stripeCustomerId || !client.defaultPaymentMethodId) {
    return { success: false, error: "No saved card on file for this client" };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "cad",
      customer: client.stripeCustomerId,
      payment_method: client.defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      description: `Fixaro job #${job.jobNumber} — ${job.jobType ?? "service"}`,
      metadata: { jobId, jobNumber: String(job.jobNumber) },
    });

    const stripeAmount = amountCents / 100;
    await db.$transaction([
      db.job.update({
        where: { id: jobId },
        data: {
          paymentReceived: true,
          paidAt: new Date(),
          stripePaymentIntentId: paymentIntent.id,
        },
      }),
      // Decrement gift card balance if used.
      ...(giftCardApplied > 0
        ? [
            db.client.update({
              where: { id: client.id },
              data: { giftCardBalance: { decrement: giftCardApplied } },
            }),
            db.transaction.create({
              data: {
                date: new Date(),
                category: "REVENUE" as const,
                amount: giftCardApplied,
                description: `Gift card credit applied — job #${job.jobNumber}`,
                jobId,
                source: "GIFT_CARD" as const,
                isAuto: true,
              },
            }),
          ]
        : []),
      db.transaction.create({
        data: {
          date: new Date(),
          category: "REVENUE",
          amount: stripeAmount,
          description: `Stripe charge — job #${job.jobNumber}`,
          jobId,
          source: "CREDIT_CARD",
          isAuto: true,
        },
      }),
      db.jobLog.create({
        data: {
          jobId,
          userId: session.user.id,
          action: "PAYMENT_RECEIVED",
          description: giftCardApplied > 0
            ? `Charged $${stripeAmount.toFixed(2)} via Stripe + $${giftCardApplied.toFixed(2)} gift card credit (PI: ${paymentIntent.id}).`
            : `Charged $${stripeAmount.toFixed(2)} via Stripe (PI: ${paymentIntent.id}).`,
        },
      }),
    ]);

    queueAndSendReceipt(jobId).catch(() => {});

    // Customer "booking charged" notification (separate from the receipt;
    // gated by `cust.fee.booking_charged`).
    if (client.email) {
      sendCustomerBookingCharged({
        to: client.email,
        clientName: client.name,
        jobId,
        jobNumber: job.jobNumber,
        amount: stripeAmount,
        paymentMethod: "Card on file",
      }).catch((e) => console.error("customer booking-charged email", e));
    }

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs");
    revalidatePath("/finances");

    return {
      success: true,
      amount: totalAmount,
      giftCardApplied,
      stripeCharged: stripeAmount,
    };
  } catch (err: any) {
    const failureReason = err?.raw?.message ?? err?.message ?? "Charge failed";

    await db.job.update({
      where: { id: jobId },
      data: {
        paymentFailedAt: new Date(),
        paymentFailureReason: failureReason,
      },
    }).catch(() => {});

    // Notify admin + customer of the declined card (gated by toggles).
    sendAdminCardDeclined({
      jobId,
      jobNumber: job.jobNumber,
      clientName: job.clientName,
      reason: failureReason,
      amountAttempted: amountCents / 100,
      context: "charge",
    }).catch((e) => console.error("admin card-declined email", e));
    if (client.email) {
      sendCustomerCardDeclined({
        to: client.email,
        clientName: client.name,
        jobId,
        jobNumber: job.jobNumber,
        reason: failureReason,
        context: "charge",
      }).catch((e) => console.error("customer card-declined email", e));
    }

    revalidatePath(`/jobs/${jobId}`);
    return { success: false, error: failureReason };
  }
}
