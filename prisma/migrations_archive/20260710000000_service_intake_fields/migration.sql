-- Service-specific intake fields for the two services added in SOP v4.2 §4:
--   • Small paint repair — repair area + wall/surface type. The client always
--     supplies the paint, so no paint-colour/procurement data is stored.
--   • AC installation — AC type, location, mounting/window details, and whether
--     the client already has the required unit/accessories.
-- Photos reuse the existing JobPhoto relation; free-text detail goes in Job.notes.
-- All columns are nullable: existing rows and other service types are unaffected.

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "paintRepairArea"    TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "paintRepairSurface" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "acType"             TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "acLocation"         TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "acMountType"        TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "clientHasAcUnit"    BOOLEAN;
