import { NextRequest, NextResponse } from "next/server";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";
import { getRuntimeConfig } from "@/lib/config/service-config";
import {
  materialsFor,
  isUpfrontMaterials,
  findService,
  type RuntimeConfig,
} from "@/lib/config/types";
import { db } from "@/db";

// Server-authoritative upfront amount (in dollars). When the customer opts into
// Fixaro-provided materials AND the service uses the upfront-capture mechanism
// (SOP §5 refundable deposits, or the painting $119 flat materials charge), that
// amount is collected upfront. "cost"-type materials are billed on the final
// invoice, so the base booking deposit still applies.
//
// Both the materials amount and the base deposit come from the runtime config,
// so an admin repricing a deposit changes what is actually captured here — and
// billing.depositCollected() credits back the same number, because it reads the
// same `pricing.baseBookingDeposit` value.
function resolveDepositAmount(
  cfg: RuntimeConfig,
  serviceType: string | undefined,
  customerRequestsMaterials: boolean
): number {
  if (customerRequestsMaterials) {
    const materials = materialsFor(cfg, serviceType);
    // Refundable deposits AND flat upfront charges (painting's $119) are both
    // collected now; "cost"-type materials are billed on the final invoice.
    if (materials && isUpfrontMaterials(materials.type)) {
      return materials.amount;
    }
  }
  return cfg.policy.baseBookingDeposit;
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

    const cfg = await getRuntimeConfig();

    // Don't take a card for a service that isn't bookable. This endpoint runs
    // BEFORE submitBooking, so without the check we'd capture a deposit for a
    // retired or bogus service and then reject the booking that follows —
    // leaving the customer charged for a job that will never exist.
    if (serviceType && !findService(cfg, serviceType)?.active) {
      return NextResponse.json(
        { error: "That service is no longer available." },
        { status: 400 }
      );
    }

    const amount = resolveDepositAmount(
      cfg,
      serviceType,
      customerRequestsMaterials === true
    );

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
