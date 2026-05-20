"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { stripe } from "@/lib/stripe";
import { queueAndSendReceipt } from "@/lib/email";

export async function chargeJob(jobId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };

  const role = (session.user as any).role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { success: false, error: "Not authorized" };
  }

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { client: true },
  });

  if (!job) return { success: false, error: "Job not found" };
  if (job.paymentReceived) return { success: false, error: "Already paid" };
  if (job.isCashJob) return { success: false, error: "This is a cash job — mark payment manually" };

  const client = job.client;
  if (!client?.stripeCustomerId || !client?.defaultPaymentMethodId) {
    return { success: false, error: "No saved card on file for this client" };
  }

  const amountCents = Math.round(((job.price ?? 0) - (job.discountAmount ?? 0)) * 100);
  if (amountCents <= 0) {
    return { success: false, error: "Invalid charge amount" };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "cad",
      customer: client.stripeCustomerId,
      payment_method: client.defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      description: `Cleano job #${job.jobNumber} — ${job.jobType ?? "cleaning"}`,
      metadata: { jobId, jobNumber: String(job.jobNumber) },
    });

    await db.$transaction([
      db.job.update({
        where: { id: jobId },
        data: {
          paymentReceived: true,
          paidAt: new Date(),
          stripePaymentIntentId: paymentIntent.id,
        },
      }),
      db.transaction.create({
        data: {
          date: new Date(),
          category: "REVENUE",
          amount: amountCents / 100,
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
          description: `Charged $${(amountCents / 100).toFixed(2)} via Stripe (PI: ${paymentIntent.id})`,
        },
      }),
    ]);

    queueAndSendReceipt(jobId).catch(() => {});

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs");
    revalidatePath("/finances");

    return { success: true, amount: amountCents / 100 };
  } catch (err: any) {
    const failureReason = err?.raw?.message ?? err?.message ?? "Charge failed";

    await db.job.update({
      where: { id: jobId },
      data: {
        paymentFailedAt: new Date(),
        paymentFailureReason: failureReason,
      },
    }).catch(() => {});

    revalidatePath(`/jobs/${jobId}`);
    return { success: false, error: failureReason };
  }
}
