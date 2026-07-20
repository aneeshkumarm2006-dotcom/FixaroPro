"use server";

import { headers } from "next/headers";
import { db } from "@/db";
import { stripe, STATEMENT_DESCRIPTOR_SUFFIX } from "@/lib/stripe";
import {
  rateLimitAny,
  clientIpFromHeaders,
  RATE_LIMITS,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit";
import { generateGiftCardCode } from "@/lib/gift-cards/code";
import {
  GIFT_CARD_COVERS,
  GIFT_CARD_TIERS,
} from "@/lib/gift-cards/covers";

export interface CreateGiftCardInput {
  amount: number;
  purchaserName: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail: string;
  personalMessage?: string;
  scheduledDeliveryDate?: string;
  coverKey?: string;
}

/**
 * Step 1 of gift card purchase: validate inputs, create the GiftCard row
 * in PENDING_PAYMENT, and return a Stripe PaymentIntent client secret so
 * the buyer can pay. After payment succeeds the client calls
 * `finalizeGiftCardPurchase` to flip status to ACTIVE and trigger
 * delivery (or schedule it).
 */
export async function createGiftCardIntent(input: CreateGiftCardInput) {
  const amount = Math.round(Number(input.amount));
  if (!GIFT_CARD_TIERS.includes(amount as (typeof GIFT_CARD_TIERS)[number])) {
    return { success: false, error: "Pick a valid tier amount" };
  }

  const purchaserName = input.purchaserName?.trim();
  const purchaserEmail = input.purchaserEmail?.trim().toLowerCase();
  const recipientName = input.recipientName?.trim();
  const recipientEmail = input.recipientEmail?.trim().toLowerCase();

  if (!purchaserName) return { success: false, error: "Your name is required" };
  if (!purchaserEmail || !purchaserEmail.includes("@")) {
    return { success: false, error: "Your email is required" };
  }
  if (!recipientName) {
    return { success: false, error: "Recipient name is required" };
  }
  if (!recipientEmail || !recipientEmail.includes("@")) {
    return { success: false, error: "Recipient email is required" };
  }

  // Denial-of-wallet / junk-data guard. Unauthenticated by design (anyone can
  // buy a gift card), but each call writes a GiftCard row AND creates a real
  // Stripe PaymentIntent. Budgeted by IP and purchaser email; runs after cheap
  // validation but before the first write, so rejected calls cost nothing.
  // Server action → IP must come from `headers()`, not a request object.
  // NOTE: in-process only — see the caveats in @/lib/rate-limit.
  const limited = rateLimitAny(
    [`ip:${clientIpFromHeaders(await headers())}`, `email:${purchaserEmail}`],
    { name: "gift-card-intent", ...RATE_LIMITS.paymentIntent }
  );
  if (!limited.ok) {
    return { success: false, error: RATE_LIMIT_MESSAGE };
  }

  const coverKey =
    GIFT_CARD_COVERS.find((c) => c.key === input.coverKey)?.key ?? "default";

  let scheduledDate: Date | null = null;
  if (input.scheduledDeliveryDate) {
    const parsed = new Date(input.scheduledDeliveryDate);
    if (!Number.isNaN(parsed.getTime())) {
      // Only honour future dates; past dates fall back to immediate send.
      if (parsed.getTime() > Date.now()) {
        scheduledDate = parsed;
      }
    }
  }

  const code = generateGiftCardCode();

  const giftCard = await db.giftCard.create({
    data: {
      code,
      amount,
      status: "PENDING_PAYMENT",
      purchaserName,
      purchaserEmail,
      recipientName,
      recipientEmail,
      personalMessage: input.personalMessage?.trim() || null,
      scheduledDeliveryDate: scheduledDate,
      coverKey,
    },
  });

  try {
    const pi = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: "cad",
      automatic_payment_methods: { enabled: true },
      receipt_email: purchaserEmail,
      statement_descriptor_suffix: STATEMENT_DESCRIPTOR_SUFFIX,
      description: `Fixaro gift card — ${recipientName} ($${amount})`,
      metadata: {
        giftCardId: giftCard.id,
        kind: "gift_card",
      },
    });
    await db.giftCard.update({
      where: { id: giftCard.id },
      data: { stripePaymentIntentId: pi.id },
    });
    return {
      success: true,
      giftCardId: giftCard.id,
      clientSecret: pi.client_secret,
    };
  } catch (err) {
    await db.giftCard.update({
      where: { id: giftCard.id },
      data: { status: "CANCELLED" },
    });
    // Keep the Stripe detail in server logs only — the raw message can expose
    // account/config state to an unauthenticated buyer.
    console.error("createGiftCardIntent stripe error:", err);
    return {
      success: false,
      error: "We couldn't start that payment. Please try again.",
    };
  }
}
