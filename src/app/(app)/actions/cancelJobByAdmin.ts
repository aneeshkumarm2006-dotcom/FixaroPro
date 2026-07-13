"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { stripe } from "@/lib/stripe";
import { issueRefund } from "./issueRefund";
import {
  sendAdminBookingCanceled,
  sendCustomerBookingCancellation,
  sendProviderBookingCanceled,
  sendCustomerFeesCharged,
} from "@/lib/email";
import { isNotificationEnabled } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { getRuntimeConfig } from "@/lib/config/service-config";
import { depositCollected, getBillingConfig } from "@/lib/billing";

interface CancelJobInput {
  jobId: string;
  refundDeposit: boolean;
  reason?: string;
  // Late cancellations (< 24h) incur a $25 fee by default; admins can waive it.
  waiveCancellationFee?: boolean;
}

export async function cancelJobByAdmin(input: CancelJobInput) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (role !== "OWNER" && role !== "ADMIN") {
      return { success: false, error: "Not authorized" };
    }

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: {
        id: true,
        status: true,
        jobNumber: true,
        depositPaid: true,
        refundedAmount: true,
        clientName: true,
        startTime: true,
        location: true,
        jobType: true,
        isCashJob: true,
        materialsType: true,
        materialsAmount: true,
        cancellationFeeChargedAt: true,
        client: {
          select: {
            id: true,
            email: true,
            name: true,
            stripeCustomerId: true,
            defaultPaymentMethodId: true,
          },
        },
        cleaners: { select: { id: true, name: true, email: true } },
      },
    });
    if (!job) return { success: false, error: "Job not found" };
    if (job.status === "CANCELLED") {
      return { success: false, error: "Job is already cancelled" };
    }
    if (job.status === "COMPLETED") {
      return { success: false, error: "Cannot cancel a completed job" };
    }

    // Fee + window are admin-editable policy values, so what we charge here is
    // what the customer was shown at booking and in the cancel modal.
    const { policy } = await getRuntimeConfig();

    await db.$transaction([
      db.job.update({
        where: { id: input.jobId },
        data: { status: "CANCELLED", cancellationRequestedAt: null },
      }),
      db.jobLog.create({
        data: {
          jobId: input.jobId,
          userId: session.user.id,
          action: "STATUS_CHANGED",
          field: "status",
          newValue: "CANCELLED",
          description: `Job cancelled by admin${input.reason ? `: ${input.reason}` : ""}`,
        },
      }),
    ]);

    // Optionally refund what was collected (a materials deposit, the painting
    // $119 materials charge, or the $20 base deposit), capped at the remaining
    // balance.
    let refund: { success: boolean; error?: string } | null = null;
    if (input.refundDeposit && job.depositPaid) {
      const billingCfg = await getBillingConfig();
      const remaining = depositCollected(job, billingCfg) - (job.refundedAmount ?? 0);
      if (remaining > 0.001) {
        refund = await issueRefund({
          jobId: input.jobId,
          amount: remaining,
          reason: input.reason ?? "Booking cancelled",
        });
      }
    }

    // Late-cancellation fee (SOP §4/§10): $25 if cancelled within 24h of start.
    // Charged separately from (and alongside) any deposit refund. Off-session
    // to the saved card; idempotent via cancellationFeeChargedAt.
    let cancellationFee: { charged: boolean; amount?: number; error?: string } | null = null;
    const hoursUntilStart = (job.startTime.getTime() - Date.now()) / 3600_000;
    const isLateCancel = hoursUntilStart < policy.cancellationWindowHours;
    if (
      isLateCancel &&
      !input.waiveCancellationFee &&
      !job.isCashJob &&
      !job.cancellationFeeChargedAt &&
      job.client?.stripeCustomerId &&
      job.client?.defaultPaymentMethodId
    ) {
      try {
        const pi = await stripe.paymentIntents.create({
          amount: Math.round(policy.cancellationFee * 100),
          currency: "cad",
          customer: job.client.stripeCustomerId,
          payment_method: job.client.defaultPaymentMethodId,
          off_session: true,
          confirm: true,
          description: `Fixaro late-cancellation fee — job #${job.jobNumber}`,
          metadata: { jobId: job.id, jobNumber: String(job.jobNumber), type: "cancellation_fee" },
        });
        await db.$transaction([
          db.job.update({
            where: { id: job.id },
            data: {
              cancellationFeeChargedAt: new Date(),
              cancellationFeePaymentIntentId: pi.id,
            },
          }),
          db.transaction.create({
            data: {
              date: new Date(),
              category: "REVENUE",
              amount: policy.cancellationFee,
              description: `Late-cancellation fee — job #${job.jobNumber} (PI: ${pi.id})`,
              jobId: job.id,
              source: "CREDIT_CARD",
              isAuto: true,
            },
          }),
          db.jobLog.create({
            data: {
              jobId: job.id,
              userId: session.user.id,
              action: "PAYMENT_RECEIVED",
              field: "cancellationFee",
              newValue: String(policy.cancellationFee),
              description: `Charged $${policy.cancellationFee.toFixed(2)} late-cancellation fee (PI: ${pi.id}).`,
            },
          }),
        ]);
        cancellationFee = { charged: true, amount: policy.cancellationFee };
        logAudit({
          entityType: "Job",
          entityId: job.id,
          action: "CANCELLATION_FEE_CHARGED",
          newValue: String(policy.cancellationFee),
          reason: input.reason ?? null,
          actorId: session.user.id,
          actorEmail: session.user.email ?? null,
          description: `Late-cancellation fee $${policy.cancellationFee} charged on job #${job.jobNumber}.`,
        });
        if (job.client.email) {
          sendCustomerFeesCharged({
            to: job.client.email,
            clientName: job.client.name ?? job.clientName,
            jobId: job.id,
            jobNumber: job.jobNumber,
            feeType: "cancellation",
            amount: policy.cancellationFee,
          }).catch((e) => console.error("cancellation fee email", e));
        }
      } catch (err: any) {
        cancellationFee = { charged: false, error: err?.raw?.message ?? err?.message ?? "Fee charge failed" };
        console.error("cancellation fee charge failed", err);
      }
    }

    // Lifecycle notifications — gated by Settings → Notifications.
    const lifecycleInfo = {
      jobId: input.jobId,
      jobNumber: job.jobNumber,
      clientName: job.clientName,
      startTime: job.startTime.toISOString(),
      address: job.location ?? "",
      serviceType: job.jobType,
    };
    sendAdminBookingCanceled({
      ...lifecycleInfo,
      reason: input.reason,
      canceledBy: session.user.name ?? "Admin",
    }).catch((e) => console.error("admin cancel email", e));
    if (job.client?.email) {
      sendCustomerBookingCancellation({
        ...lifecycleInfo,
        to: job.client.email,
        reason: input.reason,
        refundIssued: !!refund && refund.success,
      }).catch((e) => console.error("customer cancel email", e));
    }
    // Notify each assigned cleaner — email + (gated) app-push alert.
    for (const c of job.cleaners) {
      if (c.email) {
        sendProviderBookingCanceled({
          to: c.email,
          providerName: c.name,
          jobId: input.jobId,
          jobNumber: job.jobNumber,
          clientName: job.clientName,
          startTime: job.startTime.toISOString(),
          address: job.location ?? "",
          serviceType: job.jobType,
          reason: input.reason ?? null,
        }).catch((e) => console.error("provider cancel email", e));
      }
      if (await isNotificationEnabled("PROVIDER", "prov.cancel.booking_canceled", "APP_PUSH")) {
        await db.alert.create({
          data: {
            type: "CANCELLATION",
            severity: "WARNING",
            title: `Booking canceled — ${job.clientName}`,
            message: `Job #${job.jobNumber} on ${job.startTime.toLocaleDateString()} was canceled by admin.`,
            recipientUserId: c.id,
            relatedId: input.jobId,
            relatedType: "Job",
          },
        }).catch(() => {});
      }
    }

    revalidatePath(`/jobs/${input.jobId}`);
    revalidatePath("/jobs");
    return { success: true, refund, cancellationFee };
  } catch (err) {
    console.error("cancelJobByAdmin error:", err);
    return { success: false, error: "Failed to cancel job" };
  }
}
