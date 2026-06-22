// Painting quote-range baselines and surplus logic (SOP §6/§7).
//
// The amounts below are INTERNAL company cost baselines. Customer-facing quote
// ranges add a 35% surplus before display. These ranges are for immediate
// online quoting only — the authoritative final price is the accepted (lowest
// valid) provider bid × the same surplus, sent to the client for approval.

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

// §7 internal cost baselines. Editable here; surplus applied at display time.
export const PAINTING_SCOPES: PaintingScope[] = [
  { key: "small_room", label: "Small room", baselineMin: 700, baselineMax: 900, note: "2 coats, work + paint included. Primer extra if required." },
  { key: "medium_room", label: "Medium room", baselineMin: 900, baselineMax: 1100, note: "2 coats, work + paint included. Primer extra if required." },
  { key: "large_room", label: "Large room", baselineMin: 1200, baselineMax: 1400, note: "2 coats, work + paint included. Primer extra if required." },
  { key: "bathroom", label: "Average bathroom", baselineMin: 500, baselineMax: 700, note: "2 coats, work + paint included." },
  { key: "studio", label: "Studio / small apartment", baselineMin: 700, baselineMax: 945, note: "If paint is already on-site, quote may be lower." },
  { key: "apt_3_5", label: "3½ apartment", baselineMin: 2000, baselineMax: 2350, note: "Includes optional paint/plaster/silicone add-on." },
  { key: "apt_4_5", label: "4½ apartment", baselineMin: 2500, baselineMax: 2900, note: "Includes optional paint/plaster/silicone add-on." },
  { key: "apt_5_5", label: "5½ apartment", baselineMin: 3000, baselineMax: 3600, note: "Includes optional paint/plaster/silicone add-on." },
];

export function getPaintingScope(key?: string | null): PaintingScope | null {
  if (!key) return null;
  return PAINTING_SCOPES.find((s) => s.key === key) ?? null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Immediate customer-facing quote range for a scope = baseline × surplus.
export function paintingQuoteRange(
  key?: string | null
): { min: number; max: number } | null {
  const scope = getPaintingScope(key);
  if (!scope) return null;
  return {
    min: round2(scope.baselineMin * PAINTING_SURPLUS_RATE),
    max: round2(scope.baselineMax * PAINTING_SURPLUS_RATE),
  };
}

// Authoritative final amount sent to the client = accepted bid × surplus.
export function paintingFinalAmount(
  acceptedBid: number,
  surplusRate: number = PAINTING_SURPLUS_RATE
): number {
  return round2(acceptedBid * surplusRate);
}
