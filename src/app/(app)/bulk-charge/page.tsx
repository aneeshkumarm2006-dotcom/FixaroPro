import { requireAdmin } from "@/lib/page-guards";
import { db } from "@/db";
import { computeJobBilling, getLabourRate } from "@/lib/billing";
import BulkChargeClient from "./BulkChargeClient";

// Mirrors the deposit-credit math in actions/chargeJob.ts (lines ~42-65)
// exactly, so the amount ops review here is the amount the card is actually
// charged (SOP §10.3). Any divergence from computeJobBilling's SOP review
// figure is surfaced as a per-row flag instead of silently hidden.
function chargeJobMirror(job: {
  price: number | null;
  discountAmount: number | null;
  depositPaid: boolean;
  materialsType: string | null;
  materialsAmount: number | null;
  materialsAppliedAmount: number | null;
}) {
  const gross = (job.price ?? 0) - (job.discountAmount ?? 0);
  let depositCredit = 0;
  if (job.depositPaid) {
    if (job.materialsType === "deposit") {
      const collected = job.materialsAmount ?? 0;
      depositCredit = job.materialsAppliedAmount ?? Math.min(collected, gross);
    } else if (job.materialsType === "charge") {
      depositCredit = Math.min(job.materialsAmount ?? 0, gross);
    } else {
      depositCredit = 20;
    }
  }
  const amountDue = Math.max(0, gross - depositCredit);
  return { gross, depositCredit, amountDue };
}

export default async function BulkChargePage() {
  await requireAdmin();

  const labourRate = await getLabourRate();

  const jobs = await db.job.findMany({
    where: {
      paymentReceived: false,
      status: "COMPLETED",
      isCashJob: false,
    },
    orderBy: { clockOutTime: "desc" },
    select: {
      id: true,
      jobNumber: true,
      clientName: true,
      jobType: true,
      price: true,
      discountAmount: true,
      subtotalAmount: true,
      gstAmount: true,
      qstAmount: true,
      clockInTime: true,
      clockOutTime: true,
      depositPaid: true,
      materialsAmount: true,
      materialsType: true,
      materialsAppliedAmount: true,
      materialsRefundedAt: true,
      cancellationFeeChargedAt: true,
      refundedAmount: true,
      client: {
        select: {
          defaultPaymentMethodId: true,
          stripeCustomerId: true,
          giftCardBalance: true,
        },
      },
    },
  });

  const rows = jobs.map((j) => {
    const billing = computeJobBilling(j, labourRate);
    const charge = chargeJobMirror(j);
    return {
      id: j.id,
      jobNumber: j.jobNumber,
      clientName: j.clientName,
      jobType: j.jobType,
      completedAt: j.clockOutTime?.toISOString() ?? null,
      hasCardOnFile: Boolean(
        j.client?.defaultPaymentMethodId && j.client?.stripeCustomerId
      ),
      giftCardBalance: j.client?.giftCardBalance ?? 0,
      // Charge review (SOP §10.3): itemized breakdown, reviewed before charging.
      clockInAt: j.clockInTime?.toISOString() ?? null,
      clockOutAt: j.clockOutTime?.toISOString() ?? null,
      billing: {
        hoursWorked: billing.hoursWorked,
        labourRate: billing.labourRate,
        labourFromClock: billing.labourFromClock,
        materialsAmount: billing.materialsAmount,
        materialsType: billing.materialsType,
        materialsRefunded: billing.materialsRefunded,
        depositCollected: billing.depositCollected,
        cancellationFee: billing.cancellationFee,
        discount: billing.discount,
        subtotal: billing.subtotal,
        gst: billing.gst,
        qst: billing.qst,
        total: billing.total,
        refunded: billing.refunded,
        amountDueNow: billing.amountDueNow,
      },
      // What chargeJob will actually put on the card (before gift card credit).
      grossAmount: charge.gross,
      depositCredit: charge.depositCredit,
      amountDue: charge.amountDue,
    };
  });

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <BulkChargeClient jobs={rows} />
    </div>
  );
}
