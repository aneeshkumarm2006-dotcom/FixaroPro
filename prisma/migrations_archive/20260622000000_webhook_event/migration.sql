-- Stripe webhook idempotency (ported from Cleano). Claiming the event id before
-- processing makes duplicate deliveries a no-op (collide on the primary key).

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id"        TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");
