import { describe, it, expect } from "vitest";
import {
  computeBookingPrice,
  recurringDiscountPercent,
  recurrenceCount,
  nextOccurrence,
} from "@/lib/booking-pricing";
import { calculateTax } from "@/lib/tax";
import { CFG } from "./helpers";

// computeBookingPrice is async but takes an injectable config, so passing CFG
// keeps it hermetic (no getRuntimeConfig / DB).
const price = (input: Parameters<typeof computeBookingPrice>[0]) =>
  computeBookingPrice(input, CFG);

describe("computeBookingPrice — materials opt-in (SOP §4/§5)", () => {
  it("adds NO materials line when the customer provides their own", () => {
    // Even though TV mounting has a $49 materials cost, an unchecked box adds nothing.
    const r = price({
      hours: 2,
      serviceType: "TV_MOUNTING",
      addOns: [],
      customerRequestsMaterials: false,
    });
    return r.then((p) => {
      expect(p.materialsAmount).toBe(0);
      expect(p.materialsType).toBeNull();
      expect(p.basePrice).toBe(158); // 2h × 79
      expect(p.total).toBe(calculateTax(158).total);
    });
  });

  it("adds the service materials amount when the box is checked", async () => {
    const p = await price({
      hours: 2,
      serviceType: "TV_MOUNTING",
      addOns: [],
      customerRequestsMaterials: true,
    });
    expect(p.materialsAmount).toBe(49);
    expect(p.materialsType).toBe("cost");
    // subtotal = 158 labour + 49 materials = 207
    expect(p.subtotal).toBe(calculateTax(207).subtotal);
    expect(p.total).toBe(calculateTax(207).total);
  });

  it("AC installation adds NO materials line even when the box is checked", async () => {
    // SOP §5: AC installation has no automatic materials/equipment charge.
    const p = await price({
      hours: 3,
      serviceType: "AC_INSTALLATION",
      addOns: [],
      customerRequestsMaterials: true,
    });
    expect(p.materialsAmount).toBe(0);
    expect(p.materialsType).toBeNull();
    expect(p.basePrice).toBe(209); // 3h → package price, hourly labour
  });

  it("small paint repair adds the $49 cost when checked", async () => {
    const p = await price({
      hours: 2,
      serviceType: "SMALL_PAINT_REPAIR",
      addOns: [],
      customerRequestsMaterials: true,
    });
    expect(p.materialsAmount).toBe(49);
    expect(p.materialsType).toBe("cost");
  });
});

describe("computeBookingPrice — the painting $119 materials trace (9.3)", () => {
  // The $119 reject-refund relies on materialsAmount being PERSISTED at booking.
  // This traces the value from the catalog through pricing; submitBooking then
  // writes pricing.materialsAmount onto Job.materialsAmount.
  it("prices painting materials as a flat $119 CHARGE when the box is checked", async () => {
    const p = await price({
      hours: 3,
      serviceType: "PAINTING",
      addOns: [],
      customerRequestsMaterials: true,
    });
    expect(p.materialsAmount).toBe(119);
    expect(p.materialsType).toBe("charge"); // upfront, refundable on reject
    // Painting contributes no base labour price (the bid supplies it).
    expect(p.basePrice).toBe(0);
    // So the booked subtotal is just the $119 materials charge.
    expect(p.subtotal).toBe(calculateTax(119).subtotal);
  });

  it("adds NOTHING for painting when the customer declines materials", async () => {
    const p = await price({
      hours: 3,
      serviceType: "PAINTING",
      addOns: [],
      customerRequestsMaterials: false,
    });
    expect(p.materialsAmount).toBe(0);
    expect(p.materialsType).toBeNull();
  });
});

describe("computeBookingPrice — add-ons, travel, discount", () => {
  it("sums labour + add-ons + travel − discount, then taxes the lot", async () => {
    const p = await price({
      hours: 2,
      serviceType: "TV_MOUNTING",
      addOns: [
        { name: "Extra bracket", price: 20 },
        { name: "Cable tidy", price: 15 },
      ],
      travelFee: 10,
      discountAmount: 25,
      customerRequestsMaterials: false,
    });
    // 158 + 35 addons + 10 travel − 25 discount = 178 pre-tax
    expect(p.addOnTotal).toBe(35);
    expect(p.travelFee).toBe(10);
    expect(p.discountAmount).toBe(25);
    expect(p.subtotal).toBe(calculateTax(178).subtotal);
    expect(p.total).toBe(calculateTax(178).total);
  });

  it("never lets a large discount drive the price negative", async () => {
    const p = await price({
      hours: 2,
      serviceType: "TV_MOUNTING",
      addOns: [],
      discountAmount: 100000,
      customerRequestsMaterials: false,
    });
    expect(p.subtotal).toBe(0);
    expect(p.total).toBe(0);
  });
});

describe("recurring schedule helpers", () => {
  it("discounts 2nd+ weekly/biweekly visits, nothing else", () => {
    expect(recurringDiscountPercent("WEEKLY")).toBe(12);
    expect(recurringDiscountPercent("BIWEEKLY")).toBe(8);
    expect(recurringDiscountPercent("MONTHLY")).toBe(0);
    expect(recurringDiscountPercent("ONE_TIME")).toBe(0);
  });

  it("creates the right number of child occurrences", () => {
    expect(recurrenceCount("ONE_TIME")).toBe(0);
    expect(recurrenceCount("WEEKLY")).toBe(3);
    expect(recurrenceCount("MONTHLY")).toBe(2);
    expect(recurrenceCount("QUARTERLY")).toBe(1);
  });

  it("advances the date by the right interval", () => {
    // Day-delta with rounding, so a DST-observing CI timezone (nextOccurrence
    // uses local-time setDate) can't make an exact-timestamp assertion flake.
    const base = new Date("2026-07-13T09:00:00.000Z");
    const days = (d: Date) => Math.round((d.getTime() - base.getTime()) / 86_400_000);
    expect(days(nextOccurrence(base, "WEEKLY"))).toBe(7);
    expect(days(nextOccurrence(base, "BIWEEKLY"))).toBe(14);
    expect(nextOccurrence(base, "MONTHLY").getUTCMonth()).toBe(7); // August (0-indexed)
  });
});
