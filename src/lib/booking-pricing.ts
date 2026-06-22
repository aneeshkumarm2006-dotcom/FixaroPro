import { calculateTax, TaxBreakdown } from "./tax";
import {
  computeHourlyPrice,
  getMaterialsPricing,
  type MaterialsType,
} from "@/app/(book)/book/types";

export interface PricingInput {
  hours: number;
  serviceType?: string;
  addOns: { name: string; price: number }[];
  travelFee?: number;
  discountAmount?: number;
  // SOP §4/§5: customer chose "Fixaro provides all materials and equipment".
  customerRequestsMaterials?: boolean;
}

export interface PricingResult extends TaxBreakdown {
  basePrice: number;
  addOnTotal: number;
  travelFee: number;
  discountAmount: number;
  // Materials/equipment line (0 when the customer provides their own).
  materialsAmount: number;
  materialsType: MaterialsType | null;
}

export async function computeBookingPrice(
  input: PricingInput
): Promise<PricingResult> {
  const basePrice = resolveBasePrice(input.hours, input.serviceType);
  const addOnTotal = input.addOns.reduce((s, a) => s + a.price, 0);
  const travelFee = input.travelFee ?? 0;
  const discountAmount = input.discountAmount ?? 0;

  // Materials/equipment charge or deposit applies only when the customer
  // opts in (all-or-nothing). Deposits are still part of the amount due now.
  const materials = input.customerRequestsMaterials
    ? getMaterialsPricing(input.serviceType)
    : null;
  const materialsAmount = materials?.amount ?? 0;
  const materialsType = materials?.type ?? null;

  const preTax = Math.max(
    0,
    basePrice + addOnTotal + materialsAmount + travelFee - discountAmount
  );
  const tax = calculateTax(preTax);

  return {
    basePrice,
    addOnTotal,
    travelFee,
    discountAmount,
    materialsAmount,
    materialsType,
    ...tax,
  };
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
