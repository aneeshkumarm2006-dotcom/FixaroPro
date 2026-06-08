/**
 * Client-safe retention constants. Kept separate from retention.ts so the
 * admin RetentionTab (client component) can import the config shape + defaults
 * without pulling Prisma (@/db) into the browser bundle.
 */

/** AppSetting key the save-offer config is stored under. */
export const RETENTION_SETTING_KEY = "retention.save_offer";
export const RETENTION_SETTING_CATEGORY = "retention";

/** Don't send a second save offer to the same client within this window. */
export const RETENTION_COOLDOWN_DAYS = 30;

/** Frequencies considered "recurring" (a full-recurring cancel is eligible). */
export const RECURRING_FREQUENCIES = [
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "QUARTERLY",
] as const;

export interface SaveOfferConfig {
  enabled: boolean;
  offerType: "FIXED" | "PERCENT";
  offerValue: number;
  /** Days the minted promo code stays valid. */
  expiresInDays: number;
  headline: string;
  body: string;
  buttonLabel: string;
}

export const DEFAULT_SAVE_OFFER: SaveOfferConfig = {
  enabled: true,
  offerType: "PERCENT",
  offerValue: 20,
  expiresInDays: 30,
  headline: "We'd hate to see you go",
  body: "We noticed you cancelled your recurring service. As a thank-you for being a customer, here's a one-time offer on your next booking — we'd love to have you back.",
  buttonLabel: "Claim your offer",
};

/** Human label for an offer ("20% off" / "$20 off"). */
export function formatOffer(type: "FIXED" | "PERCENT", value: number): string {
  return type === "PERCENT" ? `${value}% off` : `$${value.toFixed(0)} off`;
}
