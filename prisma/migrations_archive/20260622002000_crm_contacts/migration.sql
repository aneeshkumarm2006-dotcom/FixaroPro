-- CRM contacts (ported from Cleano). Unified lead/client/applicant pipeline.

DO $$ BEGIN
  CREATE TYPE "ContactActivityType" AS ENUM ('NOTE', 'EMAIL', 'SMS', 'CALL', 'BOOKING', 'RATING', 'CANCEL', 'LIFECYCLE', 'CREATE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "LifecycleStage" AS ENUM ('NEW_LEAD', 'QUALIFIED', 'BOOKED', 'ACTIVE', 'RETURNING', 'PAST', 'LOST', 'APPLICANT', 'CLEANER', 'DNC');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Contact" (
  "id"                 TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "email"              TEXT,
  "phone"              TEXT,
  "address"            TEXT,
  "lifecycle"          "LifecycleStage" NOT NULL DEFAULT 'NEW_LEAD',
  "source"             TEXT,
  "sourceDetail"       TEXT,
  "latestSource"       TEXT,
  "campaign"           TEXT,
  "ownerId"            TEXT,
  "leadScore"          INTEGER,
  "nextStep"           TEXT,
  "nextStepDue"        TIMESTAMP(3),
  "tags"               TEXT[] DEFAULT ARRAY[]::TEXT[],
  "props"              JSONB,
  "ratingAvg"          DOUBLE PRECISION,
  "ratingCount"        INTEGER NOT NULL DEFAULT 0,
  "lifetimeValue"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bookingsCount"      INTEGER NOT NULL DEFAULT 0,
  "duplicateDismissed" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt"         TIMESTAMP(3),
  "clientId"           TEXT,
  "leadId"             TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  "lastActivityAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Contact_clientId_key" ON "Contact"("clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_leadId_key" ON "Contact"("leadId");
CREATE INDEX IF NOT EXISTS "Contact_lifecycle_idx" ON "Contact"("lifecycle");
CREATE INDEX IF NOT EXISTS "Contact_ownerId_idx" ON "Contact"("ownerId");
CREATE INDEX IF NOT EXISTS "Contact_lastActivityAt_idx" ON "Contact"("lastActivityAt");
CREATE INDEX IF NOT EXISTS "Contact_email_idx" ON "Contact"("email");
CREATE INDEX IF NOT EXISTS "Contact_phone_idx" ON "Contact"("phone");

CREATE TABLE IF NOT EXISTS "ContactActivity" (
  "id"        TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "type"      "ContactActivityType" NOT NULL DEFAULT 'NOTE',
  "title"     TEXT NOT NULL,
  "body"      TEXT,
  "actor"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContactActivity_contactId_idx" ON "ContactActivity"("contactId");
CREATE INDEX IF NOT EXISTS "ContactActivity_createdAt_idx" ON "ContactActivity"("createdAt");

DO $$ BEGIN
  ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Contact" ADD CONSTRAINT "Contact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
