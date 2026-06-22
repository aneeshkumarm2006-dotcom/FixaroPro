-- Materials/equipment decision on a booking (SOP §4/§5). All-or-nothing:
-- when `customerRequestsMaterials` is true, Fixaro provides everything and a
-- per-service amount applies. `materialsType` is "deposit" (refundable /
-- applied to final bill, tracked separately) or "cost" (flat line item).
-- `materialsAppliedAmount` / `materialsRefundedAt` are filled in during admin
-- charge review (SOP §10).

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "customerRequestsMaterials" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "materialsAmount"           DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "materialsType"             TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "materialsAppliedAmount"    DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "materialsRefundedAt"       TIMESTAMP(3);
