-- Stage 8 (SOP §3) — promote the service catalog, materials pricing and painting
-- baselines from TypeScript constants to the DB/config layer so they are
-- admin-editable and exportable/importable per environment.
--
-- Purely ADDITIVE: no existing table or column is touched. The tables start
-- empty; src/lib/config/service-config.ts seeds them from the TS constants
-- (which remain the seed defaults) and falls back to those constants while the
-- tables are empty, so an unmigrated/unseeded environment behaves as before.

-- CreateEnum
CREATE TYPE "ServicePricingModel" AS ENUM ('HOURLY', 'FIXED', 'QUOTE');

-- CreateEnum
CREATE TYPE "MaterialsChargeType" AS ENUM ('DEPOSIT', 'COST', 'CHARGE');

-- CreateTable
CREATE TABLE "ServiceCatalogItem" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "pricing" "ServicePricingModel" NOT NULL DEFAULT 'HOURLY',
    "priceNote" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fixedPrice" DOUBLE PRECISION,
    "fixedPricePerUnit" BOOLEAN NOT NULL DEFAULT false,
    "materialsAmount" DOUBLE PRECISION,
    "materialsType" "MaterialsChargeType",
    "materialsNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintingBaseline" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baselineMin" DOUBLE PRECISION NOT NULL,
    "baselineMax" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaintingBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCatalogItem_value_key" ON "ServiceCatalogItem"("value");

-- CreateIndex
CREATE INDEX "ServiceCatalogItem_category_idx" ON "ServiceCatalogItem"("category");

-- CreateIndex
CREATE INDEX "ServiceCatalogItem_active_idx" ON "ServiceCatalogItem"("active");

-- CreateIndex
CREATE UNIQUE INDEX "PaintingBaseline_key_key" ON "PaintingBaseline"("key");
