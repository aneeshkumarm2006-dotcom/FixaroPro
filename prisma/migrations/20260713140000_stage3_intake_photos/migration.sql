-- Stage 3 — New-service intake: photos + real quote form (SOP v4.2 §4/§5).
--
-- Two changes:
--   1. JobPhoto gains a `kind` discriminator and its `employeeId` becomes
--      nullable so customer-uploaded INTAKE photos (captured during booking,
--      when there is no employee) can share the existing relation. AFTER photos
--      keep the assigned handyman/admin and the after-photo consent gate.
--   2. QuoteRequest gains the same service-specific intake columns Book Now
--      persists on Job (paint-repair / AC), plus a photoUrls array — the
--      Get-a-Quote form now collects the real intake instead of bed/bath/sqft.
--
-- Additive + defensive (IF NOT EXISTS / duplicate-safe); no backfill. Existing
-- JobPhoto rows default to kind = 'AFTER', preserving current behaviour.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "JobPhotoKind" AS ENUM ('INTAKE', 'AFTER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable — JobPhoto
ALTER TABLE "JobPhoto" ADD COLUMN IF NOT EXISTS "kind" "JobPhotoKind" NOT NULL DEFAULT 'AFTER';
ALTER TABLE "JobPhoto" ALTER COLUMN "employeeId" DROP NOT NULL;

-- AlterTable — QuoteRequest
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "paintRepairArea"    TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "paintRepairSurface" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "acType"             TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "acLocation"         TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "acMountType"        TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "clientHasAcUnit"    BOOLEAN;
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "photoUrls"          TEXT[] DEFAULT ARRAY[]::TEXT[];
