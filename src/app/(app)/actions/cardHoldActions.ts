"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { stripe, STATEMENT_DESCRIPTOR_SUFFIX } from "@/lib/stripe";
import {
  sendCustomerHoldPlaced,
  sendCustomerHoldReleased,
  sendCustomerHoldCaptureFailed,
} from "@/lib/email";

interface AdminGate {
  ok: true;
  userId: string;
}
interface AdminDeny {
  ok: false;
  error: string;
}

async function adminGate(): Promise<AdminGate | AdminDeny> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  const role = (session.user as { role?: string }).role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { ok: false, error: "Not authorized" };
  }
  return { ok: true, userId: session.user.id };
}

/**
 * Place a manual-capture PaymentIntent for the full job price. The card
 * is authorized but NOT charged. Capture happens on job completion via
 * `captureCardHold`. If the booking cancels, call `releaseCardHold`.
 */
export async function placeCardHold(jobId: string) {
  const gate = await adminGate();
  if (!gate.ok) return { success: false, error: gate.error };

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { client: true },
  });
  if (!job) return { success: false, error: "Job not found" };
  if (job.holdPaymentIntentId) {
    return { success: false, error: "Hold already placed for this booking" };
  }
  if (job.paymentReceived) {
    return { success: false, error: "Booking is already paid" };
  }
  const client = job.client;
  if (!client?.stripeCustomerId || !client?.defaultPaymentMethodId) {
    return { success: false, error: "No saved card on file for this client" };
  }

  // job.price is already net of any discount (booking-pricing folds discount
  // into the subtotal), so do NOT subtract it again. For an hourly job placed
  // before clock-out this authorizes the booked estimate; capture is later
  // capped at this authorization (see captureCardHold).
  const amount = Math.max(0, job.price ?? 0);
  if (amount <= 0) return { success: false, error: "Invalid hold amount" };
  const amountCents = Math.round(amount * 100);

  try {
    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "cad",
      customer: client.stripeCustomerId,
      payment_method: client.defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      capture_method: "manual",
      statement_descriptor_suffix: STATEMENT_DESCRIPTOR_SUFFIX,
      description: `Fixaro Handyman — authorization hold, job #${job.jobNumber}`,
      metadata: { jobId, jobNumber: String(job.jobNumber), kind: "hold" },
    });

    await db.$transaction([
      db.job.update({
        where: { id: jobId },
        data: {
          holdPaymentIntentId: pi.id,
          holdPlacedAt: new Date(),
          holdAmount: amount,
        },
      }),
      db.jobLog.create({
        data: {
          jobId,
          userId: gate.userId,
          action: "NOTE_ADDED",
          description: `Card hold placed for $${amount.toFixed(2)} (PI: ${pi.id}).`,
        },
      }),
    ]);

    if (client.email) {
      sendCustomerHoldPlaced({
        to: client.email,
        clientName: client.name,
        jobNumber: job.jobNumber,
        amountUsd: amount,
      }).catch((e) => console.error("hold-placed email", e));
    }

    revalidatePath(`/jobs/${jobId}`);
    return { success: true, paymentIntentId: pi.id, amount };
  } catch (err) {
    const reason =
      (err as { raw?: { message?: string }; message?: string })?.raw?.message ??
      (err as { message?: string })?.message ??
      "Hold failed";
    return { success: false, error: reason };
  }
}

/**
 * Capture the hold (job complete, take the money). Marks the job paid
 * and writes a Transaction row. On failure, emails the customer.
 */
export async function captureCardHold(jobId: string) {
  const gate = await adminGate();
  if (!gate.ok) return { success: false, error: gate.error };

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { client: true },
  });
  if (!job) return { success: false, error: "Job not found" };
  if (!job.holdPaymentIntentId) {
    return { success: false, error: "No hold on this booking" };
  }
  if (job.holdCapturedAt) {
    return { success: false, error: "Already captured" };
  }
  if (job.holdReleasedAt) {
    return { success: false, error: "Hold was already released" };
  }

  // Capture the amount actually owed (job.price is authoritative — for hourly
  // jobs clock-out rewrites it to the clocked total), but never more than the
  // authorized hold (Stripe caps amount_to_capture at the authorization). job.price
  // is already net of discount, so it is not subtracted again.
  // NOTE: unlike chargeJob, this path does NOT credit a deposit collected at
  // booking, so a deposit-paid job settled via hold-capture would over-collect by
  // the deposit. These hold actions are currently unwired (no caller); wire the
  // deposit-credit logic from chargeJob before exposing them in the UI.
  const owed = Math.max(0, job.price ?? 0);
  const authorized = job.holdAmount ?? owed;
  const amount = Math.min(owed, authorized);
  const amountCents = Math.round(amount * 100);

  try {
    const pi = await stripe.paymentIntents.capture(job.holdPaymentIntentId, {
      amount_to_capture: amountCents,
    });
    const now = new Date();
    await db.$transaction([
      db.job.update({
        where: { id: jobId },
        data: {
          holdCapturedAt: now,
          paymentReceived: true,
          paidAt: now,
          stripePaymentIntentId: pi.id,
        },
      }),
      db.transaction.create({
        data: {
          date: now,
          category: "REVENUE",
          amount,
          description: `Stripe hold captured — job #${job.jobNumber}`,
          jobId,
          source: "CREDIT_CARD",
          isAuto: true,
        },
      }),
      db.jobLog.create({
        data: {
          jobId,
          userId: gate.userId,
          action: "PAYMENT_RECEIVED",
          description: `Hold captured for $${amount.toFixed(2)} (PI: ${pi.id}).`,
        },
      }),
    ]);

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/finances");
    return { success: true, amount };
  } catch (err) {
    const reason =
      (err as { raw?: { message?: string }; message?: string })?.raw?.message ??
      (err as { message?: string })?.message ??
      "Capture failed";
    await db.job.update({
      where: { id: jobId },
      data: {
        holdCaptureFailedAt: new Date(),
        holdCaptureFailReason: reason,
      },
    });
    if (job.client?.email) {
      sendCustomerHoldCaptureFailed({
        to: job.client.email,
        clientName: job.client.name,
        jobNumber: job.jobNumber,
        reason,
      }).catch((e) => console.error("capture-failed email", e));
    }
    return { success: false, error: reason };
  }
}

/**
 * Release a hold without capturing (e.g. booking canceled). Stripe
 * supports cancelling an uncaptured authorization PI to release the
 * funds back to the cardholder's bank.
 */
export async function releaseCardHold(jobId: string, reason?: string) {
  const gate = await adminGate();
  if (!gate.ok) return { success: false, error: gate.error };

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { client: true },
  });
  if (!job) return { success: false, error: "Job not found" };
  if (!job.holdPaymentIntentId) {
    return { success: false, error: "No hold on this booking" };
  }
  if (job.holdCapturedAt) {
    return { success: false, error: "Hold already captured — cannot release" };
  }
  if (job.holdReleasedAt) {
    return { success: false, error: "Already released" };
  }

  try {
    await stripe.paymentIntents.cancel(job.holdPaymentIntentId, {
      cancellation_reason: "requested_by_customer",
    });
    const now = new Date();
    await db.$transaction([
      db.job.update({
        where: { id: jobId },
        data: { holdReleasedAt: now },
      }),
      db.jobLog.create({
        data: {
          jobId,
          userId: gate.userId,
          action: "NOTE_ADDED",
          description: reason?.trim()
            ? `Card hold released (${reason.trim()}).`
            : "Card hold released.",
        },
      }),
    ]);
    if (job.client?.email) {
      sendCustomerHoldReleased({
        to: job.client.email,
        clientName: job.client.name,
        jobNumber: job.jobNumber,
      }).catch((e) => console.error("hold-released email", e));
    }
    revalidatePath(`/jobs/${jobId}`);
    return { success: true };
  } catch (err) {
    const msg =
      (err as { raw?: { message?: string }; message?: string })?.raw?.message ??
      (err as { message?: string })?.message ??
      "Release failed";
    return { success: false, error: msg };
  }
}
