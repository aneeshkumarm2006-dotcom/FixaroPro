import Stripe from "stripe";

/**
 * Per-charge bank statement suffix, e.g. "FIXAROPRO* FIXARO".
 *
 * WHAT THIS FIXES: the line item a customer sees on their card statement for an
 * individual charge. That part is per-PaymentIntent and therefore code-controlled.
 *
 * WHAT THIS DOES **NOT** FIX (account-level, no code change can touch it):
 *   - the statement descriptor PREFIX (the "CLEANO" part) — set on the Stripe
 *     account's public business name in Dashboard → Settings → Business;
 *   - the mandate / "you allow X to charge your card" copy shown when saving a card;
 *   - the business name rendered by Checkout and Payment Element.
 * All three come from the Stripe ACCOUNT behind STRIPE_SECRET_KEY /
 * NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. They only change by pointing those env vars
 * at a Fixaro-owned Stripe account, or by renaming the existing account's public
 * business name in the Dashboard.
 */
const RAW_STATEMENT_DESCRIPTOR_SUFFIX =
  process.env.STRIPE_STATEMENT_DESCRIPTOR_SUFFIX || "FIXARO";

/**
 * Stripe rejects a PaymentIntent outright if the suffix is malformed, so sanitize
 * defensively rather than trusting the env value:
 *   - latin letters, digits and spaces only (drop everything else, including the
 *     explicitly forbidden < > \ " ' );
 *   - collapse/trim whitespace;
 *   - must contain at least one latin letter;
 *   - prefix + suffix must be <= 22 chars total. We cannot read the account prefix
 *     at runtime, so cap the suffix at 10 to leave room for a typical prefix.
 * If sanitizing leaves nothing usable we fall back to "FIXARO".
 */
function sanitizeStatementDescriptorSuffix(raw: string): string {
  const cleaned = raw
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10)
    .trim();
  return /[A-Za-z]/.test(cleaned) ? cleaned : "FIXARO";
}

export const STATEMENT_DESCRIPTOR_SUFFIX = sanitizeStatementDescriptorSuffix(
  RAW_STATEMENT_DESCRIPTOR_SUFFIX
);

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia",
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

export async function getOrCreateStripeCustomer(clientId: string, email: string, name: string) {
  const { db } = await import("@/db");
  const client = await db.client.findUnique({ where: { id: clientId }, select: { stripeCustomerId: true } });

  if (client?.stripeCustomerId) return client.stripeCustomerId;

  const customer = await stripe.customers.create({ email, name, metadata: { clientId } });

  await db.client.update({
    where: { id: clientId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
