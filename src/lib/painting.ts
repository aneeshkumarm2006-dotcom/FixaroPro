// Painting quote-range baselines and surplus logic (SOP §6/§7).
//
// The amounts below are INTERNAL company cost baselines. Customer-facing quote
// ranges add a 35% surplus before display. These ranges are for immediate
// online quoting only — the authoritative final price is the accepted (lowest
// valid) provider bid × the same surplus, sent to the client for approval.
//
// SEED DEFAULTS ONLY (SOP §3, stage 8). The live baselines are the
// PaintingBaseline table and the live surplus is the `painting.surplusRate`
// policy value; these seed both and are the fallback while the table is empty.
// Feature code must resolve them through getRuntimeConfig() / useRuntimeConfig()
// and the helpers in src/lib/config/types.ts, so that an admin repricing a scope
// actually moves the customer's quote.

/** Seed default for the `painting.surplusRate` policy value (SOP §6/§7 — 35%). */
export const PAINTING_SURPLUS_RATE = 1.35;

export interface PaintingScope {
  key: string;
  label: string;
  // Internal baseline range (CAD). For rooms: normal → "lots of plaster".
  // For apartments: base → base + paint/plaster/silicone add-on.
  baselineMin: number;
  baselineMax: number;
  note?: string;
}

// §7 internal cost baselines (PRE-surplus). Surplus is applied at display time,
// so these MUST be the raw baselines — never a post-surplus figure. Ranges run
// normal condition → "lots of plaster". Labour/work only: per v4.2 the client
// always provides the paint (Fixaro does not supply or pick up paint), and
// primer, if required, is client-provided or an admin-approved extra.
export const PAINTING_SCOPES: PaintingScope[] = [
  { key: "small_room", label: "Small room", baselineMin: 700, baselineMax: 900, note: "2 coats, labour only. You provide the paint. Primer extra if required." },
  { key: "medium_room", label: "Medium room", baselineMin: 900, baselineMax: 1100, note: "2 coats, labour only. You provide the paint. Primer extra if required." },
  { key: "large_room", label: "Large room", baselineMin: 1200, baselineMax: 1400, note: "2 coats, labour only. You provide the paint. Primer extra if required." },
  { key: "bathroom", label: "Average bathroom", baselineMin: 500, baselineMax: 700, note: "2 coats, labour only. You provide the paint. Primer extra if required." },
  // §7: studio / small apartment is a single $700 baseline (displays $945), not a range.
  { key: "studio", label: "Studio / small apartment", baselineMin: 700, baselineMax: 700, note: "2 coats, labour only. You provide the paint. Primer extra if required." },
  { key: "apt_3_5", label: "3½ apartment", baselineMin: 2000, baselineMax: 2350, note: "2 coats, labour only. You provide the paint. Primer extra if required. Includes optional plaster/silicone add-on." },
  { key: "apt_4_5", label: "4½ apartment", baselineMin: 2500, baselineMax: 2900, note: "2 coats, labour only. You provide the paint. Primer extra if required. Includes optional plaster/silicone add-on." },
  { key: "apt_5_5", label: "5½ apartment", baselineMin: 3000, baselineMax: 3600, note: "2 coats, labour only. You provide the paint. Primer extra if required. Includes optional plaster/silicone add-on." },
];

/**
 * Look up a scope in the SEED DEFAULTS.
 *
 * @deprecated Reads the TS constants, not the admin-editable PaintingBaseline
 * table. Use `findPaintingScope(cfg, key)` from src/lib/config/types.ts.
 */
export function getPaintingScope(key?: string | null): PaintingScope | null {
  if (!key) return null;
  return PAINTING_SCOPES.find((s) => s.key === key) ?? null;
}

/**
 * Authoritative final amount sent to the client = accepted bid × surplus.
 *
 * Re-exported from the shared config helpers so there is exactly one
 * implementation. The surplus rate is REQUIRED here on purpose: a painting job
 * stores the rate it was booked under (`Job.paintingSurplusRate`), and an admin
 * changing the policy value must not silently reprice a job already mid-bid.
 * Callers pass `job.paintingSurplusRate ?? cfg.policy.paintingSurplusRate`.
 */
export { paintingFinalAmount } from "@/lib/config/types";
