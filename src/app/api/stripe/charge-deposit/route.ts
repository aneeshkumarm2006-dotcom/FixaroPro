import { NextRequest, NextResponse } from "next/server";
import { stripe, getOrCreateStripeCustomer, STATEMENT_DESCRIPTOR_SUFFIX } from "@/lib/stripe";
import { getRuntimeConfig } from "@/lib/config/service-config";
import {
  materialsFor,
  isUpfrontMaterials,
  findService,
  type RuntimeConfig,
} from "@/lib/config/types";
import { requiresCustomQuote } from "@/app/(book)/book/types";
import { db } from "@/db";
import {
  rateLimitAny,
  clientIpFromHeaders,
  RATE_LIMITS,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit";

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
    const { email, name, serviceType, customerRequestsMaterials, tvSize, tvWallType } =
      await req.json();

    if (!email || !name) {
      return NextResponse.json({ error: "email and name are required" }, { status: 400 });
    }

    // Denial-of-wallet guard. This endpoint is unauthenticated by design (it runs
    // before submitBooking, so there is no session yet) but every success creates
    // a real Stripe PaymentIntent and can create a Stripe Customer. Budget by IP
    // AND by email so neither rotating one nor the other buys a free pass. Runs
    // before any db/Stripe call so a flood costs us nothing downstream.
    // NOTE: in-process only — see the caveats in @/lib/rate-limit.
    const limited = rateLimitAny(
      [`ip:${clientIpFromHeaders(req.headers)}`, `email:${String(email).toLowerCase()}`],
      { name: "charge-deposit", ...RATE_LIMITS.paymentIntent }
    );
    if (!limited.ok) {
      return NextResponse.json(
        { error: RATE_LIMIT_MESSAGE },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
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
    const service = serviceType ? findService(cfg, serviceType) : null;
    if (serviceType && !service?.active) {
      return NextResponse.json(
        { error: "That service is no longer available." },
        { status: 400 }
      );
    }

    // Fix #5 — never capture a card for quote-only work. The wizard diverts
    // these to /quote, but that is client-side only; mirror it here so a crafted
    // request can't take a deposit for a job that must be quoted first.
    if (
      serviceType &&
      requiresCustomQuote(
        { serviceType, tvSize: tvSize ?? "", tvWallType: tvWallType ?? "" },
        service?.pricing
      )
    ) {
      return NextResponse.json(
        { error: "This job needs a custom quote — no deposit is taken." },
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
      statement_descriptor_suffix: STATEMENT_DESCRIPTOR_SUFFIX,
      description: "Fixaro Handyman — booking deposit",
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
    // Detail stays server-side. The raw Stripe/db message can name internal
    // objects, config, or account state — an unauthenticated caller gets none
    // of it.
    console.error("charge-deposit error:", err);
    return NextResponse.json(
      { error: "We couldn't start that payment. Please try again." },
      { status: 500 }
    );
  }
}
