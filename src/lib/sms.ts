/**
 * Twilio SMS sender.
 *
 * Wired to four notification keys per client confirmation:
 *   - Booking confirmation
 *   - "On the way"
 *   - Reminders
 *   - Cancellation
 *
 * No-op until the Twilio env vars are present, so the app keeps running
 * before credentials are pasted in. Set these in .env.local (dev) and
 * Vercel project env (prod):
 *
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER             (E.164, e.g. +15551234567)
 *   TWILIO_MESSAGING_SERVICE_SID   (alternative to TWILIO_FROM_NUMBER)
 */

import { isNotificationEnabled } from "./notifications";
import type { Recipient } from "./notifications/catalog";

export interface SmsGate {
  recipient: Recipient;
  key: string;
}

interface SendSmsInput {
  to: string;
  body: string;
  notification?: SmsGate;
}

interface SendResult {
  sent: boolean;
  reason?: string;
  twilioSid?: string;
}

function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );
}

function normalizeE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+") && /^\+\d{8,15}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendSms(input: SendSmsInput): Promise<SendResult> {
  if (input.notification) {
    const allowed = await isNotificationEnabled(
      input.notification.recipient,
      input.notification.key,
      "SMS"
    );
    if (!allowed) return { sent: false, reason: "disabled-by-catalog" };
  }

  if (!twilioConfigured()) {
    return { sent: false, reason: "twilio-not-configured" };
  }

  const to = normalizeE164(input.to);
  if (!to) return { sent: false, reason: "invalid-phone" };

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER;
  const msgService = process.env.TWILIO_MESSAGING_SERVICE_SID;

  const params = new URLSearchParams();
  params.set("To", to);
  params.set("Body", input.body);
  if (msgService) params.set("MessagingServiceSid", msgService);
  else if (from) params.set("From", from);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    const data = (await res.json()) as { sid?: string; message?: string };
    if (!res.ok) {
      console.error("Twilio send failed:", res.status, data);
      return { sent: false, reason: data.message ?? `http-${res.status}` };
    }
    return { sent: true, twilioSid: data.sid };
  } catch (err) {
    console.error("Twilio send error:", err);
    return { sent: false, reason: "network-error" };
  }
}

/* ---------------------------------------------------------------------- */
/* Convenience wrappers for the four enabled events. Use these so the     */
/* catalog key + body shape stay consistent at every call site.           */
/* ---------------------------------------------------------------------- */

export function smsBookingConfirmation(opts: {
  to: string;
  jobNumber: number;
  startTime: string;
}) {
  const when = new Date(opts.startTime).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return sendSms({
    to: opts.to,
    body: `Fixaro: booking #${opts.jobNumber} confirmed for ${when}. Reply STOP to opt out.`,
    notification: { recipient: "CUSTOMER", key: "cust.booking.confirmed" },
  });
}

/**
 * Customer "your Pro is on the way" text. Fired once, by the provider tapping
 * "On my way" (see actions/onMyWay.ts). Gated by the CUSTOMER catalog key, so
 * an opted-out customer is skipped inside sendSms — callers never branch on it.
 */
export function smsOnTheWay(opts: {
  to: string;
  proName: string;
  etaMin: number;
}) {
  return sendSms({
    to: opts.to,
    body: `Fixaro: ${opts.proName} is on the way, about ${opts.etaMin} min out. Reply STOP to opt out.`,
    notification: { recipient: "CUSTOMER", key: "cust.booking.on_the_way" },
  });
}

/**
 * Admin heads-up that a Pro tapped "On my way". Gated by the existing
 * `admin.clock.on_the_way` catalog key (SMS defaults to OFF there, so this is
 * a no-op until an admin turns it on in Settings → Notifications).
 */
export function smsAdminOnTheWay(opts: {
  to: string;
  proName: string;
  jobNumber: number;
  etaMin: number;
}) {
  return sendSms({
    to: opts.to,
    body: `Fixaro: ${opts.proName} is on the way to booking #${opts.jobNumber} (~${opts.etaMin} min).`,
    notification: { recipient: "ADMIN", key: "admin.clock.on_the_way" },
  });
}

export function smsReminder(opts: {
  to: string;
  jobNumber: number;
  startTime: string;
}) {
  const when = new Date(opts.startTime).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return sendSms({
    to: opts.to,
    body: `Fixaro reminder: booking #${opts.jobNumber} is scheduled for ${when}.`,
    notification: { recipient: "CUSTOMER", key: "cust.reminders.booking_reminder_2" },
  });
}

export function smsCancellation(opts: {
  to: string;
  jobNumber: number;
  reason?: string;
}) {
  const tail = opts.reason ? ` (${opts.reason})` : "";
  return sendSms({
    to: opts.to,
    body: `Fixaro: booking #${opts.jobNumber} has been canceled${tail}. We'll be in touch.`,
    notification: { recipient: "CUSTOMER", key: "cust.cancel.booking_cancellation" },
  });
}

// Painting final-amount offer (SOP §6/§11). Per Appendix-A Q4, final amounts go
// out on all available channels — email + in-app portal + this SMS.
export function smsPaintingOffer(opts: {
  to: string;
  jobNumber: number;
  finalAmount: number;
}) {
  return sendSms({
    to: opts.to,
    body: `Fixaro: your painting quote for booking #${opts.jobNumber} is $${opts.finalAmount.toFixed(2)}. Accept or reject it in your portal. Reply STOP to opt out.`,
    notification: { recipient: "CUSTOMER", key: "cust.painting.final_offer" },
  });
}

/**
 * On-site scope change (Phase 2B). The Pro proposed a new all-in price mid-job;
 * the customer approves or rejects it in the portal. Nothing is charged until
 * they do. Catalog `cust.scope.revision_requested` — EMAIL + SMS.
 */
export function smsPriceRevisionRequest(opts: {
  to: string;
  jobNumber: number;
  proposedPrice: number;
}) {
  return sendSms({
    to: opts.to,
    body: `Fixaro: your Pro found extra work on booking #${opts.jobNumber} and proposed a new price of $${opts.proposedPrice.toFixed(2)}. Nothing is charged until you approve it in your portal. Reply STOP to opt out.`,
    notification: { recipient: "CUSTOMER", key: "cust.scope.revision_requested" },
  });
}
