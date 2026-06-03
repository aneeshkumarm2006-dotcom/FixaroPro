"use server";

import { HOURLY_RATE, THREE_HOUR_PACKAGE, computeHourlyPrice } from "../book/types";

interface GetQuoteInput {
  hours: number;
  serviceType?: string;
}

export async function getQuote({ hours, serviceType }: GetQuoteInput) {
  try {
    // Silicone Sealing: $209/room (hours field is reused as room count)
    if (serviceType === "SILICONE_SEALING") {
      const rooms = Math.max(1, hours);
      return { success: true, basePrice: rooms * 209, isFixed: true };
    }

    // Weatherproofing: fixed range, show midpoint for display
    if (serviceType === "WEATHERPROOFING") {
      return { success: true, basePrice: 74.5, isFixed: true };
    }

    // Quote-only services: return 0 so UI can show "quote required"
    if (serviceType === "PAINTING" || serviceType === "MOULDINGS") {
      return { success: true, basePrice: 0, isQuote: true };
    }

    // Standard hourly: 2h min, 3h package = $209, others = hours × $79
    const safeHours = Math.max(2, hours);
    const basePrice = computeHourlyPrice(safeHours);
    return { success: true, basePrice, hourlyRate: HOURLY_RATE, threeHourPackage: THREE_HOUR_PACKAGE };
  } catch (error) {
    console.error("Error fetching quote:", error);
    return { success: false, error: "Failed to compute quote" };
  }
}
