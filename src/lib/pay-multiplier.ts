export const PAY_MULTIPLIER_TIERS: Array<{
  min: number;
  multiplier: number;
  label: string;
}> = [
  { min: 5.0, multiplier: 1.25, label: "Elite" },
  { min: 4.7, multiplier: 1.18, label: "Top" },
  { min: 4.5, multiplier: 1.13, label: "Excellent" },
  { min: 4.0, multiplier: 1.0, label: "Standard" },
  { min: 0, multiplier: 0.9, label: "Probation" },
];

export function multiplierForRating(avg: number): {
  multiplier: number;
  label: string;
} {
  for (const t of PAY_MULTIPLIER_TIERS) {
    if (avg >= t.min) return { multiplier: t.multiplier, label: t.label };
  }
  return { multiplier: 0.9, label: "Probation" };
}
