import { describe, it, expect } from "vitest";
import {
  computeHourlyPrice,
  resolveBasePrice,
  materialsFor,
  isUpfrontMaterials,
  isRefundableDeposit,
  materialsLineLabel,
  pricingModelFor,
  findService,
  activeServices,
  serviceLabel,
  paintingQuoteRange,
  paintingFinalAmount,
  findPaintingScope,
} from "@/lib/config/types";
import { CFG } from "./helpers";

// ── Hourly labour price (package-aware) ──────────────────────────────────────
describe("computeHourlyPrice", () => {
  const rate = 79;
  const pkg = 209;

  it("bills hours × rate off the package hour", () => {
    expect(computeHourlyPrice(2, rate, pkg)).toBe(158);
    expect(computeHourlyPrice(4, rate, pkg)).toBe(316);
    expect(computeHourlyPrice(2.5, rate, pkg)).toBe(197.5);
  });

  it("applies the flat 3-hour package at exactly 3h (cheaper than 3×rate)", () => {
    expect(computeHourlyPrice(3, rate, pkg)).toBe(209);
    expect(209).toBeLessThan(3 * rate); // 237 — the package is a real discount
  });

  it("does not apply the package to 2.99h or 3.01h", () => {
    expect(computeHourlyPrice(2.99, rate, pkg)).toBe(236.21);
    expect(computeHourlyPrice(3.01, rate, pkg)).toBe(237.79);
  });
});

// ── resolveBasePrice: switches on the catalog pricing model (D0.7) ───────────
describe("resolveBasePrice", () => {
  it("hourly: floors at the booking minimum then bills × rate", () => {
    // TV mounting is hourly; min booking hours is 2, rate 79.
    expect(resolveBasePrice(CFG, 1, "TV_MOUNTING")).toBe(158); // floored to 2h
    expect(resolveBasePrice(CFG, 4, "TV_MOUNTING")).toBe(316);
    expect(resolveBasePrice(CFG, 3, "TV_MOUNTING")).toBe(209); // package
  });

  it("fixed per-unit: Silicone sealing bills the fixed price × rooms", () => {
    // SILICONE_SEALING is fixed, $209/room, reusing `hours` as a room count.
    expect(resolveBasePrice(CFG, 1, "SILICONE_SEALING")).toBe(209);
    expect(resolveBasePrice(CFG, 3, "SILICONE_SEALING")).toBe(627);
    // At least one room even if 0 passed.
    expect(resolveBasePrice(CFG, 0, "SILICONE_SEALING")).toBe(209);
  });

  it("quote: Weatherproofing is quote-priced until the price is approved", () => {
    // Fix #5 — Weatherproofing moved from a flat $74.50 to "Request a Quote
    // until price approved". Like painting, a quote-priced service contributes
    // no base price at booking; WEATHERPROOFING_FIXED_PRICE survives only as the
    // internal ops baseline for the $59–$90 band.
    expect(resolveBasePrice(CFG, 1, "WEATHERPROOFING")).toBe(0);
    expect(resolveBasePrice(CFG, 5, "WEATHERPROOFING")).toBe(0);
  });

  it("quote: painting contributes no base price (the bid supplies it)", () => {
    expect(resolveBasePrice(CFG, 3, "PAINTING")).toBe(0);
  });

  it("unknown service falls back to hourly", () => {
    expect(resolveBasePrice(CFG, 2, "NOT_A_REAL_SERVICE")).toBe(158);
  });
});

// ── Materials pricing (SOP §5) ───────────────────────────────────────────────
describe("materialsFor", () => {
  it("painting is a flat $119 charge, paint not included (D0.3)", () => {
    const m = materialsFor(CFG, "PAINTING");
    expect(m).toEqual({ amount: 119, type: "charge", note: "paint not included" });
    expect(isUpfrontMaterials(m!.type)).toBe(true);
    expect(isRefundableDeposit(m!.type)).toBe(false);
  });

  it("small paint repair is a $49 cost, paint not included", () => {
    const m = materialsFor(CFG, "SMALL_PAINT_REPAIR");
    expect(m).toEqual({ amount: 49, type: "cost", note: "paint not included" });
  });

  it("AC installation has NO materials line — returns null, not a default", () => {
    // SOP §5: AC installation carries no automatic materials/equipment charge.
    expect(materialsFor(CFG, "AC_INSTALLATION")).toBeNull();
  });

  it("Drywall repair is a refundable $199 deposit (gets the D indicator)", () => {
    const m = materialsFor(CFG, "DRYWALL_REPAIR");
    expect(m).toEqual({ amount: 199, type: "deposit", note: null });
    expect(isRefundableDeposit(m!.type)).toBe(true);
    expect(isUpfrontMaterials(m!.type)).toBe(true);
  });

  it("unknown service has no materials", () => {
    expect(materialsFor(CFG, "NOPE")).toBeNull();
  });
});

describe("materialsLineLabel", () => {
  it("labels each materials type with its amount and optional note", () => {
    expect(materialsLineLabel({ amount: 119, type: "charge", note: "paint not included" }))
      .toBe("Materials & equipment charge — $119 (paint not included)");
    expect(materialsLineLabel({ amount: 199, type: "deposit", note: null }))
      .toBe("Materials & equipment deposit — $199");
    expect(materialsLineLabel({ amount: 49.5, type: "cost", note: null }))
      .toBe("Materials & equipment cost — $49.50");
  });
});

// ── Service catalog lookups ──────────────────────────────────────────────────
describe("service catalog lookups", () => {
  it("resolves the pricing model per service", () => {
    expect(pricingModelFor(CFG, "TV_MOUNTING")).toBe("hourly");
    expect(pricingModelFor(CFG, "SILICONE_SEALING")).toBe("fixed");
    expect(pricingModelFor(CFG, "PAINTING")).toBe("quote");
    // Unknown → "fixed" so the stored job.price is used verbatim.
    expect(pricingModelFor(CFG, "NOPE")).toBe("fixed");
  });

  it("includes the two v4.2 service additions, both active", () => {
    const small = findService(CFG, "SMALL_PAINT_REPAIR");
    const ac = findService(CFG, "AC_INSTALLATION");
    expect(small?.active).toBe(true);
    expect(ac?.active).toBe(true);
    // Both bill hourly labour at $79/hr (SOP §5).
    expect(small?.pricing).toBe("hourly");
    expect(ac?.pricing).toBe("hourly");
    expect(activeServices(CFG).map((s) => s.value)).toContain("SMALL_PAINT_REPAIR");
    expect(activeServices(CFG).map((s) => s.value)).toContain("AC_INSTALLATION");
  });

  it("falls back to the raw value for an unknown label", () => {
    expect(serviceLabel(CFG, "NOPE")).toBe("NOPE");
    expect(serviceLabel(CFG, "")).toBe("");
    expect(serviceLabel(CFG, "PAINTING")).toBe(findService(CFG, "PAINTING")!.label);
  });
});

// ── Painting surplus + baselines (SOP §6/§7) ─────────────────────────────────
describe("painting quote range (baseline × 1.35 surplus)", () => {
  it("matches the §7 published customer ranges", () => {
    // Small room baseline 700–900 → 945–1215 at 1.35.
    expect(paintingQuoteRange(CFG, "small_room")).toEqual({ min: 945, max: 1215 });
    // Average bathroom baseline 500–700 → 675–945.
    expect(paintingQuoteRange(CFG, "bathroom")).toEqual({ min: 675, max: 945 });
    // Large room baseline 1200–1400 → 1620–1890.
    expect(paintingQuoteRange(CFG, "large_room")).toEqual({ min: 1620, max: 1890 });
    // Studio is a single $700 baseline → $945 (min == max).
    expect(paintingQuoteRange(CFG, "studio")).toEqual({ min: 945, max: 945 });
  });

  it("returns null for an unknown scope", () => {
    expect(paintingQuoteRange(CFG, "mansion")).toBeNull();
    expect(paintingQuoteRange(CFG, null)).toBeNull();
  });

  it("every seeded scope stores a PRE-surplus baseline (never a post-surplus figure)", () => {
    // Guard against someone pasting the $945 customer figure into the baseline.
    const scope = findPaintingScope(CFG, "small_room")!;
    expect(scope.baselineMin).toBe(700);
    expect(scope.baselineMax).toBe(900);
    expect(paintingQuoteRange(CFG, "small_room")!.min).toBeGreaterThan(scope.baselineMin);
  });
});

describe("paintingFinalAmount (accepted bid × surplus)", () => {
  it("applies the surplus rate passed in, not a hardcoded 1.35", () => {
    expect(paintingFinalAmount(1000, 1.35)).toBe(1350);
    expect(paintingFinalAmount(880, 1.35)).toBe(1188);
    // A job booked under a different stored rate reprices by THAT rate.
    expect(paintingFinalAmount(1000, 1.5)).toBe(1500);
  });

  it("rounds to the cent", () => {
    expect(paintingFinalAmount(999.99, 1.35)).toBe(1349.99);
  });
});
