// SOP §9.10: every service must render a human-readable label on the calendar,
// job cards, the jobs table and the CRM — never a raw enum code.
//
// Legacy cleaning short codes (R/C/PC/F) keep their historical labels; every real
// Fixaro service resolves against the LIVE service catalog, so a service an admin
// adds or renames is named correctly everywhere with no deploy (SOP §3, stage 8).
//
// NO "use client" here on purpose. This module is imported by server components
// (CleanerDashboard, the provider job detail page) as well as client ones — with
// the directive, its exports would cross the RSC boundary as client references
// and calling them on the server would fail. The React hook wrapper lives in
// ./use-job-type-label.ts, which is client-only.

import { serviceLabel, type RuntimeConfig } from "@/lib/config/types";

const SHORT_CODE_LABELS: Record<string, { full: string; compact: string }> = {
  R: { full: "Residential", compact: "Res" },
  C: { full: "Commercial", compact: "Com" },
  PC: { full: "Post-Construction", compact: "Post-C" },
  F: { full: "Follow-up", compact: "F/Up" },
};

/**
 * Human label for a Job.jobType. `compact` is for tight surfaces (month cells);
 * catalog services have no separate compact form, truncation handles overflow.
 *
 * Takes the config explicitly. Server components that already hold a
 * RuntimeConfig call this directly; client components use `useJobTypeLabel()`.
 */
export function jobTypeLabelWith(
  cfg: RuntimeConfig,
  jobType: string | null | undefined,
  variant: "full" | "compact" = "full"
): string {
  if (!jobType) return "";
  const short = SHORT_CODE_LABELS[jobType];
  if (short) return variant === "compact" ? short.compact : short.full;
  return serviceLabel(cfg, jobType);
}
