import { NextRequest, NextResponse } from "next/server";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";
import { getMaterialsPricing, isUpfrontMaterials } from "@/app/(book)/book/types";
import { db } from "@/db";

// Base booking deposit collected on every web booking (CAD).
const BASE_BOOKING_DEPOSIT = 20;

// Server-authoritative upfront amount (in dollars). When the customer opts into
// Fixaro-provided materials AND the service uses the upfront-capture mechanism
// (SOP §5 refundable deposits, or the painting $119 flat materials charge), that
// amount is collected upfront. "cost"-type materials are billed on the final
// invoice, so the base booking deposit still applies.
function resolveDepositAmount(
  serviceType: string | undefined,
  customerRequestsMaterials: boolean
): number {
  if (customerRequestsMaterials) {
    const materials = getMaterialsPricing(serviceType);
    // Refundable deposits AND flat upfront charges (painting's $119) are both
    // collected now; "cost"-type materials are billed on the final invoice.
    if (materials && isUpfrontMaterials(materials.type)) {
      return materials.amount;
    }
  }
  return BASE_BOOKING_DEPOSIT;
}

export async function POST(req: NextRequest) {
  try {
    const { email, name, serviceType, customerRequestsMaterials } = await req.json();

    if (!email || !name) {
      return NextResponse.json({ error: "email and name are required" }, { status: 400 });
    }

    const client = await db.client.findFirst({ where: { email: email.toLowerCase() } });

    let customerId: string;
    if (client) {
      customerId = await getOrCreateStripeCustomer(client.id, email, name);
    } else {
      const customer = await stripe.customers.create({ email, name });
      customerId = customer.id;
    }

    const amount = resolveDepositAmount(serviceType, customerRequestsMaterials === true);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "cad",
      customer: customerId,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      description: "Fixaro booking deposit",
      metadata: {
        type: "deposit",
        serviceType: serviceType ?? "",
        materials: customerRequestsMaterials === true ? "true" : "false",
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      customerId,
      paymentIntentId: paymentIntent.id,
      amount,
    });
  } catch (err: any) {
    console.error("charge-deposit error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
