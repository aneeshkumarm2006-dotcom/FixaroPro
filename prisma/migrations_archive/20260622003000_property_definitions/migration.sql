-- Admin-defined custom properties (ported from Cleano). Drives flexible
-- property cards on contacts/companies/bookings.

CREATE TABLE IF NOT EXISTS "PropertyDefinition" (
  "id"           TEXT NOT NULL,
  "objectType"   TEXT NOT NULL,
  "groupName"    TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "internalName" TEXT NOT NULL,
  "fieldType"    TEXT NOT NULL,
  "options"      TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isSystem"     BOOLEAN NOT NULL DEFAULT false,
  "isRequired"   BOOLEAN NOT NULL DEFAULT false,
  "isUnique"     BOOLEAN NOT NULL DEFAULT false,
  "visibility"   TEXT NOT NULL DEFAULT 'everyone',
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "archivedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PropertyDefinition_objectType_internalName_key" ON "PropertyDefinition"("objectType", "internalName");
CREATE INDEX IF NOT EXISTS "PropertyDefinition_objectType_idx" ON "PropertyDefinition"("objectType");
