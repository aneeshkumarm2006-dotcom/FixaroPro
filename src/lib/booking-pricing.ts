import { db } from "@/db";
import { calculateTax, TaxBreakdown } from "./tax";

export interface PricingInput {
  bedCount: number;
  bathCount: number;
  addOns: { name: string; price: number }[];
  travelFee?: number;
  discountAmount?: number;
}

export interface PricingResult extends TaxBreakdown {
  basePrice: number;
  addOnTotal: number;
  travelFee: number;
  discountAmount: number;
}

// Server-side authoritative pricing. The client may show a preview from
// getQuote, but the final job total is always recomputed here from the
// PricingRule table and the resolved add-ons + travel fee.
export async function computeBookingPrice(
  input: PricingInput
): Promise<PricingResult> {
  const basePrice = await resolveBasePrice(input.bedCount, input.bathCount);
  const addOnTotal = input.addOns.reduce((s, a) => s + a.price, 0);
  const travelFee = input.travelFee ?? 0;
  const discountAmount = input.discountAmount ?? 0;

  const preTax = Math.max(
    0,
    basePrice + addOnTotal + travelFee - discountAmount
  );
  const tax = calculateTax(preTax);

  return {
    basePrice,
    addOnTotal,
    travelFee,
    discountAmount,
    ...tax,
  };
}

async function resolveBasePrice(
  bedCount: number,
  bathCount: number
): Promise<number> {
  const exact = await db.pricingRule.findFirst({
    where: { bedCount, bathCount, isActive: true },
  });
  if (exact) return exact.basePrice;

  const closest = await db.pricingRule.findFirst({
    where: { bedCount, isActive: true },
    orderBy: { bathCount: "desc" },
  });
  if (closest) return closest.basePrice;

  return 120 + bedCount * 30 + bathCount * 20;
}

// Returns the date for the next occurrence given a base date and frequency.
export function nextOccurrence(
  base: Date,
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY"
): Date {
  const d = new Date(base);
  switch (frequency) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "BIWEEKLY":
      d.setDate(d.getDate() + 14);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
  }
  return d;
}

// How many additional jobs to auto-create for recurring bookings.
// Per spec: 4 weeks of jobs for WEEKLY (4 more), 4 visits for BIWEEKLY (3 more).
export function recurrenceCount(
  frequency: "ONE_TIME" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY"
): number {
  switch (frequency) {
    case "WEEKLY":
      return 3;
    case "BIWEEKLY":
      return 3;
    case "MONTHLY":
      return 2;
    case "QUARTERLY":
      return 1;
    default:
      return 0;
  }
}
