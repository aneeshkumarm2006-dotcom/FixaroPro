-- Provider service eligibility (SOP §8) + generic high-impact audit log (SOP §9).

CREATE TABLE IF NOT EXISTS "EmployeeServiceEligibility" (
  "id"          TEXT NOT NULL,
  "employeeId"  TEXT NOT NULL,
  "serviceType" TEXT NOT NULL,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "approvedBy"  TEXT,
  "approvedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeServiceEligibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeServiceEligibility_employeeId_serviceType_key" ON "EmployeeServiceEligibility"("employeeId", "serviceType");
CREATE INDEX IF NOT EXISTS "EmployeeServiceEligibility_employeeId_idx" ON "EmployeeServiceEligibility"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeServiceEligibility_serviceType_idx" ON "EmployeeServiceEligibility"("serviceType");

DO $$ BEGIN
  ALTER TABLE "EmployeeServiceEligibility" ADD CONSTRAINT "EmployeeServiceEligibility_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"          TEXT NOT NULL,
  "entityType"  TEXT NOT NULL,
  "entityId"    TEXT NOT NULL,
  "action"      TEXT NOT NULL,
  "field"       TEXT,
  "oldValue"    TEXT,
  "newValue"    TEXT,
  "reason"      TEXT,
  "actorId"     TEXT,
  "actorEmail"  TEXT,
  "description" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
