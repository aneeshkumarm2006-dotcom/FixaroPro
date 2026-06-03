import { calculateTax, TaxBreakdown } from "./tax";
import { computeHourlyPrice } from "@/app/(book)/book/types";

export interface PricingInput {
  hours: number;
  serviceType?: string;
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

export async function computeBookingPrice(
  input: PricingInput
): Promise<PricingResult> {
  const basePrice = resolveBasePrice(input.hours, input.serviceType);
  const addOnTotal = input.addOns.reduce((s, a) => s + a.price, 0);
  const travelFee = input.travelFee ?? 0;
  const discountAmount = input.discountAmount ?? 0;

  const preTax = Math.max(0, basePrice + addOnTotal + travelFee - discountAmount);
  const tax = calculateTax(preTax);

  return { basePrice, addOnTotal, travelFee, discountAmount, ...tax };
}

function resolveBasePrice(hours: number, serviceType?: string): number {
  if (serviceType === "SILICONE_SEALING") {
    return Math.max(1, hours) * 209;
  }
  if (serviceType === "WEATHERPROOFING") {
    return 74.5;
  }
  if (serviceType === "PAINTING" || serviceType === "MOULDINGS") {
    return 0;
  }
  return computeHourlyPrice(Math.max(2, hours));
}

// Returns the recurring discount percentage for the 2nd+ visit.
export function recurringDiscountPercent(
  frequency: "ONE_TIME" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY"
): number {
  switch (frequency) {
    case "WEEKLY":
      return 12;
    case "BIWEEKLY":
      return 8;
    default:
      return 0;
  }
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
