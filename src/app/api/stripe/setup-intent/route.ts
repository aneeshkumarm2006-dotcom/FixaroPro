import { NextRequest, NextResponse } from "next/server";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";
import { db } from "@/db";

export async function POST(req: NextRequest) {
  try {
    const { email, name, clientId } = await req.json();

    if (!email || !name) {
      return NextResponse.json({ error: "email and name are required" }, { status: 400 });
    }

    // Find or create client record to get/set stripeCustomerId
    let resolvedClientId = clientId;
    if (!resolvedClientId) {
      const client = await db.client.findFirst({ where: { email: email.toLowerCase() } });
      resolvedClientId = client?.id;
    }

    let customerId: string;
    if (resolvedClientId) {
      customerId = await getOrCreateStripeCustomer(resolvedClientId, email, name);
    } else {
      // Guest — create a temporary customer, will be linked after booking
      const customer = await stripe.customers.create({ email, name });
      customerId = customer.id;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      // SetupIntents have no statement descriptor (no charge is made). The mandate
      // text shown to the customer here is ACCOUNT-level — see STATEMENT_DESCRIPTOR_SUFFIX
      // in @/lib/stripe for what code can and cannot change.
      description: "Fixaro Handyman — save card for future bookings",
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
    });
  } catch (err: any) {
    console.error("setup-intent error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
