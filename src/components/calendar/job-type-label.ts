// SOP §9.10: every service must render a human-readable label on the calendar.
// Legacy short codes (R/C/PC/F) keep their historical labels; everything else
// (SMALL_PAINT_REPAIR, AC_INSTALLATION, ...) falls back to the canonical
// service catalog so new services never render as raw enum codes.
import { SERVICE_CATALOG } from "@/app/(book)/book/types";

const SHORT_CODE_LABELS: Record<string, { full: string; compact: string }> = {
  R: { full: "Residential", compact: "Res" },
  C: { full: "Commercial", compact: "Com" },
  PC: { full: "Post-Construction", compact: "Post-C" },
  F: { full: "Follow-up", compact: "F/Up" },
};

const CATALOG_LABELS: Record<string, string> = Object.fromEntries(
  SERVICE_CATALOG.map((s) => [s.value, s.label])
);

/**
 * Human label for a Job.jobType. `compact` is for tight surfaces (month cells);
 * catalog services have no separate compact form, truncation handles overflow.
 */
export function jobTypeLabel(
  jobType: string | null | undefined,
  variant: "full" | "compact" = "full"
): string {
  if (!jobType) return "";
  const short = SHORT_CODE_LABELS[jobType];
  if (short) return variant === "compact" ? short.compact : short.full;
  return CATALOG_LABELS[jobType] ?? jobType;
}
