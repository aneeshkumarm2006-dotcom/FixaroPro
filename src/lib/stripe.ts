import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
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
