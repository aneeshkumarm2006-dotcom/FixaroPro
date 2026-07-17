"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { sendAccountEmail } from "@/lib/email";
import type { ClientPaymentMethod } from "@prisma/client";
import type {
  ClientPaymentMethodDTO,
  ListClientPaymentMethodsResult,
} from "./clientPaymentMethods.types";

// Multiple saved cards per client, mirroring Cleano's ClientPaymentMethods but
// reconciled with Fixaro's existing single-card mechanism.
//
// RECONCILIATION: Fixaro already stored ONE card in `Client.defaultPaymentMethodId`
// (+ `stripeCustomerId`), which every charge path reads (chargeJob, bulkChargeJobs,
// cardHoldActions, markNoShow, cancelJobByAdmin, requestCancellation). Rather than
// build a parallel system, this module keeps that field as the single source the
// charges read, and adds `ClientPaymentMethod` purely as a DISPLAY MIRROR of the
// cards attached to the client's Stripe customer. Stripe itself is the system of
// record for the cards; the mirror is rebuilt from Stripe on every list, so cards
// added through the older flows (job SaveCardOnFile, /add-card/[token]) show up
// automatically without a migration.
//
// NO RAW CARD DATA is ever accepted, stored or logged here — cards only ever enter
// through Stripe Elements (SetupIntent via /api/stripe/setup-intent), so this module
// only ever sees `pm_…` ids and the brand / last4 / expiry Stripe hands back.

const MAX_CARDS = 20;
/** Re-sending an add-card link inside this window returns the existing token. */
const ADD_CARD_LINK_COOLDOWN_MS = 60 * 1000;
const ADD_CARD_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

/** OWNER/ADMIN only — money actions, matching chargeJob's gate. Fails closed. */
async function requireOwnerAdmin(): Promise<
  { ok: true; session: NonNullable<Session> } | { ok: false; error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  const role = (session.user as { role?: string }).role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { ok: false, error: "Not authorized" };
  }
  return { ok: true, session };
}

function isExpired(expMonth: number | null, expYear: number | null): boolean {
  if (!expMonth || !expYear) return false;
  const now = new Date();
  const endOfMonth = new Date(expYear, expMonth, 1); // first of the NEXT month
  return endOfMonth.getTime() <= now.getTime();
}

function toDTO(row: ClientPaymentMethod): ClientPaymentMethodDTO {
  return {
    id: row.id,
    stripePaymentMethodId: row.stripePaymentMethodId,
    brand: row.brand,
    last4: row.last4,
    expMonth: row.expMonth,
    expYear: row.expYear,
    isDefault: row.isDefault,
    label: row.label,
    isExpired: isExpired(row.expMonth, row.expYear),
  };
}

/** Loads the client, or fails closed. OWNER/ADMIN only. */
async function loadClient(clientId: unknown) {
  const gate = await requireOwnerAdmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  if (typeof clientId !== "string" || !clientId) {
    return { ok: false as const, error: "Invalid client" };
  }

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      email: true,
      stripeCustomerId: true,
      defaultPaymentMethodId: true,
    },
  });
  if (!client) return { ok: false as const, error: "Client not found" };
  return { ok: true as const, client };
}

/**
 * IDOR guard. A payment-method id is client-supplied, so before acting on it we
 * prove it belongs to THIS client's Stripe customer — confirmed against Stripe
 * itself (a local mirror row could be stale or forged). Fails closed.
 */
async function assertOwnedCard(
  clientId: string,
  stripeCustomerId: string | null,
  paymentMethodId: unknown
): Promise<{ ok: true; paymentMethodId: string } | { ok: false; error: string }> {
  if (
    typeof paymentMethodId !== "string" ||
    !/^pm_[A-Za-z0-9_]+$/.test(paymentMethodId)
  ) {
    return { ok: false, error: "Invalid card" };
  }
  if (!stripeCustomerId) return { ok: false, error: "Card not found" };

  let pm;
  try {
    pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  } catch {
    return { ok: false, error: "Card not found" };
  }

  const owner = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
  if (!owner || owner !== stripeCustomerId) {
    // Belongs to a different customer (or is unattached) — deny, and clear any
    // stale mirror row that still claims it for this client.
    await db.clientPaymentMethod
      .deleteMany({ where: { clientId, stripePaymentMethodId: paymentMethodId } })
      .catch(() => {});
    return { ok: false, error: "Card not found" };
  }
  return { ok: true, paymentMethodId };
}

/**
 * List the client's saved cards, syncing from Stripe (the system of record) into
 * the local mirror. Falls back to the mirror if Stripe is unreachable.
 */
export async function listClientPaymentMethods(
  clientId: string
): Promise<
  | ({ success: true } & ListClientPaymentMethodsResult)
  | { success: false; error: string }
> {
  const gate = await loadClient(clientId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { client } = gate;

  if (!client.stripeCustomerId) {
    // No Stripe customer yet ⇒ no cards can exist. Clear any orphan mirror rows.
    await db.clientPaymentMethod
      .deleteMany({ where: { clientId: client.id } })
      .catch(() => {});
    return { success: true, methods: [], synced: true, hasStripeCustomer: false };
  }

  try {
    const list = await stripe.paymentMethods.list({
      customer: client.stripeCustomerId,
      type: "card",
      limit: MAX_CARDS,
    });

    const liveIds = list.data.map((pm) => pm.id);
    // The stored default is only meaningful if the card still exists in Stripe.
    const defaultId =
      client.defaultPaymentMethodId &&
      liveIds.includes(client.defaultPaymentMethodId)
        ? client.defaultPaymentMethodId
        : null;

    for (const pm of list.data) {
      const data = {
        clientId: client.id,
        brand: pm.card?.brand ?? null,
        last4: pm.card?.last4 ?? null,
        expMonth: pm.card?.exp_month ?? null,
        expYear: pm.card?.exp_year ?? null,
        isDefault: pm.id === defaultId,
      };
      await db.clientPaymentMethod.upsert({
        where: { stripePaymentMethodId: pm.id },
        update: data,
        create: { ...data, stripePaymentMethodId: pm.id },
      });
    }

    // Drop mirror rows for cards detached outside this UI (Stripe dashboard,
    // customer portal). `notIn: []` is a no-op filter in Prisma, so an empty
    // Stripe list correctly clears every row for this client.
    await db.clientPaymentMethod.deleteMany({
      where: { clientId: client.id, stripePaymentMethodId: { notIn: liveIds } },
    });

    // Self-heal a dangling default so charges don't fail against a dead card.
    if (client.defaultPaymentMethodId && !defaultId) {
      await db.client.update({
        where: { id: client.id },
        data: { defaultPaymentMethodId: null },
      });
    }

    const rows = await db.clientPaymentMethod.findMany({
      where: { clientId: client.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return {
      success: true,
      methods: rows.map(toDTO),
      synced: true,
      hasStripeCustomer: true,
    };
  } catch (error) {
    console.error("listClientPaymentMethods: Stripe sync failed", error);
    const rows = await db.clientPaymentMethod.findMany({
      where: { clientId: client.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return {
      success: true,
      methods: rows.map(toDTO),
      synced: false,
      hasStripeCustomer: true,
    };
  }
}

/**
 * Persist a card from a succeeded Stripe SetupIntent (created by the shared
 * /api/stripe/setup-intent route for THIS client). Mirrors it into
 * ClientPaymentMethod and, when the client has no default yet, promotes it to
 * `Client.defaultPaymentMethodId` so the very first saved card is chargeable —
 * preserving Fixaro's existing single-card behaviour.
 */
export async function saveClientPaymentMethod(input: {
  clientId: string;
  setupIntentId: string;
}): Promise<
  { success: true; paymentMethodId: string } | { success: false; error: string }
> {
  const gate = await loadClient(input?.clientId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { client } = gate;

  if (
    typeof input?.setupIntentId !== "string" ||
    !/^seti_[A-Za-z0-9_]+$/.test(input.setupIntentId)
  ) {
    return { success: false, error: "Invalid card setup" };
  }

  let setupIntent;
  try {
    setupIntent = await stripe.setupIntents.retrieve(input.setupIntentId);
  } catch {
    return { success: false, error: "Could not verify card setup" };
  }
  if (setupIntent.status !== "succeeded") {
    return { success: false, error: `Card setup status: ${setupIntent.status}` };
  }

  const paymentMethodId =
    typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id ?? null;
  const customerId =
    typeof setupIntent.customer === "string"
      ? setupIntent.customer
      : setupIntent.customer?.id ?? null;

  if (!paymentMethodId) {
    return { success: false, error: "No card found on setup intent" };
  }

  // IDOR: the SetupIntent id is client-supplied. If this client already has a
  // Stripe customer, the intent MUST belong to it. If not, adopt the intent's
  // customer (the setup-intent route just created it for this clientId).
  if (client.stripeCustomerId && customerId && customerId !== client.stripeCustomerId) {
    return { success: false, error: "Card setup does not match this client" };
  }
  const stripeCustomerId = client.stripeCustomerId ?? customerId;
  if (!stripeCustomerId) {
    return { success: false, error: "Client has no Stripe customer" };
  }

  try {
    // Pull card display metadata from Stripe — never the PAN.
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    // Fails closed if the returned method somehow isn't attached to this customer.
    const owner = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
    if (owner && owner !== stripeCustomerId) {
      return { success: false, error: "Card setup does not match this client" };
    }

    const promote = !client.defaultPaymentMethodId;

    const data = {
      clientId: client.id,
      brand: pm.card?.brand ?? null,
      last4: pm.card?.last4 ?? null,
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
      isDefault: promote,
    };
    await db.clientPaymentMethod.upsert({
      where: { stripePaymentMethodId: paymentMethodId },
      update: data,
      create: { ...data, stripePaymentMethodId: paymentMethodId },
    });

    // Backfill stripeCustomerId if it wasn't stored yet, and set the default
    // when this is the client's first card so charges can run off-session.
    if (promote) {
      await stripe.customers
        .update(stripeCustomerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        })
        .catch((e) => console.error("saveClientPaymentMethod: invoice default", e));
    }
    await db.client.update({
      where: { id: client.id },
      data: {
        ...(client.stripeCustomerId ? {} : { stripeCustomerId }),
        ...(promote ? { defaultPaymentMethodId: paymentMethodId } : {}),
      },
    });

    revalidatePath(`/clients/${client.id}`);
    revalidatePath("/jobs");
    return { success: true, paymentMethodId };
  } catch (error) {
    console.error("saveClientPaymentMethod failed", error);
    return { success: false, error: "Could not save that card" };
  }
}

/**
 * Make a saved card the default. Updates BOTH `Client.defaultPaymentMethodId`
 * (what every charge path reads) and the `isDefault` mirror flags, plus the
 * Stripe customer's invoice default so off-session charges agree.
 */
export async function setDefaultPaymentMethod(input: {
  clientId: string;
  paymentMethodId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const gate = await loadClient(input?.clientId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { client } = gate;

  const owned = await assertOwnedCard(
    client.id,
    client.stripeCustomerId,
    input?.paymentMethodId
  );
  if (!owned.ok) return { success: false, error: owned.error };
  const { paymentMethodId } = owned;

  try {
    await stripe.customers.update(client.stripeCustomerId!, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    await db.$transaction([
      db.clientPaymentMethod.updateMany({
        where: { clientId: client.id },
        data: { isDefault: false },
      }),
      db.clientPaymentMethod.updateMany({
        where: { clientId: client.id, stripePaymentMethodId: paymentMethodId },
        data: { isDefault: true },
      }),
      db.client.update({
        where: { id: client.id },
        data: { defaultPaymentMethodId: paymentMethodId },
      }),
    ]);

    revalidatePath(`/clients/${client.id}`);
    revalidatePath("/jobs");
    return { success: true };
  } catch (error) {
    console.error("setDefaultPaymentMethod failed", error);
    return { success: false, error: "Could not set that card as default" };
  }
}

/**
 * Detach a saved card from the client. If it was the default, the newest
 * remaining card is promoted so auto-charging doesn't silently break; if it was
 * the last card, the default is cleared and the caller gets a warning.
 */
export async function deleteClientPaymentMethod(input: {
  clientId: string;
  paymentMethodId: string;
}): Promise<
  { success: true; warning: string | null } | { success: false; error: string }
> {
  const gate = await loadClient(input?.clientId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { client } = gate;

  const owned = await assertOwnedCard(
    client.id,
    client.stripeCustomerId,
    input?.paymentMethodId
  );
  if (!owned.ok) return { success: false, error: owned.error };
  const { paymentMethodId } = owned;

  try {
    try {
      await stripe.paymentMethods.detach(paymentMethodId);
    } catch (err) {
      // Already detached in Stripe — keep going so the local mirror converges
      // (idempotent remove). Anything else is a real failure.
      const code = (err as { code?: string })?.code;
      if (code !== "resource_missing") throw err;
    }

    await db.clientPaymentMethod.deleteMany({
      where: { clientId: client.id, stripePaymentMethodId: paymentMethodId },
    });

    let warning: string | null = null;

    if (client.defaultPaymentMethodId === paymentMethodId) {
      const next = await db.clientPaymentMethod.findFirst({
        where: { clientId: client.id },
        orderBy: { createdAt: "desc" },
      });

      if (next) {
        await stripe.customers.update(client.stripeCustomerId!, {
          invoice_settings: { default_payment_method: next.stripePaymentMethodId },
        });
        await db.$transaction([
          db.clientPaymentMethod.updateMany({
            where: { clientId: client.id },
            data: { isDefault: false },
          }),
          db.clientPaymentMethod.update({
            where: { id: next.id },
            data: { isDefault: true },
          }),
          db.client.update({
            where: { id: client.id },
            data: { defaultPaymentMethodId: next.stripePaymentMethodId },
          }),
        ]);
        warning = `Removed the default card — ${next.brand ?? "card"} •••• ${next.last4 ?? "????"} is now the default.`;
      } else {
        await db.client.update({
          where: { id: client.id },
          data: { defaultPaymentMethodId: null },
        });
        warning =
          "That was the client's only card. Jobs for this client can no longer be auto-charged until a new card is added.";
      }
    }

    revalidatePath(`/clients/${client.id}`);
    revalidatePath("/jobs");
    return { success: true, warning };
  } catch (error) {
    console.error("deleteClientPaymentMethod failed", error);
    return { success: false, error: "Could not remove that card" };
  }
}

/**
 * Email the client a one-time link to /add-card/[token] where they enter a card
 * via Stripe Elements — the same public flow used from a job, but scoped to the
 * client profile (no job needed).
 *
 * Rate-limit: a fresh, unused token minted in the last minute is reused instead
 * of issuing another, so a double-click (or spam attempt) can't fan out mail.
 */
export async function sendClientAddCardLink(
  clientId: string
): Promise<
  { success: true; expiresAt: string } | { success: false; error: string }
> {
  const gate = await loadClient(clientId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { client } = gate;

  if (!client.email) {
    return { success: false, error: "Client has no email on file" };
  }

  try {
    const recent = await db.clientCardSetupToken.findFirst({
      where: {
        clientId: client.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        createdAt: { gt: new Date(Date.now() - ADD_CARD_LINK_COOLDOWN_MS) },
      },
      orderBy: { createdAt: "desc" },
    });

    const token = recent?.token ?? randomBytes(24).toString("base64url");
    const expiresAt =
      recent?.expiresAt ?? new Date(Date.now() + ADD_CARD_LINK_TTL_MS);

    if (!recent) {
      await db.clientCardSetupToken.create({
        data: { clientId: client.id, token, expiresAt },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const result = await sendAccountEmail({
      to: client.email,
      name: client.name,
      role: "CUSTOMER",
      event: "add_card",
      link: `${appUrl}/add-card/${token}`,
    });

    if (!result.ok) {
      // Detail stays in the server log; the admin gets a generic message.
      console.error("sendClientAddCardLink: email failed", result);
      return { success: false, error: "Could not send the email" };
    }

    return { success: true, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    console.error("sendClientAddCardLink failed", error);
    return { success: false, error: "Could not send the email" };
  }
}
