-- Create EmailKind and EmailStatus enums if they don't exist
DO $$ BEGIN
  CREATE TYPE "EmailKind" AS ENUM (
    'BOOKING_CONFIRMATION', 'REMINDER_24H', 'RECEIPT', 'REFUND',
    'WAITLIST_AVAILABLE', 'RATING_REQUEST', 'PASSWORD_SETUP', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create EmailLog table if it doesn't exist
CREATE TABLE IF NOT EXISTS "EmailLog" (
  "id"              TEXT NOT NULL,
  "kind"            "EmailKind" NOT NULL,
  "recipient"       TEXT NOT NULL,
  "subject"         TEXT,
  "status"          "EmailStatus" NOT NULL DEFAULT 'PENDING',
  "jobId"           TEXT,
  "leadId"          TEXT,
  "waitlistId"      TEXT,
  "providerId"      TEXT,
  "error"           TEXT,
  "sentAt"          TIMESTAMP(3),
  "notificationKey" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- Add foreign key if Job table exists
DO $$ BEGIN
  ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "EmailLog_kind_idx" ON "EmailLog"("kind");
CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX IF NOT EXISTS "EmailLog_jobId_idx" ON "EmailLog"("jobId");
CREATE INDEX IF NOT EXISTS "EmailLog_recipient_idx" ON "EmailLog"("recipient");

-- Adds a notificationKey column if the table already existed without it
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "notificationKey" TEXT;
CREATE INDEX IF NOT EXISTS "EmailLog_jobId_notificationKey_idx" ON "EmailLog"("jobId", "notificationKey");
