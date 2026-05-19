"use server";

import { db } from "@/db";

interface GetQuoteInput {
  bedCount: number;
  bathCount: number;
}

// Public — returns the base price from PricingRule. Falls back to a closest
// match (same beds, fewer baths, etc.) and finally a sensible default.
export async function getQuote({ bedCount, bathCount }: GetQuoteInput) {
  try {
    const exact = await db.pricingRule.findFirst({
      where: { bedCount, bathCount, isActive: true },
    });
    if (exact) return { success: true, basePrice: exact.basePrice };

    const closest = await db.pricingRule.findFirst({
      where: { bedCount, isActive: true },
      orderBy: { bathCount: "desc" },
    });
    if (closest) return { success: true, basePrice: closest.basePrice };

    // Fallback heuristic until admin sets up pricing rules.
    const fallback = 120 + bedCount * 30 + bathCount * 20;
    return { success: true, basePrice: fallback, fallback: true as const };
  } catch (error) {
    console.error("Error fetching quote:", error);
    return { success: false, error: "Failed to compute quote" };
  }
}
