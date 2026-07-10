-- Admin-editable equipment/products checklist per service type (SOP §4/§8).
--
-- A row OVERRIDES the seeded defaults in src/lib/equipment.ts. Absence of a row
-- means "use the default", so this table starts empty and only ever holds the
-- services an admin has actually customised. No backfill is required.

CREATE TABLE IF NOT EXISTS "ServiceEquipment" (
  "serviceType" TEXT NOT NULL,
  "items"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "updatedById" TEXT,
  CONSTRAINT "ServiceEquipment_pkey" PRIMARY KEY ("serviceType")
);

CREATE INDEX IF NOT EXISTS "ServiceEquipment_updatedById_idx"
  ON "ServiceEquipment"("updatedById");

ALTER TABLE "ServiceEquipment"
  ADD CONSTRAINT "ServiceEquipment_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
