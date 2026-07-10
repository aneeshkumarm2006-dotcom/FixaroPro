-- Job application intake (public careers page). Modeled on QuoteRequest.
-- Resume is stored as a Cloudinary raw-resource secure URL.

DO $$ BEGIN
  CREATE TYPE "JobApplicationStatus" AS ENUM ('NEW', 'REVIEWING', 'INTERVIEW', 'HIRED', 'REJECTED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "JobApplication" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "phone"       TEXT,
  "position"    TEXT,
  "experience"  TEXT,
  "coverLetter" TEXT,
  "resumeUrl"   TEXT,
  "status"      "JobApplicationStatus" NOT NULL DEFAULT 'NEW',
  "source"      TEXT,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "JobApplication_status_idx"    ON "JobApplication"("status");
CREATE INDEX IF NOT EXISTS "JobApplication_createdAt_idx" ON "JobApplication"("createdAt");
