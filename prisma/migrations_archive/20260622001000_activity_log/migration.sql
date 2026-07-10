-- System-wide activity/event log (ported from Cleano). Ops-facing timeline of
-- email/SMS/payment/webhook/cron/auth events. Written via logActivity().

DO $$ BEGIN
  CREATE TYPE "ActivityCategory" AS ENUM ('EMAIL', 'SMS', 'PAYMENT', 'REFUND', 'DEPOSIT', 'WEBHOOK', 'AUTH', 'BOOKING', 'ADMIN', 'CRON', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ActivityStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id"         TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "category"   "ActivityCategory" NOT NULL,
  "action"     TEXT NOT NULL,
  "status"     "ActivityStatus" NOT NULL DEFAULT 'SUCCESS',
  "actorId"    TEXT,
  "actorLabel" TEXT,
  "targetType" TEXT,
  "targetId"   TEXT,
  "message"    TEXT,
  "error"      TEXT,
  "amount"     DOUBLE PRECISION,
  "providerId" TEXT,
  "metadata"   JSONB,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ActivityLog_category_idx" ON "ActivityLog"("category");
CREATE INDEX IF NOT EXISTS "ActivityLog_status_idx" ON "ActivityLog"("status");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");
CREATE INDEX IF NOT EXISTS "ActivityLog_targetType_targetId_idx" ON "ActivityLog"("targetType", "targetId");
