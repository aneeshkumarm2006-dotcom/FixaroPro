"use server";

// Live price for the booking wizard's hour/unit picker.
//
// Every branch used to be a hardcoded service name and a hardcoded number —
// `SILICONE_SEALING → rooms * 209`, `WEATHERPROOFING → 74.5`, `PAINTING |
// MOULDINGS → 0`. Adding a fixed-price service meant editing this file, and
// repricing one in the admin UI did nothing at all. It now switches on the
// service's configured pricing MODEL and reads its configured price, so both
// are ops work — and it agrees with computeBookingPrice by construction,
// because both call resolveBasePrice() against the same config.

import { getRuntimeConfig } from "@/lib/config/service-config";
import { findService, resolveBasePrice } from "@/lib/config/types";

interface GetQuoteInput {
  hours: number;
  serviceType?: string;
}

export async function getQuote({ hours, serviceType }: GetQuoteInput) {
  try {
    const cfg = await getRuntimeConfig();
    const model = findService(cfg, serviceType)?.pricing ?? "hourly";

    // Quote-only services (painting, mouldings): 0, so the UI shows "quote
    // required" rather than a number the customer would read as the price.
    if (model === "quote") {
      return { success: true, basePrice: 0, isQuote: true };
    }

    const basePrice = resolveBasePrice(cfg, hours, serviceType);

    if (model === "fixed") {
      return { success: true, basePrice, isFixed: true };
    }

    return {
      success: true,
      basePrice,
      hourlyRate: cfg.policy.labourRate,
      threeHourPackage: cfg.policy.threeHourPackage,
    };
  } catch (error) {
    console.error("Error fetching quote:", error);
    return { success: false, error: "Failed to compute quote" };
  }
}
