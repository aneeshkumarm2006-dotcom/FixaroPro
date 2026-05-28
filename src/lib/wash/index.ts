/**
 * Cleano Self-Wash System — projection, caps, and credit math.
 * Implements the rules in the Rag Wash System spec (Job-Based Model).
 *
 *  Projected rags  = 8 + (bedrooms × 4) + (bathrooms × 3) + add-on rag delta
 *  Projected pads  = 1 + add-on pad delta
 *  Capped against per-category hard caps (Studio 20/2, 1-2BR 30/3, 3+BR 35/4)
 *  Credits awarded = capped amounts (1 credit per rag, 2 credits per pad)
 *  Payouts:        50 rag credits → $3.00, 20 pad credits → $2.00
 */

export interface ProjectionInput {
  bedCount: number | null | undefined;
  bathCount: number | null | undefined;
  jobType?: string | null;
  addOnNames?: string[]; // case-insensitive substring matched
}

export interface ProjectionResult {
  /** Pre-cap projection from the formula. */
  projectedRags: number;
  projectedPads: number;
  /** Final amount after the per-category hard cap. */
  cappedRags: number;
  cappedPads: number;
  /** Which job category we used to apply the cap. */
  category: JobCategory;
  /** Did the projection hit the cap? Helps the admin auto-flag oversize jobs. */
  ragsHitCap: boolean;
  padsHitCap: boolean;
}

export type JobCategory = "STUDIO" | "ONE_TWO_BR" | "THREE_PLUS_BR" | "MOVE_IN";

interface AddOnRule {
  /** Case-insensitive substring patterns. Any match awards the delta. */
  patterns: string[];
  rags: number;
  pads: number;
}

const BASE_RAGS = 8;
const BASE_PADS = 1;

const ADD_ON_RULES: AddOnRule[] = [
  { patterns: ["oven"], rags: 3, pads: 0 },
  { patterns: ["fridge"], rags: 3, pads: 0 },
  { patterns: ["baseboard"], rags: 2, pads: 1 },
  { patterns: ["shower", "tile"], rags: 3, pads: 1 },
  { patterns: ["wall"], rags: 2, pads: 1 },
  { patterns: ["cabinet"], rags: 2, pads: 0 },
  { patterns: ["move-in", "move in", "movein"], rags: 5, pads: 1 },
  { patterns: ["couch", "upholstery", "sofa"], rags: 1, pads: 0 },
];

const CAPS: Record<JobCategory, { rags: number; pads: number }> = {
  STUDIO: { rags: 20, pads: 2 },
  ONE_TWO_BR: { rags: 30, pads: 3 },
  THREE_PLUS_BR: { rags: 35, pads: 4 },
  MOVE_IN: { rags: 35, pads: 4 },
};

/** Material credit rules (per spec §"Credit and Payout Model"). */
export const CREDIT_PER_RAG = 1;
export const CREDIT_PER_PAD = 2;
export const RAG_PAYOUT_THRESHOLD = 50;
export const PAD_PAYOUT_THRESHOLD = 20;
export const RAG_PAYOUT_AMOUNT = 3.0;
export const PAD_PAYOUT_AMOUNT = 2.0;

/** A job exceeding the projection by ≥10% should be flagged for review. */
export const OVER_PROJECTION_FLAG_PCT = 0.1;

function categorize(bedCount: number, jobType: string | null | undefined): JobCategory {
  const t = (jobType ?? "").toLowerCase();
  if (t.includes("move_in") || t.includes("move-in") || t.includes("move in") || t === "move_out" || t.includes("move_out")) {
    return "MOVE_IN";
  }
  if (bedCount <= 0) return "STUDIO";
  if (bedCount <= 2) return "ONE_TWO_BR";
  return "THREE_PLUS_BR";
}

function matchAddOn(name: string): AddOnRule | null {
  const lower = name.toLowerCase();
  return ADD_ON_RULES.find((r) => r.patterns.some((p) => lower.includes(p))) ?? null;
}

/**
 * Apply the spec formula + cap. Always returns sensible values for missing
 * inputs (treating null bed/bath as 0).
 */
export function projectWashables(input: ProjectionInput): ProjectionResult {
  const bedrooms = Math.max(0, input.bedCount ?? 0);
  const bathrooms = Math.max(0, input.bathCount ?? 0);

  let projectedRags = BASE_RAGS + bedrooms * 4 + bathrooms * 3;
  let projectedPads = BASE_PADS;

  for (const name of input.addOnNames ?? []) {
    const rule = matchAddOn(name);
    if (rule) {
      projectedRags += rule.rags;
      projectedPads += rule.pads;
    }
  }

  const category = categorize(bedrooms, input.jobType);
  const cap = CAPS[category];

  const cappedRags = Math.min(projectedRags, cap.rags);
  const cappedPads = Math.min(projectedPads, cap.pads);

  return {
    projectedRags,
    projectedPads,
    cappedRags,
    cappedPads,
    category,
    ragsHitCap: projectedRags > cap.rags,
    padsHitCap: projectedPads > cap.pads,
  };
}

/** How many `($amount, ragCreditsConsumed, padCreditsConsumed)` claim units
 *  are available right now given a ledger balance. */
export function availablePayout(rags: number, pads: number) {
  const ragUnits = Math.floor(rags / RAG_PAYOUT_THRESHOLD);
  const padUnits = Math.floor(pads / PAD_PAYOUT_THRESHOLD);
  const ragAmount = ragUnits * RAG_PAYOUT_AMOUNT;
  const padAmount = padUnits * PAD_PAYOUT_AMOUNT;
  return {
    ragUnits,
    padUnits,
    ragCreditsConsumed: ragUnits * RAG_PAYOUT_THRESHOLD,
    padCreditsConsumed: padUnits * PAD_PAYOUT_THRESHOLD,
    amount: ragAmount + padAmount,
  };
}

/** True if actual usage exceeded projection by ≥10%. Spec §"Verification". */
export function isOverProjection(
  actualRags: number | null | undefined,
  projectedRags: number | null | undefined
): boolean {
  if (!actualRags || !projectedRags) return false;
  return actualRags > projectedRags * (1 + OVER_PROJECTION_FLAG_PCT);
}
