// Pay multipliers are configured per 0.1 rating step across the 4.0–5.0 scale.
// This module is pure (no DB / server imports) so it is safe to import from
// client components. The configured values are loaded server-side via
// getRatingMultiplierMap() in pay-multiplier-config.ts.

export type RatingMultiplierMap = Record<string, number>;

// Every 0.1 step from 4.0 to 5.0, lowest to highest.
export const RATING_STEPS: string[] = Array.from({ length: 11 }, (_, i) =>
  (4 + i * 0.1).toFixed(1)
);

// Sensible default ramp from 1.00x at 4.0 up to 1.25x at 5.0. Admins can edit
// these in Settings → Pay Rate Multipliers.
export const DEFAULT_RATING_MULTIPLIERS: RatingMultiplierMap = {
  "4.0": 1.0,
  "4.1": 1.03,
  "4.2": 1.05,
  "4.3": 1.08,
  "4.4": 1.1,
  "4.5": 1.13,
  "4.6": 1.15,
  "4.7": 1.18,
  "4.8": 1.2,
  "4.9": 1.23,
  "5.0": 1.25,
};

// Floors an average rating to its 0.1 step within the 4.0–5.0 band.
export function ratingStepFor(avg: number): string {
  const clamped = Math.min(5, Math.max(4, avg));
  return (Math.floor(clamped * 10) / 10).toFixed(1);
}

export function multiplierForRating(
  avg: number,
  map: RatingMultiplierMap = DEFAULT_RATING_MULTIPLIERS
): { multiplier: number; label: string } {
  const step = ratingStepFor(avg);
  const multiplier = map[step] ?? DEFAULT_RATING_MULTIPLIERS[step] ?? 1;
  return { multiplier, label: step };
}
