-- Recurring cancellation save flow.
-- One row per full-recurring cancellation. Drives the retention "save offer"
-- email and the retention KPI dashboard. Lifecycle stamps track the funnel:
-- sent -> opened (pixel) -> clicked (redirect) -> replied (admin) -> reactivated.

DO $$ BEGIN
  CREATE TYPE "SaveOfferStatus" AS ENUM ('PENDING', 'SENT', 'OPENED', 'CLICKED', 'REPLIED', 'REACTIVATED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "RecurringCancellation" (
  "id"            TEXT PRIMARY KEY,
  "clientId"      TEXT NOT NULL,
  "frequency"     "ServiceFrequency" NOT NULL,
  "reason"        TEXT,
  "cancelledAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "emailSentAt"   TIMESTAMP(3),
  "offerType"     TEXT,
  "offerValue"    DOUBLE PRECISION,
  "offerCode"     TEXT,
  "offerStatus"   "SaveOfferStatus" NOT NULL DEFAULT 'PENDING',
  "openedAt"      TIMESTAMP(3),
  "clickedAt"     TIMESTAMP(3),
  "repliedAt"     TIMESTAMP(3),
  "reactivatedAt" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringCancellation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RecurringCancellation_clientId_idx"    ON "RecurringCancellation"("clientId");
CREATE INDEX IF NOT EXISTS "RecurringCancellation_offerStatus_idx" ON "RecurringCancellation"("offerStatus");
CREATE INDEX IF NOT EXISTS "RecurringCancellation_cancelledAt_idx" ON "RecurringCancellation"("cancelledAt");
