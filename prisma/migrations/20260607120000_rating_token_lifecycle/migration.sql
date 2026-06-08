-- Rating token lifecycle.
-- One JobRatingToken per job, shared by the "rate us" email link and the
-- in-portal popup so the customer is never double-prompted. Adds the customer
-- linkage, the captured star value, the "rather not answer" skip flag (which
-- writes NO EmployeeRating row), and the per-channel idempotency stamps.

ALTER TABLE "JobRatingToken" ADD COLUMN IF NOT EXISTS "customerId"      TEXT;
ALTER TABLE "JobRatingToken" ADD COLUMN IF NOT EXISTS "ratingStars"     INTEGER;
ALTER TABLE "JobRatingToken" ADD COLUMN IF NOT EXISTS "ratherNotAnswer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JobRatingToken" ADD COLUMN IF NOT EXISTS "emailSentAt"     TIMESTAMP(3);
ALTER TABLE "JobRatingToken" ADD COLUMN IF NOT EXISTS "popupShownAt"    TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "JobRatingToken_customerId_idx" ON "JobRatingToken"("customerId");
