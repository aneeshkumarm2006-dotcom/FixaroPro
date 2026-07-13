-- Stage 1 — Hourly billing correctness (SOP §10).
--
-- `basePriceAmount` records the booked base/labour component so the clocked
-- labour can be swapped into the stored subtotal at charge time without
-- disturbing add-ons / materials / travel / discount. `billableHours`,
-- `computedLabourAmount` and `computedTotal` cache the values recomputed at
-- clock-out / clock-correction for receipts, job cards and analytics.
--
-- All nullable; no backfill. Legacy hourly jobs without `basePriceAmount` fall
-- back to the stored booked price (flagged in the charge-review UI).

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "basePriceAmount"      DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "bookedSubtotalAmount" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "billableHours"        DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "computedLabourAmount" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "computedTotal"        DOUBLE PRECISION;
