import { describe, it, expect } from "vitest";
import {
  hoursWorked,
  roundUpToIncrement,
  computeBillableHours,
  depositCollected,
  depositCredit,
  computeChargeAmount,
  computeJobBilling,
  getServicePricingModel,
} from "@/lib/billing";
import { computeHourlyPrice } from "@/lib/config/types";
import { calculateTax } from "@/lib/tax";
import { BILLING, job, clock } from "./helpers";

// A fully-booked hourly TV-mounting job: labour-only subtotal, taxes stored,
// immutable booked baseline captured (basePriceAmount + bookedSubtotalAmount).
function bookedHourly(bookedHours: number, over = {}) {
  const base = computeHourlyPrice(bookedHours, 79, 209);
  const tax = calculateTax(base);
  return job({
    jobType: "TV_MOUNTING",
    basePriceAmount: base,
    bookedSubtotalAmount: base,
    subtotalAmount: base,
    gstAmount: tax.gstAmount,
    qstAmount: tax.qstAmount,
    price: tax.total,
    ...over,
  });
}

// ── Raw hours ────────────────────────────────────────────────────────────────
describe("hoursWorked", () => {
  it("returns the raw elapsed hours", () => {
    expect(hoursWorked(clock(2.5))).toBe(2.5);
    expect(hoursWorked(clock(3))).toBe(3);
  });
  it("is null when the clock is incomplete or non-positive", () => {
    expect(hoursWorked(job({ clockInTime: new Date(), clockOutTime: null }))).toBeNull();
    expect(hoursWorked(job())).toBeNull();
    const { clockInTime } = clock(0);
    expect(hoursWorked({ clockInTime, clockOutTime: clockInTime })).toBeNull();
  });
});

// ── Round-up to increment (D0.8) ─────────────────────────────────────────────
describe("roundUpToIncrement", () => {
  it("rounds UP to the next 15-minute multiple", () => {
    expect(roundUpToIncrement(2, 15)).toBe(2);
    expect(roundUpToIncrement(2.0833, 15)).toBe(2.25); // 2h05m → 2h15m
    expect(roundUpToIncrement(2.25, 15)).toBe(2.25); // exact boundary stays
    expect(roundUpToIncrement(2.26, 15)).toBe(2.5);
  });
  it("does not round a value already on the boundary up a notch (float guard)", () => {
    // 0.5h = 30min is exactly two increments — must not tick to 45min.
    expect(roundUpToIncrement(0.5, 15)).toBe(0.5);
  });
});

// ── Billable hours (round up, then floor at the minimum) ──────────────────────
describe("computeBillableHours", () => {
  it("applies the 2-hour minimum to a short job", () => {
    // 40 minutes → rounds to 45min → floored to the 2h minimum.
    expect(computeBillableHours(...clockPair(40 / 60), BILLING)).toBe(2);
  });
  it("rounds up above the minimum", () => {
    expect(computeBillableHours(...clockPair(2 + 5 / 60), BILLING)).toBe(2.25);
    expect(computeBillableHours(...clockPair(2.5), BILLING)).toBe(2.5);
  });
  it("is null when the clock is incomplete or inverted", () => {
    expect(computeBillableHours(null, new Date(), BILLING)).toBeNull();
    const t = new Date("2026-07-13T09:00:00Z");
    expect(computeBillableHours(new Date(t.getTime() + 3600_000), t, BILLING)).toBeNull();
  });
});

function clockPair(hours: number): [Date, Date] {
  const c = clock(hours);
  return [c.clockInTime, c.clockOutTime];
}

// ── Pricing model resolution ─────────────────────────────────────────────────
describe("getServicePricingModel", () => {
  it("reads the model off the catalog, defaulting unknown to fixed", () => {
    expect(getServicePricingModel("TV_MOUNTING", BILLING)).toBe("hourly");
    expect(getServicePricingModel("SILICONE_SEALING", BILLING)).toBe("fixed");
    expect(getServicePricingModel("PAINTING", BILLING)).toBe("quote");
    expect(getServicePricingModel(null, BILLING)).toBe("fixed");
    expect(getServicePricingModel("MADE_UP", BILLING)).toBe("fixed");
  });
});

// ── computeChargeAmount — the authoritative "what do we charge" (SOP §10) ─────
describe("computeChargeAmount — hourly", () => {
  it("bills clocked hours, swapping booked labour out of the booked subtotal", () => {
    const j = bookedHourly(2, { ...clock(2.5) }); // booked 2h, clocked 2.5h
    const c = computeChargeAmount(j, BILLING);
    expect(c.pricingModel).toBe("hourly");
    expect(c.rawHours).toBe(2.5);
    expect(c.billableHours).toBe(2.5);
    expect(c.labourAmount).toBe(197.5); // 2.5 × 79
    expect(c.subtotal).toBe(197.5);
    expect(c.gst).toBe(9.88);
    expect(c.qst).toBe(19.7);
    expect(c.total).toBe(227.08);
    expect(c.bookedTotal).toBe(181.66); // taxInclusive(158)
    expect(c.clockMissing).toBe(false);
    expect(c.baseMissing).toBe(false);
  });

  it("applies the 3-hour package when clocked to exactly 3h", () => {
    const j = bookedHourly(3, { ...clock(3) });
    const c = computeChargeAmount(j, BILLING);
    expect(c.billableHours).toBe(3);
    expect(c.labourAmount).toBe(209); // package, not 3 × 79 = 237
    expect(c.subtotal).toBe(209);
    expect(c.total).toBe(240.3);
  });

  it("enforces the 2-hour minimum on a 40-minute job", () => {
    const j = bookedHourly(2, { ...clock(40 / 60) });
    const c = computeChargeAmount(j, BILLING);
    expect(c.billableHours).toBe(2);
    expect(c.labourAmount).toBe(158);
  });

  it("rounds a 2h05m job up to 2.25 billable hours", () => {
    const j = bookedHourly(2, { ...clock(2 + 5 / 60) });
    const c = computeChargeAmount(j, BILLING);
    expect(c.billableHours).toBe(2.25);
    expect(c.labourAmount).toBe(177.75); // 2.25 × 79
  });

  it("is idempotent after clock-out overwrites the stored price/subtotal", () => {
    // Stage 1: at clock-out the clocked figures are written back to the job. A
    // re-run must reproduce the SAME numbers because it recomputes from the
    // immutable booked baseline, not the overwritten live subtotal.
    const j = bookedHourly(2, { ...clock(2.5) });
    const first = computeChargeAmount(j, BILLING);
    const overwritten = {
      ...j,
      price: first.total,
      subtotalAmount: first.subtotal,
      gstAmount: first.gst,
      qstAmount: first.qst,
    };
    const second = computeChargeAmount(overwritten, BILLING);
    expect(second).toEqual(first);
  });

  it("flags a missing clock and falls back to the booked total", () => {
    const j = bookedHourly(2, { clockInTime: new Date(), clockOutTime: null });
    const c = computeChargeAmount(j, BILLING);
    expect(c.clockMissing).toBe(true);
    expect(c.total).toBe(j.price); // booked total, unchanged
    expect(c.labourAmount).toBeNull();
  });

  it("flags baseMissing for a legacy hourly job with no captured baseline", () => {
    const j = job({
      jobType: "TV_MOUNTING",
      price: 181.66,
      subtotalAmount: 158,
      gstAmount: 7.9,
      qstAmount: 15.76,
      basePriceAmount: null, // legacy: no baseline captured at booking
      bookedSubtotalAmount: null,
      ...clock(2.5),
    });
    const c = computeChargeAmount(j, BILLING);
    expect(c.baseMissing).toBe(true);
    expect(c.billableHours).toBe(2.5); // hours still computed for display
    expect(c.total).toBe(181.66); // but the booked total is charged
  });
});

describe("computeChargeAmount — fixed & quote (clock is ignored)", () => {
  it("fixed: charges the stored price verbatim even with a clock record", () => {
    const j = job({
      jobType: "SILICONE_SEALING",
      price: 240.29, // taxInclusive(209)
      subtotalAmount: 209,
      gstAmount: 10.45,
      qstAmount: 20.85,
      ...clock(5), // clocked 5h — must NOT change the charge
    });
    const c = computeChargeAmount(j, BILLING);
    expect(c.pricingModel).toBe("fixed");
    expect(c.total).toBe(240.29);
    expect(c.labourAmount).toBeNull();
    expect(c.billableHours).toBeNull();
  });

  it("quote: painting charges the stored bid×surplus price", () => {
    // Painting overwrites job.price with bid×surplus on acceptance WITHOUT
    // updating the stored tax split, so the split (here the stale booked figure)
    // no longer sums to price → computeChargeAmount re-derives it from the total.
    const j = job({
      jobType: "PAINTING",
      price: 1188, // 880 bid × 1.35
      subtotalAmount: 900, // stale split: 900 + 0 + 0 ≠ 1188 → triggers re-derive
      gstAmount: 0,
      qstAmount: 0,
    });
    const c = computeChargeAmount(j, BILLING);
    expect(c.pricingModel).toBe("quote");
    expect(c.total).toBe(1188); // total stays the authoritative price
    // …and a reconciled tax-inclusive split is derived from it.
    expect(c.subtotal + c.gst + c.qst).toBeCloseTo(1188, 2);
    expect(c.subtotal).toBeCloseTo(1188 / 1.14975, 1);
  });

  it("quote: keeps the stored split when it already reconciles", () => {
    const tax = calculateTax(1033.27);
    const j = job({
      jobType: "PAINTING",
      price: tax.total,
      subtotalAmount: tax.subtotal,
      gstAmount: tax.gstAmount,
      qstAmount: tax.qstAmount,
    });
    const c = computeChargeAmount(j, BILLING);
    expect(c.subtotal).toBe(tax.subtotal);
    expect(c.total).toBe(tax.total);
  });
});

// ── Deposits ─────────────────────────────────────────────────────────────────
describe("depositCollected", () => {
  it("is zero when no deposit was paid", () => {
    expect(depositCollected(job({ depositPaid: false }), BILLING)).toBe(0);
  });
  it("is the base booking deposit for a plain job", () => {
    expect(depositCollected(job({ depositPaid: true }), BILLING)).toBe(20);
  });
  it("is the materials amount for an upfront deposit/charge", () => {
    expect(
      depositCollected(
        job({ depositPaid: true, materialsType: "deposit", materialsAmount: 199 }),
        BILLING
      )
    ).toBe(199);
    expect(
      depositCollected(
        job({ depositPaid: true, materialsType: "charge", materialsAmount: 119 }),
        BILLING
      )
    ).toBe(119);
  });
  it("falls back to the base deposit for a non-upfront materials cost", () => {
    // A "cost" is billed on the final invoice, not captured upfront — so what
    // was collected at booking is the base booking deposit.
    expect(
      depositCollected(
        job({ depositPaid: true, materialsType: "cost", materialsAmount: 49 }),
        BILLING
      )
    ).toBe(20);
  });
});

describe("depositCredit", () => {
  it("credits the base deposit for a plain job", () => {
    expect(depositCredit(job({ depositPaid: true }), 300, BILLING)).toBe(20);
  });
  it("credits a flat upfront charge in full (capped at the bill)", () => {
    const j = job({ depositPaid: true, materialsType: "charge", materialsAmount: 119 });
    expect(depositCredit(j, 300, BILLING)).toBe(119);
    expect(depositCredit(j, 50, BILLING)).toBe(50); // capped at the gross
  });
  it("credits only the APPLIED portion of a refundable materials deposit", () => {
    // $199 collected, admin applied $120 → credit 120 (the $79 balance is
    // refunded as its own movement, not netted off the invoice).
    const j = job({
      depositPaid: true,
      materialsType: "deposit",
      materialsAmount: 199,
      materialsAppliedAmount: 120,
    });
    expect(depositCredit(j, 500, BILLING)).toBe(120);
  });
  it("defaults an unapplied deposit to min(collected, gross)", () => {
    const j = job({
      depositPaid: true,
      materialsType: "deposit",
      materialsAmount: 199,
      materialsAppliedAmount: null,
    });
    expect(depositCredit(j, 500, BILLING)).toBe(199);
    expect(depositCredit(j, 150, BILLING)).toBe(150);
  });
  it("is zero when nothing was paid", () => {
    expect(depositCredit(job({ depositPaid: false }), 500, BILLING)).toBe(0);
  });
});

// ── computeJobBilling — full reviewable breakdown (amountDueNow) ──────────────
describe("computeJobBilling", () => {
  it("nets the credited deposit and refunds off the charge", () => {
    const j = bookedHourly(2, { ...clock(2.5), depositPaid: true });
    const b = computeJobBilling(j, BILLING);
    expect(b.total).toBe(227.08);
    expect(b.depositCollected).toBe(20);
    expect(b.depositCredit).toBe(20);
    expect(b.amountDueNow).toBe(207.08); // 227.08 − 20
  });

  it("nets only the APPLIED portion of a partial materials deposit", () => {
    // Drywall repair: $199 deposit collected, $120 applied. The screen must
    // agree with what chargeJob deducts — credit the applied 120, not the 199.
    const j = bookedHourly(2, {
      ...clock(2.5),
      depositPaid: true,
      materialsType: "deposit",
      materialsAmount: 199,
      materialsAppliedAmount: 120,
    });
    const b = computeJobBilling(j, BILLING);
    expect(b.depositCollected).toBe(199);
    expect(b.depositCredit).toBe(120);
    expect(b.amountDueNow).toBe(round2(b.total - 120));
  });

  it("adds the cancellation fee only when the job is stamped, from config", () => {
    const notCancelled = computeJobBilling(bookedHourly(2, { ...clock(2.5) }), BILLING);
    expect(notCancelled.cancellationFee).toBe(0);

    const cancelled = computeJobBilling(
      bookedHourly(2, { ...clock(2.5), cancellationFeeChargedAt: new Date() }),
      BILLING
    );
    expect(cancelled.cancellationFee).toBe(25); // policy.cancellationFee default
  });

  it("never lets amountDueNow go negative", () => {
    // A tiny job with a large refund already issued.
    const j = bookedHourly(2, { ...clock(2), depositPaid: true, refundedAmount: 1000 });
    const b = computeJobBilling(j, BILLING);
    expect(b.amountDueNow).toBe(0);
  });

  it("subtracts prior refunds from the amount due", () => {
    const j = bookedHourly(2, { ...clock(2.5), depositPaid: true, refundedAmount: 50 });
    const b = computeJobBilling(j, BILLING);
    expect(b.amountDueNow).toBe(round2(227.08 - 20 - 50));
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
