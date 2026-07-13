// Job billing breakdown (SOP §10). Produces a clearly separated view of a
// job's money: labour (billable clocked hours × hourly rate), materials/equipment,
// deposits applied/refunded, cancellation fee, discounts, taxes — so ops can
// review before charging the card.
//
// For `pricing:"hourly"` services the charge is derived from the ACTUAL clock
// record (billable hours × rate), NOT the static booked price — see
// computeChargeAmount(). `"fixed"`/`"quote"` services keep the stored job.price
// (painting's price is set to the accepted bid × surplus on acceptance).

import { getRuntimeConfig } from "@/lib/config/service-config";
import {
  isUpfrontMaterials,
  computeHourlyPrice,
  pricingModelFor,
  type ServicePricingType,
  type RuntimeConfig,
} from "@/lib/config/types";
import { GST_RATE, QST_RATE, COMBINED_RATE } from "@/lib/tax";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Tax-inclusive total for a pre-tax subtotal (matches calculateTax()). */
function taxInclusive(subtotal: number): number {
  const sub = Math.max(0, subtotal);
  return round2(sub + round2(sub * GST_RATE) + round2(sub * QST_RATE));
}

/** Admin-configurable hourly labour rate (SOP §10), default $79. */
export async function getLabourRate(): Promise<number> {
  const cfg = await getRuntimeConfig();
  return cfg.policy.labourRate;
}

/**
 * Everything computeChargeAmount needs, resolved in one pass.
 *
 * Carries the whole RuntimeConfig so the pricing MODEL of the job's service
 * (hourly / fixed / quote — D0.7) is read from the same admin-editable catalog
 * as the booking price, rather than from a TS constant that a repriced service
 * would have left behind. computeChargeAmount stays sync and pure.
 */
export interface BillingConfig {
  labourRate: number;
  incrementMinutes: number;
  minBillableHours: number;
  threeHourPackagePrice: number;
  /** Fee applied when the job carries a cancellation-fee stamp. */
  cancellationFee: number;
  /** Captured at checkout when the service has no upfront materials line. */
  baseBookingDeposit: number;
  config: RuntimeConfig;
}

export async function getBillingConfig(): Promise<BillingConfig> {
  const cfg = await getRuntimeConfig();
  return {
    labourRate: cfg.policy.labourRate,
    incrementMinutes: cfg.policy.billingIncrementMinutes,
    minBillableHours: cfg.policy.minBillableHours,
    threeHourPackagePrice: cfg.policy.threeHourPackage,
    cancellationFee: cfg.policy.cancellationFee,
    baseBookingDeposit: cfg.policy.baseBookingDeposit,
    config: cfg,
  };
}

/** The catalog pricing model for a job's service type (D0.7). Unknown/absent
 *  service types fall back to "fixed" so the stored job.price is used verbatim
 *  rather than being recomputed from a clock. */
export function getServicePricingModel(
  jobType: string | null | undefined,
  cfg: BillingConfig
): ServicePricingType {
  return pricingModelFor(cfg.config, jobType);
}

export interface JobBillingLike {
  jobType: string | null;
  price: number | null;
  discountAmount: number | null;
  subtotalAmount: number;
  gstAmount: number;
  qstAmount: number;
  // Booked base/labour component captured at booking time. Lets us swap the
  // booked labour out of the stored subtotal for the clocked labour without
  // disturbing add-ons / materials / travel / discount.
  basePriceAmount: number | null;
  // Immutable booked subtotal captured at booking. computeChargeAmount recomputes
  // the swap from this baseline, so the recompute stays correct/idempotent even
  // after clock-out overwrites the live subtotalAmount with the clocked figure.
  bookedSubtotalAmount: number | null;
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

export interface ChargeAmount {
  pricingModel: ServicePricingType;
  // Raw clocked hours (unrounded), for display/provenance.
  rawHours: number | null;
  // Billable hours actually charged (rounded up to the increment, min applied).
  billableHours: number | null;
  labourRate: number;
  // Billable labour ($) for hourly jobs; null for fixed/quote.
  labourAmount: number | null;
  subtotal: number;
  gst: number;
  qst: number;
  // Tax-inclusive amount to charge (gross, before any deposit/gift-card credit).
  total: number;
  // Stored booked estimate (job.price), surfaced for side-by-side comparison.
  bookedTotal: number;
  // Hourly job whose clock record is incomplete — labour can't be computed.
  clockMissing: boolean;
  // Hourly job booked before basePriceAmount was captured — labour can't be
  // isolated from the stored subtotal, so the booked total is used as-is.
  baseMissing: boolean;
}

export interface JobBilling {
  pricingModel: ServicePricingType;
  hoursWorked: number | null;
  billableHours: number | null;
  labourRate: number;
  labourFromClock: number | null;
  materialsAmount: number;
  materialsType: string | null;
  materialsApplied: number;
  materialsRefunded: boolean;
  /** What was captured at booking (drives the refundable balance). */
  depositCollected: number;
  /** What is netted off THIS invoice — see depositCredit(). Differs from
   *  depositCollected on a partially applied materials deposit. */
  depositCredit: number;
  cancellationFee: number;
  discount: number;
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
  bookedTotal: number;
  refunded: number;
  // Amount still owed on the card now = total − deposit already paid − refunds.
  amountDueNow: number;
  clockMissing: boolean;
  baseMissing: boolean;
}

/** Raw hours between clock-in and clock-out, or null if not fully clocked. */
export function hoursWorked(
  job: Pick<JobBillingLike, "clockInTime" | "clockOutTime">
): number | null {
  if (!job.clockInTime || !job.clockOutTime) return null;
  const ms = job.clockOutTime.getTime() - job.clockInTime.getTime();
  if (ms <= 0) return null;
  return round2(ms / 3600_000);
}

/** Round hours UP to the nearest `incrementMinutes` (D0.8). */
export function roundUpToIncrement(hours: number, incrementMinutes: number): number {
  if (incrementMinutes <= 0) return hours;
  const totalMin = hours * 60;
  const rounded = Math.ceil(totalMin / incrementMinutes - 1e-9) * incrementMinutes;
  return rounded / 60;
}

/** Billable hours from a clock record: round up to the increment, then apply the
 *  minimum (D0.8). Null when the clock record is incomplete or non-positive. */
export function computeBillableHours(
  clockInTime: Date | null,
  clockOutTime: Date | null,
  cfg: Pick<BillingConfig, "incrementMinutes" | "minBillableHours">
): number | null {
  if (!clockInTime || !clockOutTime) return null;
  const ms = clockOutTime.getTime() - clockInTime.getTime();
  if (ms <= 0) return null;
  const raw = ms / 3600_000;
  const rounded = roundUpToIncrement(raw, cfg.incrementMinutes);
  return round2(Math.max(rounded, cfg.minBillableHours));
}

// Amount collected upfront: a refundable materials deposit, or a flat upfront
// materials charge (painting's $119), else the base booking deposit. The base
// deposit is the configured `pricing.baseBookingDeposit` — the same value
// /api/stripe/charge-deposit actually captures, so the credit here can't drift
// from the charge there.
export function depositCollected(
  job: Pick<JobBillingLike, "depositPaid" | "materialsType" | "materialsAmount">,
  cfg: Pick<BillingConfig, "baseBookingDeposit">
): number {
  if (!job.depositPaid) return 0;
  if (isUpfrontMaterials(job.materialsType) && job.materialsAmount) return job.materialsAmount;
  return cfg.baseBookingDeposit;
}

/**
 * The portion of the collected deposit CREDITED against the final bill (SOP §10).
 *
 * Deliberately NOT the same as depositCollected(). A refundable materials deposit
 * credits only the admin-APPLIED portion — the unused balance is refunded as its
 * own movement, not netted off the invoice. A flat upfront charge (painting's
 * $119) credits in full. Anything else credits the base booking deposit.
 *
 * This is the number `chargeJob` actually deducts from the card, so every review
 * screen and the bulk-charge list MUST use it too. Three separate copies of this
 * logic previously existed — in `chargeJob`, in the bulk-charge page's
 * `chargeJobMirror`, and inline in `JobDetailView` — each with the base deposit
 * hardcoded as `20`. Once the deposit became admin-editable, all three silently
 * diverged from what Stripe captured.
 */
export function depositCredit(
  job: Pick<
    JobBillingLike,
    "depositPaid" | "materialsType" | "materialsAmount" | "materialsAppliedAmount"
  >,
  grossAmount: number,
  cfg: Pick<BillingConfig, "baseBookingDeposit">
): number {
  if (!job.depositPaid) return 0;
  if (job.materialsType === "deposit") {
    const collected = job.materialsAmount ?? 0;
    return job.materialsAppliedAmount ?? Math.min(collected, grossAmount);
  }
  if (job.materialsType === "charge") {
    // Flat upfront charge: credited in full, never partially applied — there is
    // no unused balance to reconcile (SOP §5/§6).
    return Math.min(job.materialsAmount ?? 0, grossAmount);
  }
  return cfg.baseBookingDeposit;
}

/**
 * Authoritative "what do we charge" computation (SOP §10). Switches on the
 * catalog pricing model (D0.7):
 *   • hourly → billable clocked hours × rate (package-aware), with add-ons /
 *     materials / travel / discount preserved from the booked subtotal, taxes
 *     re-applied.
 *   • fixed / quote → the stored job.price (silicone/weatherproofing fixed price;
 *     painting's accepted-bid × surplus, written to job.price on acceptance).
 */
export function computeChargeAmount(job: JobBillingLike, cfg: BillingConfig): ChargeAmount {
  const pricingModel = getServicePricingModel(job.jobType, cfg);
  const bookedTotal = round2(job.price ?? 0);
  const rawHours = hoursWorked(job);

  const passthrough = (over: Partial<ChargeAmount> = {}): ChargeAmount => {
    // Present a consistent breakdown. Normally the stored subtotal/gst/qst sum to
    // the price, but painting replaces job.price with the accepted bid × surplus
    // on acceptance without updating the tax split — so when they no longer
    // reconcile, re-derive a tax-inclusive split from the authoritative total.
    let subtotal = round2(job.subtotalAmount ?? 0);
    let gst = round2(job.gstAmount ?? 0);
    let qst = round2(job.qstAmount ?? 0);
    if (Math.abs(round2(subtotal + gst + qst) - bookedTotal) > 0.01) {
      subtotal = round2(bookedTotal / (1 + COMBINED_RATE));
      gst = round2(subtotal * GST_RATE);
      qst = round2(subtotal * QST_RATE);
    }
    return {
      pricingModel,
      rawHours,
      billableHours: null,
      labourRate: cfg.labourRate,
      labourAmount: null,
      subtotal,
      gst,
      qst,
      total: bookedTotal,
      bookedTotal,
      clockMissing: false,
      baseMissing: false,
      ...over,
    };
  };

  // Fixed / quote — the stored price is authoritative.
  if (pricingModel !== "hourly") return passthrough();

  const billableHours = computeBillableHours(job.clockInTime, job.clockOutTime, cfg);

  // Hourly job with no usable clock record — fall back to booked total but flag
  // it so the review UI warns and the charge guard blocks (SOP §10, 1.5).
  if (billableHours == null) {
    return passthrough({ clockMissing: true, baseMissing: job.basePriceAmount == null });
  }

  const labourAmount = computeHourlyPrice(
    billableHours,
    cfg.labourRate,
    cfg.threeHourPackagePrice
  );

  // Legacy hourly job booked before the baseline was captured: we can't isolate
  // the booked labour from the stored subtotal, so keep the booked total (the
  // pre-fix behaviour) and flag it. New jobs always carry the baseline.
  if (job.basePriceAmount == null || job.bookedSubtotalAmount == null) {
    return passthrough({ billableHours, labourAmount, baseMissing: true });
  }

  // Swap the booked labour out of the IMMUTABLE booked subtotal (not the live
  // subtotalAmount, which clock-out overwrites) so re-running after a clock
  // correction stays correct and idempotent. Everything else (add-ons,
  // materials, travel, discount) is preserved. Taxes are re-applied.
  const baselineSubtotal = job.bookedSubtotalAmount;
  const subtotal = round2(Math.max(0, baselineSubtotal - job.basePriceAmount + labourAmount));
  const gst = round2(subtotal * GST_RATE);
  const qst = round2(subtotal * QST_RATE);
  const total = round2(subtotal + gst + qst);

  return {
    pricingModel,
    rawHours,
    billableHours,
    labourRate: cfg.labourRate,
    labourAmount,
    subtotal,
    gst,
    qst,
    total,
    // Immutable booked total (for the side-by-side estimate comparison) — derived
    // from the baseline because job.price is overwritten with the clocked total.
    bookedTotal: taxInclusive(baselineSubtotal),
    clockMissing: false,
    baseMissing: false,
  };
}

export function computeJobBilling(job: JobBillingLike, cfg: BillingConfig): JobBilling {
  const charge = computeChargeAmount(job, cfg);
  const deposit = depositCollected(job, cfg);
  // Was a hardcoded 25 while the fee itself lived in CANCELLATION_FEE_USD — so
  // an admin raising the fee would have charged the new amount but shown the old
  // one on every review screen and invoice. Both read the config value now.
  const cancellationFee = job.cancellationFeeChargedAt ? cfg.cancellationFee : 0;
  // "Amount due now" must be what the card will ACTUALLY be charged, so it nets
  // off the CREDITED deposit, not the collected one. These differ on a partially
  // applied materials deposit: $199 collected with $120 applied credits $120 here
  // and refunds the $79 separately. Netting the full $199 (the old behaviour) made
  // this screen disagree with chargeJob by exactly the unused balance.
  const credit = depositCredit(job, charge.total, cfg);
  const amountDueNow = round2(
    Math.max(0, charge.total - credit - (job.refundedAmount ?? 0))
  );

  return {
    pricingModel: charge.pricingModel,
    hoursWorked: charge.rawHours,
    billableHours: charge.billableHours,
    labourRate: charge.labourRate,
    labourFromClock: charge.labourAmount,
    materialsAmount: job.materialsAmount ?? 0,
    materialsType: job.materialsType ?? null,
    materialsApplied: job.materialsAppliedAmount ?? 0,
    materialsRefunded: !!job.materialsRefundedAt,
    depositCollected: deposit,
    depositCredit: credit,
    cancellationFee,
    discount: job.discountAmount ?? 0,
    subtotal: charge.subtotal,
    gst: charge.gst,
    qst: charge.qst,
    total: charge.total,
    bookedTotal: charge.bookedTotal,
    refunded: job.refundedAmount ?? 0,
    amountDueNow,
    clockMissing: charge.clockMissing,
    baseMissing: charge.baseMissing,
  };
}
