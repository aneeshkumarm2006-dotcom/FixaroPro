-- CreateEnum
CREATE TYPE "EquipmentSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReimbursementStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'PAID');

-- CreateEnum
CREATE TYPE "PriceRevisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "ServiceCatalogItem" ADD COLUMN     "customerPartNote" TEXT,
ADD COLUMN     "requiresCustomerPart" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "arrivedAt" TIMESTAMP(3),
ADD COLUMN     "customerPartConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "onMyWayAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "convertedJobId" TEXT,
ADD COLUMN     "quotedPrice" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "JobEquipmentSubmission" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "EquipmentSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "coreTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consumables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessEquipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ppe" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customerSupplied" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "toPurchase" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "providerNotes" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobEquipmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentReimbursement" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "receiptUrl" TEXT,
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentReimbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPriceRevision" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "previousPrice" DOUBLE PRECISION NOT NULL,
    "proposedPrice" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PriceRevisionStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPriceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobEquipmentSubmission_jobId_key" ON "JobEquipmentSubmission"("jobId");

-- CreateIndex
CREATE INDEX "JobEquipmentSubmission_status_idx" ON "JobEquipmentSubmission"("status");

-- CreateIndex
CREATE INDEX "JobEquipmentSubmission_submittedById_idx" ON "JobEquipmentSubmission"("submittedById");

-- CreateIndex
CREATE INDEX "EquipmentReimbursement_jobId_idx" ON "EquipmentReimbursement"("jobId");

-- CreateIndex
CREATE INDEX "EquipmentReimbursement_providerId_idx" ON "EquipmentReimbursement"("providerId");

-- CreateIndex
CREATE INDEX "EquipmentReimbursement_status_idx" ON "EquipmentReimbursement"("status");

-- CreateIndex
CREATE INDEX "JobPriceRevision_jobId_createdAt_idx" ON "JobPriceRevision"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobPriceRevision_status_idx" ON "JobPriceRevision"("status");

-- AddForeignKey
ALTER TABLE "JobEquipmentSubmission" ADD CONSTRAINT "JobEquipmentSubmission_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentReimbursement" ADD CONSTRAINT "EquipmentReimbursement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPriceRevision" ADD CONSTRAINT "JobPriceRevision_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

