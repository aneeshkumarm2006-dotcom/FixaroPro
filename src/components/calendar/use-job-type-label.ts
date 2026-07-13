"use client";

// Client hook wrapper around jobTypeLabelWith(). Split from ./job-type-label.ts
// so that the pure function stays importable from SERVER components — a module
// marked "use client" has all its exports turned into client references, and
// calling one on the server throws.
//
//   const jobTypeLabel = useJobTypeLabel();
//   <span>{jobTypeLabel(job.jobType)}</span>

import { useCallback } from "react";
import { useRuntimeConfig } from "@/lib/config/ServiceConfigProvider";
import { jobTypeLabelWith } from "./job-type-label";

export function useJobTypeLabel() {
  const cfg = useRuntimeConfig();
  return useCallback(
    (jobType: string | null | undefined, variant: "full" | "compact" = "full") =>
      jobTypeLabelWith(cfg, jobType, variant),
    [cfg]
  );
}
