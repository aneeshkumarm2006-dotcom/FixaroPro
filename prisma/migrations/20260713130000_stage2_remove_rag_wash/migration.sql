-- Stage 2 — Rag Wash removal (SOP §9/§12).
--
-- Retires the entire self-wash credit system: the RagWash log, WashPayout
-- redemptions, the WashPayoutStatus enum, the per-user credit ledger
-- (ragCredits/padCredits), and the per-job projection + review-override
-- columns. All feature code was removed first (clockOut.ts no longer projects
-- or awards washables, and the routes/actions/lib are deleted); this migration
-- reclaims the now-dead schema. Wash data is intentionally discarded — the
-- feature is retired, not paused.

-- Drop the redemption + log tables first (both FK to User; the enum is only
-- referenced by WashPayout.status).
DROP TABLE IF EXISTS "WashPayout";
DROP TABLE IF EXISTS "RagWash";

-- Enum is now unreferenced.
DROP TYPE IF EXISTS "WashPayoutStatus";

-- Per-user credit ledger.
ALTER TABLE "User" DROP COLUMN IF EXISTS "ragCredits";
ALTER TABLE "User" DROP COLUMN IF EXISTS "padCredits";

-- Per-job wash projection + manager review-override columns.
ALTER TABLE "Job" DROP COLUMN IF EXISTS "washProjectedRags";
ALTER TABLE "Job" DROP COLUMN IF EXISTS "washProjectedPads";
ALTER TABLE "Job" DROP COLUMN IF EXISTS "washCappedRags";
ALTER TABLE "Job" DROP COLUMN IF EXISTS "washCappedPads";
ALTER TABLE "Job" DROP COLUMN IF EXISTS "washActualRags";
ALTER TABLE "Job" DROP COLUMN IF EXISTS "washActualPads";
ALTER TABLE "Job" DROP COLUMN IF EXISTS "washCreditsAwarded";
ALTER TABLE "Job" DROP COLUMN IF EXISTS "washReviewOverrideAt";
ALTER TABLE "Job" DROP COLUMN IF EXISTS "washReviewOverrideBy";
