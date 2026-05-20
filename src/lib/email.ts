import { Resend } from "resend";
import { db } from "@/db";

const FROM = process.env.EMAIL_FROM ?? "Cleano <no-reply@cleano.ca>";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — emails will be skipped");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function fmt(n: number | null | undefined) {
  return `$${(n ?? 0).toFixed(2)}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Shared layout ──────────────────────────────────────────────────────────

function layout(body: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f2ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07)">
<tr><td style="background:#00424a;padding:28px 32px">
<span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-.3px">Cleano</span>
</td></tr>
<tr><td style="padding:32px">${body}</td></tr>
<tr><td style="background:#f5f2ed;padding:20px 32px;font-size:12px;color:#888;text-align:center">
© ${new Date().getFullYear()} Cleano · care@cleano.ca
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#00424a">${text}</h1>`;
}
function p(text: string) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333">${text}</p>`;
}
function section(rows: [string, string][]) {
  const inner = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;font-size:14px;color:#666;width:45%">${k}</td>
         <td style="padding:8px 0;font-size:14px;color:#111;font-weight:500;text-align:right">${v}</td></tr>`
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:20px 0">${inner}</table>`;
}
function btn(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:8px;padding:12px 28px;background:#00424a;color:#fff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">${label}</a>`;
}

// ── Send + log helper ──────────────────────────────────────────────────────

async function deliver(opts: {
  to: string;
  subject: string;
  html: string;
  logId?: string;
}) {
  const resend = getResend();
  if (!resend) {
    if (opts.logId) {
      await db.emailLog.update({
        where: { id: opts.logId },
        data: { status: "FAILED", error: "RESEND_API_KEY not configured" },
      }).catch(() => {});
    }
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (opts.logId) {
      if (error) {
        await db.emailLog.update({
          where: { id: opts.logId },
          data: { status: "FAILED", error: error.message },
        });
      } else {
        await db.emailLog.update({
          where: { id: opts.logId },
          data: { status: "SENT", sentAt: new Date(), providerId: data?.id },
        });
      }
    }
    return { ok: !error, error };
  } catch (err: any) {
    if (opts.logId) {
      await db.emailLog
        .update({
          where: { id: opts.logId },
          data: { status: "FAILED", error: String(err?.message ?? err) },
        })
        .catch(() => {});
    }
    return { ok: false, error: err };
  }
}

// ── Email senders ──────────────────────────────────────────────────────────

export async function sendBookingConfirmation(opts: {
  to: string;
  clientName: string;
  jobId: string;
  jobNumber: number;
  startTime: string;
  isFlexible: boolean;
  address: string;
  serviceType: string | null;
  subtotal: number | null;
  gst: number | null;
  qst: number | null;
  total: number | null;
  logId?: string;
}) {
  const timeLine = opts.isFlexible
    ? "Flexible — our team will confirm the time"
    : fmtTime(opts.startTime);

  const html = layout(
    h1(`Booking confirmed, ${opts.clientName.split(" ")[0]}!`) +
      p(`We've got you down for a ${opts.serviceType ?? "cleaning"} on <strong>${fmtDate(opts.startTime)}</strong>.`) +
      section([
        ["Date", fmtDate(opts.startTime)],
        ["Time", timeLine],
        ["Address", opts.address],
        ["Subtotal", fmt(opts.subtotal)],
        ["GST (5%)", fmt(opts.gst)],
        ["QST (9.975%)", fmt(opts.qst)],
        ["Total", fmt(opts.total)],
      ]) +
      p("Your card will be charged only after your cleaning is complete. You'll receive a receipt by email.") +
      btn("View booking", `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/portal/bookings/${opts.jobId}`)
  );

  return deliver({ to: opts.to, subject: `Cleano booking confirmed — ${fmtDate(opts.startTime)}`, html, logId: opts.logId });
}

export async function sendReminder24h(opts: {
  to: string;
  clientName: string;
  jobId: string;
  startTime: string;
  address: string;
  serviceType: string | null;
  cleanerNames: string[];
  logId?: string;
}) {
  const cleanerLine =
    opts.cleanerNames.length > 0
      ? `Your cleaner${opts.cleanerNames.length > 1 ? "s" : ""}: <strong>${opts.cleanerNames.join(", ")}</strong>`
      : "We're finalizing your cleaner assignment.";

  const html = layout(
    h1("Your cleaning is tomorrow!") +
      p(`Hi ${opts.clientName.split(" ")[0]}, just a friendly reminder about your ${opts.serviceType ?? "cleaning"} tomorrow.`) +
      section([
        ["Date", fmtDate(opts.startTime)],
        ["Time", fmtTime(opts.startTime)],
        ["Address", opts.address],
      ]) +
      p(cleanerLine) +
      p("Please ensure access to your home and any parking instructions are noted. See you tomorrow!") +
      btn("View booking", `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/portal/bookings/${opts.jobId}`)
  );

  return deliver({ to: opts.to, subject: `Reminder: your Cleano cleaning is tomorrow`, html, logId: opts.logId });
}

export async function sendReceipt(opts: {
  to: string;
  clientName: string;
  jobId: string;
  jobNumber: number;
  startTime: string;
  address: string;
  serviceType: string | null;
  subtotal: number | null;
  gst: number | null;
  qst: number | null;
  total: number | null;
  ratingToken?: string | null;
  logId?: string;
}) {
  const ratingSection = opts.ratingToken
    ? btn("Rate your cleaning", `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/rate/${opts.ratingToken}`)
    : "";

  const html = layout(
    h1("Payment received — thanks!") +
      p(`Hi ${opts.clientName.split(" ")[0]}, here's your receipt for job #${opts.jobNumber}.`) +
      section([
        ["Date", fmtDate(opts.startTime)],
        ["Service", opts.serviceType ?? "Cleaning"],
        ["Address", opts.address],
        ["Subtotal", fmt(opts.subtotal)],
        ["GST (5%)", fmt(opts.gst)],
        ["QST (9.975%)", fmt(opts.qst)],
        ["Total charged", fmt(opts.total)],
      ]) +
      p("You can also download a PDF receipt from your client portal.") +
      btn("Download receipt", `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/receipts/${opts.jobId}`) +
      (ratingSection ? `<div style="margin-top:24px">${p("How did we do? A quick rating helps our team a lot.")}</div>${ratingSection}` : "")
  );

  return deliver({ to: opts.to, subject: `Cleano receipt — job #${opts.jobNumber}`, html, logId: opts.logId });
}

export async function sendRefundConfirmation(opts: {
  to: string;
  clientName: string;
  jobId: string;
  jobNumber: number;
  refundAmount: number;
  reason?: string | null;
  logId?: string;
}) {
  const html = layout(
    h1("Refund issued") +
      p(`Hi ${opts.clientName.split(" ")[0]}, we've issued a refund of <strong>${fmt(opts.refundAmount)}</strong> for job #${opts.jobNumber}.`) +
      (opts.reason ? p(`Reason: ${opts.reason}`) : "") +
      p("The amount will appear on your original payment method within 5–10 business days, depending on your bank.") +
      p("If you have any questions, reply to this email or text us at (514) 555-CLEAN.")
  );

  return deliver({ to: opts.to, subject: `Cleano refund — job #${opts.jobNumber}`, html, logId: opts.logId });
}

// ── Queue helpers (create log + send immediately) ──────────────────────────

export async function queueAndSendConfirmation(jobId: string) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      client: { select: { name: true, email: true } },
      cleaners: { select: { name: true } },
    },
  }) as any;
  if (!job?.client?.email) return;

  const existing = await db.emailLog.findFirst({
    where: { jobId, kind: "BOOKING_CONFIRMATION" },
    select: { id: true },
  });

  const log = existing
    ? await db.emailLog.update({ where: { id: existing.id }, data: { status: "PENDING" } })
    : await db.emailLog.create({
        data: {
          kind: "BOOKING_CONFIRMATION",
          recipient: job.client.email,
          subject: `Booking confirmed`,
          status: "PENDING",
          jobId,
        },
      });

  await sendBookingConfirmation({
    to: job.client.email,
    clientName: job.client.name,
    jobId: job.id,
    jobNumber: job.jobNumber,
    startTime: job.startTime.toISOString(),
    isFlexible: job.isFlexible,
    address: job.location ?? "",
    serviceType: job.jobType,
    subtotal: job.subtotalAmount,
    gst: job.gstAmount,
    qst: job.qstAmount,
    total: job.price,
    logId: log.id,
  });
}

export async function queueAndSendReceipt(jobId: string) {
  const [job, ratingToken] = await Promise.all([
    db.job.findUnique({
      where: { id: jobId },
      include: { client: { select: { name: true, email: true } } },
    }),
    db.jobRatingToken.findFirst({
      where: { jobId, usedAt: null },
      select: { token: true },
    }),
  ]);
  if (!(job as any)?.client?.email) return;
  const client = (job as any).client as { name: string; email: string };

  const log = await db.emailLog.create({
    data: {
      kind: "RECEIPT",
      recipient: client.email,
      subject: `Receipt for job #${job!.jobNumber}`,
      status: "PENDING",
      jobId,
    },
  });

  await sendReceipt({
    to: client.email,
    clientName: client.name,
    jobId: job!.id,
    jobNumber: job!.jobNumber,
    startTime: job!.startTime.toISOString(),
    address: job!.location ?? "",
    serviceType: job!.jobType,
    subtotal: job!.subtotalAmount,
    gst: job!.gstAmount,
    qst: job!.qstAmount,
    total: job!.price,
    ratingToken: ratingToken?.token ?? null,
    logId: log.id,
  });
}

export async function queueAndSendRefund(jobId: string, refundAmount: number, reason?: string | null) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { client: { select: { name: true, email: true } } },
  }) as any;
  if (!job?.client?.email) return;

  const log = await db.emailLog.create({
    data: {
      kind: "REFUND",
      recipient: job.client.email,
      subject: `Refund for job #${job.jobNumber}`,
      status: "PENDING",
      jobId,
    },
  });

  await sendRefundConfirmation({
    to: job.client.email,
    clientName: job.client.name,
    jobId: job.id,
    jobNumber: job.jobNumber,
    refundAmount,
    reason,
    logId: log.id,
  });
}
