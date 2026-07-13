import { requireAdmin } from "@/lib/page-guards";
import { db } from "@/db";
import {
  computeJobBilling,
  getBillingConfig,
  depositCredit,
  type BillingConfig,
  type JobBillingLike,
} from "@/lib/billing";
import BulkChargeClient from "./BulkChargeClient";

// The amount ops review here MUST be the amount the card is actually charged
// (SOP §10.3). This used to be a hand-copied duplicate of chargeJob's credit
// math — with the base booking deposit hardcoded as `20`, so it silently
// diverged from Stripe the moment the deposit became admin-editable. It now
// calls the same depositCredit() that chargeJob calls.
function chargeJobMirror(job: JobBillingLike, gross: number, cfg: BillingConfig) {
  const credit = depositCredit(job, gross, cfg);
  return { gross, depositCredit: credit, amountDue: Math.max(0, gross - credit) };
}

export default async function BulkChargePage() {
  await requireAdmin();

  const billingCfg = await getBillingConfig();

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
      basePriceAmount: true,
      bookedSubtotalAmount: true,
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
    const billing = computeJobBilling(j, billingCfg);
    const charge = chargeJobMirror(j, billing.total, billingCfg);
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
        pricingModel: billing.pricingModel,
        hoursWorked: billing.hoursWorked,
        billableHours: billing.billableHours,
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
        bookedTotal: billing.bookedTotal,
        refunded: billing.refunded,
        amountDueNow: billing.amountDueNow,
        clockMissing: billing.clockMissing,
        baseMissing: billing.baseMissing,
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
