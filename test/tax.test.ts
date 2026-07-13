import { describe, it, expect } from "vitest";
import {
  calculateTax,
  taxInclusiveBreakdown,
  GST_RATE,
  QST_RATE,
  COMBINED_RATE,
} from "@/lib/tax";

// Quebec sales tax: GST 5% (federal) + QST 9.975% (provincial) = 14.975%.
describe("tax rates", () => {
  it("uses the Quebec GST/QST rates", () => {
    expect(GST_RATE).toBe(0.05);
    expect(QST_RATE).toBe(0.09975);
    expect(COMBINED_RATE).toBeCloseTo(0.14975, 10);
  });
});

describe("calculateTax", () => {
  it("splits a subtotal into GST + QST and sums back to the total", () => {
    const t = calculateTax(100);
    expect(t.subtotal).toBe(100);
    expect(t.gstAmount).toBe(5);
    expect(t.qstAmount).toBe(9.98); // 9.975 rounded to the cent
    expect(t.total).toBe(114.98);
    expect(t.subtotal + t.gstAmount + t.qstAmount).toBeCloseTo(t.total, 10);
  });

  it("clamps a negative subtotal to zero", () => {
    const t = calculateTax(-50);
    expect(t.subtotal).toBe(0);
    expect(t.gstAmount).toBe(0);
    expect(t.qstAmount).toBe(0);
    expect(t.total).toBe(0);
  });

  it("rounds each component to the cent", () => {
    const t = calculateTax(79); // 2h × ... just a labour-ish figure
    expect(t.gstAmount).toBe(3.95);
    expect(t.qstAmount).toBe(7.88); // 79 × 0.09975 = 7.88025 → 7.88
    expect(t.total).toBe(90.83);
  });
});

describe("taxInclusiveBreakdown", () => {
  it("is the inverse of calculateTax within a cent (round trip)", () => {
    // A painting bid × surplus arrives as a tax-INCLUSIVE figure; the breakdown
    // must reconcile so stored line items sum back to the amount charged.
    for (const gross of [114.98, 945, 1215, 4050, 119, 1000.01]) {
      const b = taxInclusiveBreakdown(gross);
      expect(b.subtotal + b.gstAmount + b.qstAmount).toBeCloseTo(b.total, 10);
      expect(b.total).toBe(Math.round(gross * 100) / 100);
      // Re-taxing the derived subtotal returns the same gross to within a few
      // cents (each of the three round-to-cent steps can move it by up to ½¢).
      const forward = calculateTax(b.subtotal);
      expect(Math.abs(forward.total - b.total)).toBeLessThan(0.05);
    }
  });

  it("preserves the total exactly, absorbing rounding into QST", () => {
    const b = taxInclusiveBreakdown(945);
    expect(b.total).toBe(945);
    // subtotal = 945 / 1.14975 = 821.92...; the split must still sum to 945.
    expect(b.subtotal + b.gstAmount + b.qstAmount).toBe(945);
  });

  it("clamps a negative inclusive total to zero", () => {
    const b = taxInclusiveBreakdown(-10);
    expect(b).toEqual({ subtotal: 0, gstAmount: 0, qstAmount: 0, total: 0 });
  });
});
