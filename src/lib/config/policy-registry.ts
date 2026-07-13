// Policy / pricing settings registry (SOP §3, stage 8).
//
// SOP §2.3: "Every configurable rule should include a clear label, default
// value, help description, validation rule, audit log, and predictable behavior
// across customer, handyman, and admin surfaces."
//
// This module is that declaration, once, for every numeric policy value in the
// product. It is the single source of truth for:
//   • the AppSetting key each value is stored under,
//   • its default (imported from src/lib/policy.ts — still the seed defaults),
//   • its label + help text (rendered by the admin editor),
//   • its validation rule (enforced server-side in updatePolicySettings, and
//     again on import, so a bad export can never poison an environment).
//
// CLIENT-SAFE: no database import. Server code resolves values through
// getRuntimeConfig() (src/lib/config/service-config.ts); client components read
// them from the ServiceConfigProvider context.

import {
  ON_THE_WAY_ETA_MIN,
  ACCEPT_DECLINE_TIMEOUT_MIN,
  NO_SHOW_FEE_USD,
  LATE_PENALTY_GRACE_MIN,
  LATE_PENALTY_INITIAL_CAP,
  LATE_PENALTY_STEP_MIN,
  LATE_PENALTY_STEP_STARS,
  LAST_MINUTE_CLAIM_BONUS_USD,
  POOR_RATING_FOLLOWUP_STARS,
  DEFAULT_INVENTORY_LOW_STOCK,
  CANCELLATION_FEE_USD,
  CANCELLATION_FEE_WINDOW_HOURS,
  DEFAULT_LABOUR_RATE,
  DEFAULT_BILLING_INCREMENT_MIN,
  DEFAULT_MIN_BILLABLE_HOURS,
  BASE_BOOKING_DEPOSIT_USD,
} from "@/lib/policy";
import { THREE_HOUR_PACKAGE, MIN_HOURS } from "@/app/(book)/book/types";
import { PAINTING_SURPLUS_RATE } from "@/lib/painting";

/** The resolved policy values every consumer reads. */
export interface PolicyConfig {
  // Labour & billing (SOP §10)
  labourRate: number;
  threeHourPackage: number;
  minBookingHours: number;
  billingIncrementMinutes: number;
  minBillableHours: number;
  baseBookingDeposit: number;
  // Painting (SOP §6/§7)
  paintingSurplusRate: number;
  // Cancellation & no-show (SOP §4/§10)
  cancellationFee: number;
  cancellationWindowHours: number;
  noShowFee: number;
  lastMinuteClaimBonus: number;
  // Provider SOP knobs (§8)
  onTheWayEtaMin: number;
  acceptDeclineTimeoutMin: number;
  latePenaltyGraceMin: number;
  latePenaltyInitialCap: number;
  latePenaltyStepMin: number;
  latePenaltyStepStars: number;
  poorRatingFollowupStars: number;
  // Inventory
  defaultInventoryLowStock: number;
}

export type PolicyField = keyof PolicyConfig;

export type PolicyGroup =
  | "Labour & billing"
  | "Painting"
  | "Cancellation & no-show"
  | "Provider SOP"
  | "Inventory";

export interface PolicySettingDef {
  /** AppSetting.key this value is persisted under. */
  key: string;
  /** AppSetting.category — also selects which rows the export bundle picks up. */
  category: string;
  field: PolicyField;
  group: PolicyGroup;
  label: string;
  help: string;
  /** Rendered next to the input, e.g. "$", "hours", "min". */
  unit: string;
  default: number;
  min: number;
  max: number;
  step: number;
  /** Whole numbers only (minutes, hours, counts). */
  integer?: boolean;
  /**
   * Legacy location the value may already be saved under, as
   * `pricing.perUnit.<prop>`. Read as a fallback so an admin-saved value is
   * never silently lost when a key is canonicalised (the D1.1 pattern).
   */
  legacyPerUnitProp?: string;
}

/**
 * Every configurable policy value, in admin-editor display order.
 *
 * NB the three billing keys (`pricing.labourRate`, `pricing.billingIncrementMinutes`,
 * `pricing.minBillableHours`) are the SAME keys Stage 1 established and
 * getBillingConfig() already reads — this registry adopts them rather than
 * introducing a second spelling.
 */
export const POLICY_SETTINGS: readonly PolicySettingDef[] = [
  // ── Labour & billing ─────────────────────────────────────────────────────
  {
    key: "pricing.labourRate",
    category: "pricing",
    field: "labourRate",
    group: "Labour & billing",
    label: "Hourly labour rate",
    help: "Charged per billable hour on every hourly service (SOP §10). Drives both the booking estimate and the final clocked charge.",
    unit: "$/hr",
    default: DEFAULT_LABOUR_RATE,
    min: 1,
    max: 1000,
    step: 1,
    legacyPerUnitProp: "hourlyRate",
  },
  {
    key: "pricing.threeHourPackage",
    category: "pricing",
    field: "threeHourPackage",
    group: "Labour & billing",
    label: "3-hour package price",
    help: "Flat discounted price when billable hours land on exactly 3. Applied at booking AND at final billing, so a job clocked to 3h still gets the package (D0.7).",
    unit: "$",
    default: THREE_HOUR_PACKAGE,
    min: 0,
    max: 10000,
    step: 1,
    legacyPerUnitProp: "threeHourPackage",
  },
  {
    key: "pricing.minBookingHours",
    category: "pricing",
    field: "minBookingHours",
    group: "Labour & billing",
    label: "Minimum booking hours",
    help: "Fewest hours a customer can book on an hourly service.",
    unit: "hours",
    default: MIN_HOURS,
    min: 0.5,
    max: 24,
    step: 0.5,
  },
  {
    key: "pricing.billingIncrementMinutes",
    category: "pricing",
    field: "billingIncrementMinutes",
    group: "Labour & billing",
    label: "Billing round-up increment",
    help: "Clocked duration rounds UP to the next multiple of this before billing (D0.8).",
    unit: "min",
    default: DEFAULT_BILLING_INCREMENT_MIN,
    min: 1,
    max: 120,
    step: 1,
    integer: true,
  },
  {
    key: "pricing.minBillableHours",
    category: "pricing",
    field: "minBillableHours",
    group: "Labour & billing",
    label: "Minimum billable hours",
    help: "Floor applied after rounding, so a 40-minute job still bills the minimum (D0.8). Matches the booking minimum the customer accepted at checkout.",
    unit: "hours",
    default: DEFAULT_MIN_BILLABLE_HOURS,
    min: 0,
    max: 24,
    step: 0.5,
  },
  {
    key: "pricing.baseBookingDeposit",
    category: "pricing",
    field: "baseBookingDeposit",
    group: "Labour & billing",
    label: "Base booking deposit",
    help: "Captured at checkout on any booking that has no upfront materials deposit or charge of its own. Credited against the final bill.",
    unit: "$",
    default: BASE_BOOKING_DEPOSIT_USD,
    min: 0,
    max: 1000,
    step: 1,
  },

  // ── Painting ─────────────────────────────────────────────────────────────
  {
    key: "painting.surplusRate",
    category: "painting",
    field: "paintingSurplusRate",
    group: "Painting",
    label: "Painting surplus multiplier",
    help: "Applied to the internal cost baseline to produce the customer quote range, and to the accepted bid to produce the final offer (SOP §6/§7 — 35% surplus ⇒ 1.35). Existing painting jobs keep the rate stored on the job.",
    unit: "×",
    default: PAINTING_SURPLUS_RATE,
    min: 1,
    max: 5,
    step: 0.01,
  },

  // ── Cancellation & no-show ───────────────────────────────────────────────
  {
    key: "policy.cancellationFee",
    category: "policy",
    field: "cancellationFee",
    group: "Cancellation & no-show",
    label: "Late-cancellation fee",
    help: "Charged when a booking is cancelled inside the window below (SOP §4/§10). Also the fee deducted from a provider's payout for a late shift cancellation.",
    unit: "$",
    default: CANCELLATION_FEE_USD,
    min: 0,
    max: 1000,
    step: 1,
  },
  {
    key: "policy.cancellationWindowHours",
    category: "policy",
    field: "cancellationWindowHours",
    group: "Cancellation & no-show",
    label: "Late-cancellation window",
    help: "Hours before the booking start inside which the cancellation fee applies. Outside the window, cancelling is free.",
    unit: "hours",
    default: CANCELLATION_FEE_WINDOW_HOURS,
    min: 0,
    max: 168,
    step: 1,
    integer: true,
  },
  {
    key: "policy.noShowFee",
    category: "policy",
    field: "noShowFee",
    group: "Cancellation & no-show",
    label: "Customer no-show fee",
    help: "Charged to the customer when the provider reports a no-show at the door.",
    unit: "$",
    default: NO_SHOW_FEE_USD,
    min: 0,
    max: 1000,
    step: 1,
  },
  {
    key: "policy.lastMinuteClaimBonus",
    category: "policy",
    field: "lastMinuteClaimBonus",
    group: "Cancellation & no-show",
    label: "Last-minute claim bonus",
    help: "Paid to whichever provider claims a job that was reassigned at the last minute.",
    unit: "$",
    default: LAST_MINUTE_CLAIM_BONUS_USD,
    min: 0,
    max: 1000,
    step: 1,
  },

  // ── Provider SOP ─────────────────────────────────────────────────────────
  {
    key: "policy.onTheWayEtaMin",
    category: "policy",
    field: "onTheWayEtaMin",
    group: "Provider SOP",
    label: "\"On the way\" ETA threshold",
    help: "Fires the customer's \"your handyman is on the way\" notification once the provider's ETA drops below this.",
    unit: "min",
    default: ON_THE_WAY_ETA_MIN,
    min: 1,
    max: 120,
    step: 1,
    integer: true,
  },
  {
    key: "policy.acceptDeclineTimeoutMin",
    category: "policy",
    field: "acceptDeclineTimeoutMin",
    group: "Provider SOP",
    label: "Accept / decline timeout",
    help: "How long a newly assigned provider has to accept before the job is auto-released back to the unassigned pool.",
    unit: "min",
    default: ACCEPT_DECLINE_TIMEOUT_MIN,
    min: 1,
    max: 1440,
    step: 1,
    integer: true,
  },
  {
    key: "policy.latePenaltyGraceMin",
    category: "policy",
    field: "latePenaltyGraceMin",
    group: "Provider SOP",
    label: "Late-arrival grace period",
    help: "Minutes past the start time before the provider's rating cap starts applying. Under this, no cap.",
    unit: "min",
    default: LATE_PENALTY_GRACE_MIN,
    min: 0,
    max: 240,
    step: 1,
    integer: true,
  },
  {
    key: "policy.latePenaltyInitialCap",
    category: "policy",
    field: "latePenaltyInitialCap",
    group: "Provider SOP",
    label: "Late-arrival initial star cap",
    help: "Maximum rating the provider can earn on a job once the grace period is exceeded.",
    unit: "stars",
    default: LATE_PENALTY_INITIAL_CAP,
    min: 0.5,
    max: 5,
    step: 0.5,
  },
  {
    key: "policy.latePenaltyStepMin",
    category: "policy",
    field: "latePenaltyStepMin",
    group: "Provider SOP",
    label: "Late-arrival penalty step",
    help: "Each additional window of this many minutes late drops the star cap by the amount below.",
    unit: "min",
    default: LATE_PENALTY_STEP_MIN,
    min: 1,
    max: 120,
    step: 1,
    integer: true,
  },
  {
    key: "policy.latePenaltyStepStars",
    category: "policy",
    field: "latePenaltyStepStars",
    group: "Provider SOP",
    label: "Late-arrival penalty per step",
    help: "Stars deducted from the cap per late step. The cap floors at 0.5.",
    unit: "stars",
    default: LATE_PENALTY_STEP_STARS,
    min: 0,
    max: 5,
    step: 0.5,
  },
  {
    key: "policy.poorRatingFollowupStars",
    category: "policy",
    field: "poorRatingFollowupStars",
    group: "Provider SOP",
    label: "Poor-rating follow-up threshold",
    help: "A customer rating at or below this triggers the \"we want to make it right\" email and an admin alert.",
    unit: "stars",
    default: POOR_RATING_FOLLOWUP_STARS,
    min: 0,
    max: 5,
    step: 0.5,
  },

  // ── Inventory ────────────────────────────────────────────────────────────
  {
    key: "policy.defaultInventoryLowStock",
    category: "policy",
    field: "defaultInventoryLowStock",
    group: "Inventory",
    label: "Default low-stock threshold",
    help: "Applied to a product that has no threshold of its own.",
    unit: "units",
    default: DEFAULT_INVENTORY_LOW_STOCK,
    min: 0,
    max: 10000,
    step: 1,
    integer: true,
  },
] as const;

export const POLICY_GROUPS: readonly PolicyGroup[] = [
  "Labour & billing",
  "Painting",
  "Cancellation & no-show",
  "Provider SOP",
  "Inventory",
] as const;

/** Registry defaults, as a resolved config. Used whenever the DB has no row. */
export const DEFAULT_POLICY: PolicyConfig = POLICY_SETTINGS.reduce(
  (acc, def) => ({ ...acc, [def.field]: def.default }),
  {} as PolicyConfig
);

export function policyDefByKey(key: string): PolicySettingDef | undefined {
  return POLICY_SETTINGS.find((d) => d.key === key);
}

/** The legacy `pricing.perUnit` blob the Pricing settings tab writes into. */
export const LEGACY_PER_UNIT_KEY = "pricing.perUnit";

/**
 * Validate one policy value against its declared rule (SOP §2.3). Returns null
 * when valid, else the reason. Enforced by updatePolicySettings AND by config
 * import, so a hand-edited export can never write an out-of-range fee.
 */
export function validatePolicyValue(
  def: PolicySettingDef,
  value: unknown
): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${def.label} must be a number.`;
  }
  if (def.integer && !Number.isInteger(value)) {
    return `${def.label} must be a whole number.`;
  }
  if (value < def.min || value > def.max) {
    return `${def.label} must be between ${def.min} and ${def.max}.`;
  }
  return null;
}

/** Coerce an AppSetting value that may be a bare number or `{ rate }`/`{ value }`. */
export function numFromSetting(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object") {
    for (const k of ["rate", "value"]) {
      const r = (v as Record<string, unknown>)[k];
      if (typeof r === "number" && Number.isFinite(r)) return r;
    }
  }
  return null;
}

export interface AppSettingLike {
  key: string;
  value: unknown;
}

/**
 * Resolve the full policy config from raw AppSetting rows. Pure — no DB — so
 * the same function serves the server loader, the import dry-run diff and any
 * test. Per key: canonical row → legacy `pricing.perUnit.<prop>` → default.
 *
 * A row that fails its own validation rule is IGNORED in favour of the default
 * rather than trusted: a corrupt row must not be able to make the labour rate 0.
 */
export function resolvePolicy(rows: readonly AppSettingLike[]): PolicyConfig {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const perUnit = byKey.get(LEGACY_PER_UNIT_KEY) as
    | Record<string, unknown>
    | undefined;

  const out = {} as PolicyConfig;
  for (const def of POLICY_SETTINGS) {
    const candidates: unknown[] = [byKey.get(def.key)];
    if (def.legacyPerUnitProp && perUnit && typeof perUnit === "object") {
      candidates.push(perUnit[def.legacyPerUnitProp]);
    }
    let resolved: number | null = null;
    for (const c of candidates) {
      const n = numFromSetting(c);
      if (n != null && validatePolicyValue(def, n) == null) {
        resolved = n;
        break;
      }
    }
    out[def.field] = resolved ?? def.default;
  }
  return out;
}
