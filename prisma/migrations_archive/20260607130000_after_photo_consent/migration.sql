-- After-photo consent on booking.
-- The customer agrees (or not) at booking time to the cleaner photographing
-- the finished work. Cleaners cannot upload after-photos unless consent was
-- given OR an admin sets an override. Enforced server-side in uploadJobPhoto.

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "afterPhotoConsent"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "afterPhotoConsentAt"      TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "afterPhotoConsentVersion" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "afterPhotoOverrideAt"     TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "afterPhotoOverrideBy"     TEXT;
