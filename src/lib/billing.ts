// Job billing breakdown (SOP §10). Produces a clearly separated view of a
// job's money: labour (from clock-in/out × hourly rate), materials/equipment,
// deposits applied/refunded, cancellation fee, discounts, taxes — so ops can
// review before charging the card. Display-oriented; the actual card charge in
// chargeJob credits the paid deposit against the total.

import { db } from "@/db";
import { DEFAULT_LABOUR_RATE } from "@/lib/policy";

export const LABOUR_RATE_SETTING_KEY = "pricing.labourRate";

/** Admin-configurable hourly labour rate (SOP §10), default $79. */
export async function getLabourRate(): Promise<number> {
  const setting = await db.appSetting.findUnique({
    where: { key: LABOUR_RATE_SETTING_KEY },
  });
  const v = setting?.value;
  if (typeof v === "number" && v > 0) return v;
  if (v && typeof v === "object" && "rate" in v) {
    const r = (v as { rate?: unknown }).rate;
    if (typeof r === "number" && r > 0) return r;
  }
  return DEFAULT_LABOUR_RATE;
}

export interface JobBillingLike {
  price: number | null;
  discountAmount: number | null;
  subtotalAmount: number;
  gstAmount: number;
  qstAmount: number;
  clockInTime: Date | null;
  clockOutTime: Date | null;
  depositPaid: boolean;
  materialsAmount: number | null;
  materialsType: string | null;
  materialsAppliedAmount: number | null;
  materialsRefundedAt: Date | null;
  cancellationFeeChargedAt: Date | null;
  refundedAmount: number;
}

export interface JobBilling {
  hoursWorked: number | null;
  labourRate: number;
  labourFromClock: number | null;
  materialsAmount: number;
  materialsType: string | null;
  materialsApplied: number;
  materialsRefunded: boolean;
  depositCollected: number;
  cancellationFee: number;
  discount: number;
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
  refunded: number;
  // Amount still owed on the card now = total − deposit already paid − refunds.
  amountDueNow: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Hours between clock-in and clock-out, or null if not fully clocked. */
export function hoursWorked(job: Pick<JobBillingLike, "clockInTime" | "clockOutTime">): number | null {
  if (!job.clockInTime || !job.clockOutTime) return null;
  const ms = job.clockOutTime.getTime() - job.clockInTime.getTime();
  if (ms <= 0) return null;
  return round2(ms / 3600_000);
}

// Deposit collected upfront: a materials deposit (e.g. painting $799) when one
// applied, else the $20 base booking deposit.
export function depositCollected(job: Pick<JobBillingLike, "depositPaid" | "materialsType" | "materialsAmount">): number {
  if (!job.depositPaid) return 0;
  if (job.materialsType === "deposit" && job.materialsAmount) return job.materialsAmount;
  return 20;
}

export function computeJobBilling(job: JobBillingLike, labourRate: number): JobBilling {
  const hrs = hoursWorked(job);
  const deposit = depositCollected(job);
  const total = round2((job.price ?? 0) - 0); // price already net of materials/discount in stored total
  const cancellationFee = job.cancellationFeeChargedAt ? 25 : 0;
  const amountDueNow = round2(Math.max(0, total - deposit - (job.refundedAmount ?? 0)));

  return {
    hoursWorked: hrs,
    labourRate,
    labourFromClock: hrs != null ? round2(hrs * labourRate) : null,
    materialsAmount: job.materialsAmount ?? 0,
    materialsType: job.materialsType ?? null,
    materialsApplied: job.materialsAppliedAmount ?? 0,
    materialsRefunded: !!job.materialsRefundedAt,
    depositCollected: deposit,
    cancellationFee,
    discount: job.discountAmount ?? 0,
    subtotal: job.subtotalAmount ?? 0,
    gst: job.gstAmount ?? 0,
    qst: job.qstAmount ?? 0,
    total,
    refunded: job.refundedAmount ?? 0,
    amountDueNow,
  };
}
