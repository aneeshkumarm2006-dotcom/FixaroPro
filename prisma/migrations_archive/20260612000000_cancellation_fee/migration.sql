-- Late-cancellation fee. When a customer cancels within the configured window
-- (CANCELLATION_FEE_WINDOW_HOURS, default 48h), the fee is charged off-session
-- to the saved card. `cancellationFeeChargedAt` makes the charge idempotent.

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "cancellationFeeChargedAt"       TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "cancellationFeePaymentIntentId" TEXT;
