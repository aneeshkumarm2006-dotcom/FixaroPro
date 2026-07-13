// Client-safe half of equipment readiness (SOP §3.3/§8/§11.1).
//
// The admin settings UI needs the setting key and the mode union; the logic in
// equipment-readiness.ts needs the database. Keeping the constants here means
// the client bundle never pulls in Prisma — same split as
// retention-constants.ts / retention.ts.

export const EQUIPMENT_READINESS_SETTING_KEY = "equipment.readinessMode";
export const EQUIPMENT_READINESS_SETTING_CATEGORY = "equipment";

/**
 * How equipment readiness is enforced (SOP §3.3: "Missing equipment produces a
 * clear blocking or warning flow as configured").
 *
 *  • "off"    — ignore readiness entirely; pure service eligibility.
 *  • "warn"   — notify/allow every eligible provider, but surface what they are
 *               missing on the notification and at claim time. DEFAULT (D6.1).
 *  • "strict" — additionally exclude providers we can positively prove are
 *               missing a tracked item, from targeting and from claiming.
 */
export type EquipmentReadinessMode = "off" | "warn" | "strict";

export const EQUIPMENT_READINESS_MODES: readonly EquipmentReadinessMode[] = [
  "off",
  "warn",
  "strict",
];

/**
 * D6.1 — default to reach over precision: "notify anyway, warn on claim".
 *
 * Readiness is unknowable for tools that are not in the product catalog (see
 * equipment-readiness.ts), so strict filtering buys precision only once ops
 * actually stock that catalog with tools. Until then the marketplace must not
 * be starved of notifications. Flipping to "strict" is a one-setting change on
 * Equipment Checklists — no deploy.
 */
export const DEFAULT_EQUIPMENT_READINESS_MODE: EquipmentReadinessMode = "warn";
