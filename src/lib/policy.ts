/**
 * Fixaro policy constants — the SEED DEFAULTS for the config layer (SOP §3).
 *
 * As of Stage 8 these are no longer read directly by feature code. Each value is
 * declared in src/lib/config/policy-registry.ts with a key, label, help text and
 * validation rule, persisted as an AppSetting, and resolved at runtime through
 * getRuntimeConfig() (server) or the ServiceConfigProvider context (client).
 * The constants below remain the value used when no row exists yet, and the
 * value an environment resets to.
 *
 * So: change a number HERE to move the default; change it in the admin Service
 * Catalog → Policy editor to move a running environment.
 */

/** Trigger the "cleaner on the way" notification when ETA drops below this. */
export const ON_THE_WAY_ETA_MIN = 15;

/** A newly assigned cleaner has this many minutes to accept or decline before
 *  the job is auto-released back to the unassigned folder. */
export const ACCEPT_DECLINE_TIMEOUT_MIN = 10;

/** No-show penalty charged to the customer when the cleaner reports a no-show. */
export const NO_SHOW_FEE_USD = 25;

/** Auto-rating posted on the cleaner's job when the customer is a no-show. */
export const NO_SHOW_AUTO_STAR = 1;

/** Minutes past start time before the cleaner late-penalty starts applying. */
export const LATE_PENALTY_GRACE_MIN = 10;

/** Star cap once the grace window is exceeded (4 stars max for that job). */
export const LATE_PENALTY_INITIAL_CAP = 4;

/** Additional half-star penalty for each window of this many minutes. */
export const LATE_PENALTY_STEP_MIN = 5;
export const LATE_PENALTY_STEP_STARS = 0.5;

/** The four late-arrival knobs, as resolved from config. */
export interface LateArrivalPolicy {
  latePenaltyGraceMin: number;
  latePenaltyInitialCap: number;
  latePenaltyStepMin: number;
  latePenaltyStepStars: number;
}

const DEFAULT_LATE_ARRIVAL: LateArrivalPolicy = {
  latePenaltyGraceMin: LATE_PENALTY_GRACE_MIN,
  latePenaltyInitialCap: LATE_PENALTY_INITIAL_CAP,
  latePenaltyStepMin: LATE_PENALTY_STEP_MIN,
  latePenaltyStepStars: LATE_PENALTY_STEP_STARS,
};

/**
 * Compute the provider's maximum possible rating for this job based on how
 * many minutes late they were. Returns null when no cap applies (under the
 * grace window). Floors at 0.5 so the cap stays representable.
 *
 * With the default knobs:
 *   <= 10 min late → no cap
 *   10 min        → 4.0
 *   15 min        → 3.5
 *   20 min        → 3.0
 *   ...
 *
 * `policy` comes from getRuntimeConfig().policy at the call site; it defaults to
 * the seed constants so a caller with no config still behaves as before.
 */
export function computeLateArrivalRatingCap(
  minutesLate: number,
  policy: LateArrivalPolicy = DEFAULT_LATE_ARRIVAL
): number | null {
  if (minutesLate < policy.latePenaltyGraceMin) return null;
  // A zero/negative step would divide by zero and produce an infinite penalty —
  // treat it as "one flat cap, no escalation" rather than crashing the clock-in.
  const stepsBeyond =
    policy.latePenaltyStepMin > 0
      ? Math.floor(
          (minutesLate - policy.latePenaltyGraceMin) / policy.latePenaltyStepMin
        )
      : 0;
  const cap =
    policy.latePenaltyInitialCap - stepsBeyond * policy.latePenaltyStepStars;
  return Math.max(0.5, cap);
}

/** Bonus paid to whichever cleaner claims a last-minute reassigned job. */
export const LAST_MINUTE_CLAIM_BONUS_USD = 10;

/** Rating threshold below which the "we want to make it right" follow-up
 *  email + admin alert are triggered. */
export const POOR_RATING_FOLLOWUP_STARS = 1;

/** Default low-stock threshold applied to a product if none is set. */
export const DEFAULT_INVENTORY_LOW_STOCK = 10;

/** Fee charged to the customer when they cancel inside the late-cancellation
 *  window below (SOP §4/§10: $25 within 24h). */
export const CANCELLATION_FEE_USD = 25;
/** Hours before the booking start time inside which a cancellation incurs the
 *  late-cancellation fee (SOP §4/§10). */
export const CANCELLATION_FEE_WINDOW_HOURS = 24;

/** Default hourly labour rate (SOP §10). Admin-configurable via AppSetting
 *  `pricing.labourRate` — see getLabourRate() in src/lib/billing.ts. */
export const DEFAULT_LABOUR_RATE = 79;

/**
 * Default hourly PAY rate for a provider (what Fixaro pays the crew per clocked
 * hour). Admin-configurable via AppSetting `pay.providerHourlyRate`.
 *
 * This is deliberately NOT `DEFAULT_LABOUR_RATE` — that is the CLIENT-facing
 * billing rate ($79/hr, what the customer is charged). Never use the client rate
 * as provider pay. Resolution order for an actual payout is
 * `Job.providerHourlyRate ?? User.hourlyRate ?? this default`.
 */
export const DEFAULT_PROVIDER_HOURLY_RATE = 25;

/** Deposit captured at checkout on a booking that has no upfront materials
 *  deposit/charge of its own, and credited against the final bill. Was
 *  hardcoded as a bare `20` in charge-deposit, submitBooking and
 *  billing.depositCollected — the three now agree via config. */
export const BASE_BOOKING_DEPOSIT_USD = 20;

/** Billable hours are rounded UP to this increment before charging (SOP §10,
 *  decision D0.8). Admin-configurable via AppSetting `pricing.billingIncrementMinutes`. */
export const DEFAULT_BILLING_INCREMENT_MIN = 15;
/** Minimum billable hours on an hourly job (SOP §10, decision D0.8 — matches the
 *  2-hour booking minimum). Admin-configurable via AppSetting `pricing.minBillableHours`. */
export const DEFAULT_MIN_BILLABLE_HOURS = 2;

/**
 * After-photo consent shown at booking. Cleaners may only photograph the
 * finished work when the customer consented (or an admin overrides). Bump
 * the version whenever the wording materially changes so we record which
 * version each customer agreed to.
 */
export const AFTER_PHOTO_CONSENT_VERSION = "v1";
export const AFTER_PHOTO_CONSENT_TEXT =
  "I consent to the cleaning team taking photos of the finished work for quality assurance and to confirm the service was completed. Photos are stored securely and are never shared publicly without my permission.";
