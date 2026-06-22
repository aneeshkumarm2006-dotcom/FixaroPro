-- Painting bid workflow (SOP §6/§7). Immediate customer range = internal
-- baseline × 1.35 surplus; final amount = accepted (lowest valid) bid × surplus.
-- Provider override is independent of price (tracker decision D3).

DO $$ BEGIN
  CREATE TYPE "PaintingStatus" AS ENUM ('QUOTED', 'BIDDING', 'OFFER_SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "paintingStatus"         "PaintingStatus";
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "paintingScope"          TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "quoteRangeMin"          DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "quoteRangeMax"          DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "acceptedBidId"          TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "acceptedBidAmount"      DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "paintingSurplusRate"    DOUBLE PRECISION DEFAULT 1.35;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "paintingFinalAmount"    DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "offerSentAt"            TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "offerRespondedAt"       TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "offerResponse"          TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "offerLastReminderAt"    TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "followUpFlaggedAt"      TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "providerOverrideReason" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "providerOverrideAt"     TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "providerOverrideBy"     TEXT;

CREATE TABLE IF NOT EXISTS "PaintingBid" (
  "id"             TEXT NOT NULL,
  "jobId"          TEXT NOT NULL,
  "bidderId"       TEXT NOT NULL,
  "amount"         DOUBLE PRECISION NOT NULL,
  "note"           TEXT,
  "isValid"        BOOLEAN NOT NULL DEFAULT true,
  "isWinning"      BOOLEAN NOT NULL DEFAULT false,
  "autoAcceptedAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaintingBid_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaintingBid_jobId_bidderId_key" ON "PaintingBid"("jobId", "bidderId");
CREATE INDEX IF NOT EXISTS "PaintingBid_jobId_idx" ON "PaintingBid"("jobId");
CREATE INDEX IF NOT EXISTS "PaintingBid_bidderId_idx" ON "PaintingBid"("bidderId");

DO $$ BEGIN
  ALTER TABLE "PaintingBid" ADD CONSTRAINT "PaintingBid_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PaintingBid" ADD CONSTRAINT "PaintingBid_bidderId_fkey"
    FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
