-- Stage 7.2 — provider-facing job completion (SOP §8 "Job completion tools:
-- notes, photos, status updates, completed marker").
--
-- Additive and nullable: existing jobs keep NULL, which reads as "completed
-- before we tracked this" rather than as a data error. Nothing backfills from
-- clockOutTime — a corrected clock would silently rewrite who completed the
-- job, and these columns exist precisely so that can't happen.

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "completionNotes" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "completedById" TEXT;
