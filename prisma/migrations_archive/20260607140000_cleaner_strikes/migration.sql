-- Three-strike accountability.
-- A cleaner accrues strikes for late arrivals, late shift cancellations,
-- customer refunds, and consecutive low ratings. The rolling 30-day active
-- count is computed on read (no cron); EXCUSED/REMOVED strikes stay for audit
-- but never count. Hitting the threshold raises a CLEANER_STRIKE alert.

-- New alert type. Safe on PG12+ since the value isn't referenced in this
-- migration's DDL.
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'CLEANER_STRIKE';

DO $$ BEGIN
  CREATE TYPE "StrikeReason" AS ENUM ('LATE_ARRIVAL', 'LATE_CANCEL', 'REFUND_ISSUED', 'LOW_RATING', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "StrikeStatus" AS ENUM ('ACTIVE', 'EXCUSED', 'REMOVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "CleanerStrike" (
  "id"        TEXT PRIMARY KEY,
  "cleanerId" TEXT NOT NULL,
  "jobId"     TEXT,
  "reason"    "StrikeReason" NOT NULL,
  "status"    "StrikeStatus" NOT NULL DEFAULT 'ACTIVE',
  "note"      TEXT,
  "actionBy"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CleanerStrike_cleanerId_fkey" FOREIGN KEY ("cleanerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CleanerStrike_jobId_fkey"     FOREIGN KEY ("jobId")     REFERENCES "Job"("id")  ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CleanerStrike_cleanerId_idx" ON "CleanerStrike"("cleanerId");
CREATE INDEX IF NOT EXISTS "CleanerStrike_jobId_idx"     ON "CleanerStrike"("jobId");
CREATE INDEX IF NOT EXISTS "CleanerStrike_status_idx"    ON "CleanerStrike"("status");
CREATE INDEX IF NOT EXISTS "CleanerStrike_createdAt_idx" ON "CleanerStrike"("createdAt");
