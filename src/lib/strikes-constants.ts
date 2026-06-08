/**
 * Client-safe strike constants + helpers. Kept separate from strikes.ts so
 * client components (StrikesPanel, CleanerDashboard banner) can import labels
 * and the threshold without pulling Prisma (@/db) into the browser bundle.
 */

/** Active strikes within the rolling window that trip accountability action. */
export const STRIKE_THRESHOLD = 3;

/** Rolling window (days) over which active strikes are counted. */
export const STRIKE_WINDOW_DAYS = 30;

/** Minutes late at clock-in that auto-issue a LATE_ARRIVAL strike. */
export const STRIKE_LATE_ARRIVAL_MIN = 45;

/** A refund at/above this fraction of the job price auto-issues a strike. */
export const STRIKE_REFUND_FRACTION = 0.5;

/** Stars below this on two consecutive ratings auto-issues a LOW_RATING strike. */
export const STRIKE_LOW_RATING_BELOW = 3;

export type StrikeReasonKey =
  | "LATE_ARRIVAL"
  | "LATE_CANCEL"
  | "REFUND_ISSUED"
  | "LOW_RATING"
  | "MANUAL";

export type StrikeStatusKey = "ACTIVE" | "EXCUSED" | "REMOVED";

export const STRIKE_REASON_LABELS: Record<StrikeReasonKey, string> = {
  LATE_ARRIVAL: "Late arrival (45+ min)",
  LATE_CANCEL: "Late shift cancellation",
  REFUND_ISSUED: "Customer refund issued",
  LOW_RATING: "Two consecutive low ratings",
  MANUAL: "Manual strike",
};

export const STRIKE_STATUS_LABELS: Record<StrikeStatusKey, string> = {
  ACTIVE: "Active",
  EXCUSED: "Excused",
  REMOVED: "Removed",
};

export type StrikeLevel = "none" | "warning" | "critical";

/** Map an active strike count to a severity level for banners/badges. */
export function strikeLevel(activeCount: number): StrikeLevel {
  if (activeCount >= STRIKE_THRESHOLD) return "critical";
  if (activeCount >= STRIKE_THRESHOLD - 1) return "warning";
  return "none";
}
