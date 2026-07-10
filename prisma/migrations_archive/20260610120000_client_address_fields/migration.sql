-- Multi-address per client + structured contact/address fields on Client.
-- All additive and nullable. ClientAddress holds extra labeled addresses; the
-- existing Client.address stays as the primary/legacy address.

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "secondaryEmail" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "secondaryPhone" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "company"        TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "aptNumber"      TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "city"           TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "state"          TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "zip"            TEXT;

CREATE TABLE IF NOT EXISTS "ClientAddress" (
  "id"        TEXT PRIMARY KEY,
  "clientId"  TEXT NOT NULL,
  "label"     TEXT NOT NULL DEFAULT 'Home',
  "address"   TEXT NOT NULL,
  "aptNumber" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientAddress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClientAddress_clientId_idx" ON "ClientAddress"("clientId");
