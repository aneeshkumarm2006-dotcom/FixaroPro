-- Ad spend imports for CPA reporting (ported from Cleano).

CREATE TABLE IF NOT EXISTS "AdSpendImport" (
  "id"           TEXT NOT NULL,
  "channel"      TEXT NOT NULL,
  "date"         TIMESTAMP(3) NOT NULL,
  "amount"       DOUBLE PRECISION NOT NULL,
  "source"       TEXT,
  "importedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdSpendImport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdSpendImport_channel_idx" ON "AdSpendImport"("channel");
CREATE INDEX IF NOT EXISTS "AdSpendImport_date_idx" ON "AdSpendImport"("date");
