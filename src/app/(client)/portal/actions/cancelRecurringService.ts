"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { getSaveOfferConfig } from "@/lib/retention";
import {
  RETENTION_COOLDOWN_DAYS,
  RECURRING_FREQUENCIES,
  formatOffer,
} from "@/lib/retention-constants";
import { sendRecurringSaveOffer } from "@/lib/email";
import type { ServiceFrequency } from "@prisma/client";

function makePromoCode(): string {
  return `SAVE-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Cancel a client's FULL recurring service (distinct from cancelling a single
 * cleaning). Records a RecurringCancellation, downgrades the client to
 * one-time, cancels their upcoming recurring visits, mints a one-time save
 * promo code, and emails the save offer — subject to a 30-day cooldown so a
 * client who re-cancels isn't spammed.
 */
export async function cancelRecurringService(input: { reason?: string }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { success: false, error: "Not authenticated" };

  const email = session.user.email?.toLowerCase();
  if (!email) return { success: false, error: "No email on account" };

  const client = await db.client.findFirst({
    where: { email },
    select: { id: true, name: true, email: true, serviceFrequency: true },
  });
  if (!client) return { success: false, error: "Client not found" };

  const freq = client.serviceFrequency;
  if (!freq || !RECURRING_FREQUENCIES.includes(freq as (typeof RECURRING_FREQUENCIES)[number])) {
    return { success: false, error: "You don't have an active recurring plan." };
  }

  const config = await getSaveOfferConfig();

  // 30-day cooldown: did we already send this client a save offer recently?
  const cooldownStart = new Date(
    Date.now() - RETENTION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  );
  const recentOffer = await db.recurringCancellation.findFirst({
    where: { clientId: client.id, emailSentAt: { gte: cooldownStart } },
    select: { id: true },
  });
  const withinCooldown = !!recentOffer;

  // Mint the one-time promo code (only when we'll actually send an offer).
  const sendOffer = config.enabled && !withinCooldown && !!client.email;
  let offerCode: string | null = null;
  if (sendOffer) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.expiresInDays);
    offerCode = makePromoCode();
    await db.promoCode.create({
      data: {
        code: offerCode,
        description: `Retention save offer for ${client.name}`,
        discountType: config.offerType,
        discountValue: config.offerValue,
        maxUses: 1,
        expiresAt,
        isActive: true,
      },
    });
  }

  // Record the cancellation.
  const cancellation = await db.recurringCancellation.create({
    data: {
      clientId: client.id,
      frequency: freq as ServiceFrequency,
      reason: input.reason?.trim() || null,
      offerType: sendOffer ? config.offerType : null,
      offerValue: sendOffer ? config.offerValue : null,
      offerCode,
      offerStatus: sendOffer ? "PENDING" : "EXPIRED",
    },
  });

  // Downgrade the client to one-time.
  await db.client.update({
    where: { id: client.id },
    data: { serviceFrequency: "ONE_TIME" },
  });

  // Flag (cancel) the client's upcoming recurring visits.
  await db.job.updateMany({
    where: {
      clientId: client.id,
      jobDate: { gt: new Date() },
      status: { in: ["CREATED", "SCHEDULED"] },
      parentJobId: { not: null },
    },
    data: { status: "CANCELLED" },
  });

  // Send the save offer (respecting cooldown).
  if (sendOffer && offerCode && client.email) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.expiresInDays);
    const res = await sendRecurringSaveOffer({
      to: client.email,
      clientName: client.name,
      cancellationId: cancellation.id,
      headline: config.headline,
      body: config.body,
      buttonLabel: config.buttonLabel,
      offerLabel: formatOffer(config.offerType, config.offerValue),
      offerCode,
      expiresAt: expiresAt.toISOString(),
    }).catch((e) => {
      console.error("sendRecurringSaveOffer", e);
      return { ok: false as const };
    });
    if (res.ok) {
      await db.recurringCancellation.update({
        where: { id: cancellation.id },
        data: { emailSentAt: new Date(), offerStatus: "SENT" },
      });
    }
  }

  revalidatePath("/portal/bookings");
  return { success: true, offerSent: sendOffer };
}
