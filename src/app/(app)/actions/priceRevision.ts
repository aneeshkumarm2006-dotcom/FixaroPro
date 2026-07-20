"use server";

/**
 * Phase 2B — on-site scope change / price revision.
 *
 * The assigned Pro finds work outside the booked scope mid-job, proposes a new
 * ALL-IN (tax-inclusive) price with a mandatory reason, and the customer
 * approves or rejects it from their portal booking. Nothing about the job's
 * money moves until the customer (or ops, overriding) answers.
 *
 * This is deliberately NOT the painting bid flow: that is a pre-job provider
 * bid with no customer approval step. This one is mid-job and customer-gated.
 *
 * ── What approval actually changes ────────────────────────────────────────
 * APPROVE rewrites the CLIENT charge only, and how it does so depends on the
 * catalog pricing model (D0.7), because "what the customer agreed to" differs:
 *
 *   • HOURLY (with a booked baseline) — the agreed quantity is the DELTA for the
 *     extra scope. We add the pre-tax delta to the immutable baseline
 *     (`bookedSubtotalAmount`) and set `price` to live-price + delta. This is
 *     load-bearing: computeChargeAmount() rebuilds an hourly price at every
 *     clock-out and clock-correction as
 *         (bookedSubtotalAmount − basePriceAmount + labour) + taxes
 *     so an absolute write to `price` would be silently reverted the moment the
 *     Pro clocked out. It also means the absolute total legitimately moves while
 *     a revision is pending (more hours clocked), which is expected, not drift.
 *
 *   • FIXED / QUOTE (and legacy hourly with no baseline) — the stored price is
 *     authoritative and static, so the customer agreed to an ABSOLUTE figure.
 *     `price` is set to it, and if the live price moved underneath them we fail
 *     closed rather than charge a number never presented in its context.
 *
 * Either way `subtotalAmount` / `gstAmount` / `qstAmount` are re-split from the
 * new tax-inclusive total using the same helper the rest of the app uses.
 *
 * PROVIDER PAY IS NOT TOUCHED — by design, and never silently. Since Fix #3
 * pay is `resolved hourly rate × clocked hours (+ tip share)` (see
 * src/lib/provider-pay.ts, applied in clockOut.ts). It is not derived from what
 * the customer pays, so a price revision must not move it. The Pro is paid more
 * for extra scope only through the extra HOURS they clock, which flows
 * automatically at clock-out. Ops who want to pay a scope premium beyond the
 * clock must do it explicitly via the per-job `providerHourlyRate` override or
 * a payout adjustment — this file will not do it for them.
 */

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getBillingConfig, getServicePricingModel } from "@/lib/billing";
import { COMBINED_RATE, taxInclusiveBreakdown } from "@/lib/tax";
import { isNotificationEnabled } from "@/lib/notifications";
import {
  sendCustomerPriceRevisionRequest,
  sendProviderPriceRevisionResponse,
} from "@/lib/email";
import { smsPriceRevisionRequest } from "@/lib/sms";
import { rateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

// Sensitive-operation budgets, keyed by the authenticated user id (not IP —
// these actions are behind a session, so the principal is the right subject).
// Raising a revision fans out an email AND an SMS to the customer, so an
// unbounded loop is a notification bomb and a Twilio bill. Responding moves
// money. Both are generous next to real human behaviour and self-heal in 60s.
const REQUEST_LIMIT = { name: "price-revision-request", limit: 5, windowMs: 60_000 };
const RESPOND_LIMIT = { name: "price-revision-respond", limit: 10, windowMs: 60_000 };

// ── Validation bounds ──────────────────────────────────────────────────────
// A revision is an all-in price for a single residential handyman job. Anything
// outside this band is treated as a fat-fingered entry or an attack, not a
// legitimate quote, and is rejected at the boundary.
const MIN_PRICE = 1;
const MAX_PRICE = 100_000;
const MIN_REASON = 10;
const MAX_REASON = 2000;
const MAX_NOTE = 1000;

// `unknown` (not Record<string, never>) so a payload-free success is expressible:
// `{ success: true } & Record<string, never>` forces every property to `never`,
// which makes even `success: true` unassignable.
type ActionResult<T = unknown> =
  | ({ success: true } & T)
  | { success: false; error: string };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Strict money parse. Rejects NaN/Infinity/negatives/out-of-band and snaps to cents. */
function parsePrice(input: unknown): number | null {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return null;
  const v = round2(n);
  if (v < MIN_PRICE || v > MAX_PRICE) return null;
  return v;
}

function parseText(input: unknown, min: number, max: number): string | null {
  if (typeof input !== "string") return null;
  const t = input.trim();
  if (t.length < min || t.length > max) return null;
  return t;
}

function isNonEmptyId(input: unknown): input is string {
  return typeof input === "string" && input.length > 0 && input.length <= 64;
}

function isAdminRole(role: string | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** A job whose money is settled is off-limits to scope changes, both directions. */
function jobIsSettled(job: { status: string; paymentReceived: boolean }): boolean {
  return job.status === "PAID" || job.status === "CANCELLED" || job.paymentReceived;
}

const money = (n: number) => `$${n.toFixed(2)}`;

// ───────────────────────────────────────────────────────────────────────────
// Provider: request a revision
// ───────────────────────────────────────────────────────────────────────────

/**
 * Request an on-site price revision. Callable by the assigned Pro (lead or crew)
 * or by an admin acting on their behalf over the phone.
 *
 * Gates (all fail closed):
 *   • authenticated
 *   • assigned to THIS job, or OWNER/ADMIN
 *   • job is IN_PROGRESS and not paid/cancelled — this is an ON-SITE change
 *   • no other PENDING revision on the job
 */
export async function requestPriceRevision(input: {
  jobId: string;
  proposedPrice: number;
  reason: string;
}): Promise<ActionResult<{ revisionId: string }>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Not authenticated" };

    if (!rateLimit(session.user.id, REQUEST_LIMIT).ok) {
      return { success: false, error: RATE_LIMIT_MESSAGE };
    }

    if (!isNonEmptyId(input?.jobId)) {
      return { success: false, error: "Invalid request" };
    }
    const proposedPrice = parsePrice(input.proposedPrice);
    if (proposedPrice == null) {
      return {
        success: false,
        error: `Enter a valid price between ${money(MIN_PRICE)} and ${money(MAX_PRICE)}.`,
      };
    }
    const reason = parseText(input.reason, MIN_REASON, MAX_REASON);
    if (!reason) {
      return {
        success: false,
        error: `Explain the scope change in ${MIN_REASON}–${MAX_REASON} characters — the customer sees this.`,
      };
    }

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        paymentReceived: true,
        price: true,
        employeeId: true,
        clientName: true,
        cleaners: { select: { id: true } },
        client: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!job) return { success: false, error: "Job not found" };

    const role = (session.user as { role?: string }).role;
    const admin = isAdminRole(role);
    const assigned =
      job.employeeId === session.user.id ||
      job.cleaners.some((c) => c.id === session.user.id);
    if (!assigned && !admin) {
      return { success: false, error: "You are not assigned to this job" };
    }

    if (jobIsSettled(job)) {
      return {
        success: false,
        error: "This job is closed for price changes — contact ops.",
      };
    }
    if (job.status !== "IN_PROGRESS") {
      return {
        success: false,
        error: "Price revisions can only be raised while the job is in progress.",
      };
    }

    const previousPrice = round2(job.price ?? 0);
    if (previousPrice <= 0) {
      return {
        success: false,
        error: "This job has no price on file yet — ops must set one first.",
      };
    }
    if (proposedPrice === previousPrice) {
      return { success: false, error: "The proposed price matches the current price." };
    }

    // One PENDING revision per job. Re-checked inside the transaction so two
    // concurrent submits can't both land; the loser gets the friendly error.
    const created = await db.$transaction(async (tx) => {
      const existing = await tx.jobPriceRevision.findFirst({
        where: { jobId: job.id, status: "PENDING" },
        select: { id: true },
      });
      if (existing) return null;

      const revision = await tx.jobPriceRevision.create({
        data: {
          jobId: job.id,
          requestedById: session.user.id,
          requestedByName: session.user.name ?? null,
          previousPrice,
          proposedPrice,
          reason,
          status: "PENDING",
        },
        select: { id: true },
      });

      await tx.jobLog.create({
        data: {
          jobId: job.id,
          userId: session.user.id,
          action: "NOTE_ADDED",
          description:
            `Price revision requested by ${session.user.name ?? "a Pro"}${admin && !assigned ? " (admin)" : ""}: ` +
            `${money(previousPrice)} → ${money(proposedPrice)}. Reason: ${reason} ` +
            `Awaiting customer approval — the job price is unchanged until they respond.`,
        },
      });

      return revision;
    });

    if (!created) {
      return {
        success: false,
        error: "A price revision is already awaiting the customer's response.",
      };
    }

    await logAudit({
      entityType: "JobPriceRevision",
      entityId: created.id,
      action: "PRICE_REVISION_REQUESTED",
      description: `Job #${job.jobNumber}: price revision requested ${money(previousPrice)} → ${money(proposedPrice)}`,
      field: "price",
      oldValue: String(previousPrice),
      newValue: String(proposedPrice),
      reason,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    // Notify the customer (catalog `cust.scope.revision_requested` — EMAIL+SMS,
    // each gated on its own toggle). Fire-and-forget: a delivery failure must
    // not roll back a request that is already recorded.
    void notifyCustomerOfRequest({
      clientEmail: job.client?.email ?? null,
      clientPhone: job.client?.phone ?? null,
      clientName: job.client?.name ?? job.clientName ?? "there",
      jobId: job.id,
      jobNumber: job.jobNumber,
      previousPrice,
      proposedPrice,
      reason,
      providerName: session.user.name ?? null,
    });

    // Ops visibility — the request also surfaces in /requests.
    void raiseAdminPendingAlert({
      jobId: job.id,
      jobNumber: job.jobNumber,
      previousPrice,
      proposedPrice,
    });

    revalidatePath(`/my-jobs/${job.id}`);
    revalidatePath(`/jobs/${job.id}`);
    revalidatePath("/requests");
    revalidatePath(`/portal/bookings/${job.id}`);
    return { success: true, revisionId: created.id };
  } catch (error) {
    console.error("requestPriceRevision failed", error);
    return { success: false, error: "Failed to submit the price revision" };
  }
}

/**
 * The requesting Pro (or an admin) withdraws their own PENDING revision before
 * the customer answers — e.g. they mis-typed, or resolved it by phone.
 */
export async function cancelPriceRevision(input: {
  revisionId: string;
  note?: string;
}): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Not authenticated" };
    if (!isNonEmptyId(input?.revisionId)) {
      return { success: false, error: "Invalid request" };
    }
    const note =
      input.note === undefined ? null : parseText(input.note, 0, MAX_NOTE) ?? null;

    const revision = await db.jobPriceRevision.findUnique({
      where: { id: input.revisionId },
      select: {
        id: true,
        status: true,
        requestedById: true,
        previousPrice: true,
        proposedPrice: true,
        job: { select: { id: true, jobNumber: true } },
      },
    });
    if (!revision) return { success: false, error: "Request not found" };

    const role = (session.user as { role?: string }).role;
    if (revision.requestedById !== session.user.id && !isAdminRole(role)) {
      return { success: false, error: "Not authorized" };
    }
    if (revision.status !== "PENDING") {
      return { success: false, error: "This request has already been resolved." };
    }

    const now = new Date();
    await db.$transaction([
      db.jobPriceRevision.updateMany({
        // Guarded by status so a concurrent customer approval wins cleanly
        // rather than being overwritten.
        where: { id: revision.id, status: "PENDING" },
        data: {
          status: "CANCELLED",
          respondedAt: now,
          resolvedById: session.user.id,
          resolutionNote: note,
        },
      }),
      db.jobLog.create({
        data: {
          jobId: revision.job.id,
          userId: session.user.id,
          action: "NOTE_ADDED",
          description:
            `Price revision (${money(revision.previousPrice)} → ${money(revision.proposedPrice)}) withdrawn by ` +
            `${session.user.name ?? "the requester"}. The job price is unchanged.${note ? ` Note: ${note}` : ""}`,
        },
      }),
    ]);

    await logAudit({
      entityType: "JobPriceRevision",
      entityId: revision.id,
      action: "PRICE_REVISION_CANCELLED",
      description: `Job #${revision.job.jobNumber}: price revision withdrawn by requester`,
      reason: note,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidatePath(`/my-jobs/${revision.job.id}`);
    revalidatePath("/requests");
    revalidatePath(`/portal/bookings/${revision.job.id}`);
    return { success: true };
  } catch (error) {
    console.error("cancelPriceRevision failed", error);
    return { success: false, error: "Failed to withdraw the request" };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Customer: approve / reject
// ───────────────────────────────────────────────────────────────────────────

/**
 * Customer responds to a pending revision from their portal booking.
 *
 * IDOR guard follows portal/actions/requestCancellation.ts: the session email
 * must match the email on the Client that owns the job. A revision id alone is
 * never enough.
 */
export async function respondToPriceRevision(input: {
  revisionId: string;
  response: "APPROVE" | "REJECT";
}): Promise<ActionResult<{ newPrice: number }>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };

    const email = session.user.email?.toLowerCase();
    if (!email) return { success: false, error: "Session has no email" };

    if (!rateLimit(session.user.id, RESPOND_LIMIT).ok) {
      return { success: false, error: RATE_LIMIT_MESSAGE };
    }

    if (!isNonEmptyId(input?.revisionId)) {
      return { success: false, error: "Invalid request" };
    }
    if (input.response !== "APPROVE" && input.response !== "REJECT") {
      return { success: false, error: "Invalid response" };
    }

    const revision = await db.jobPriceRevision.findUnique({
      where: { id: input.revisionId },
      include: {
        job: {
          select: {
            id: true,
            jobNumber: true,
            jobType: true,
            status: true,
            paymentReceived: true,
            price: true,
            bookedSubtotalAmount: true,
            employeeId: true,
            client: { select: { id: true, email: true } },
          },
        },
      },
    });
    if (!revision) return { success: false, error: "Request not found" };

    // IDOR: the authenticated principal must own this job's client record.
    if (revision.job.client?.email?.toLowerCase() !== email) {
      return { success: false, error: "Not authorized" };
    }
    if (revision.status !== "PENDING") {
      return { success: false, error: "This request has already been resolved." };
    }
    if (jobIsSettled(revision.job)) {
      return {
        success: false,
        error: "This booking is closed for price changes — please contact us.",
      };
    }

    // Re-validate the stored amount before it becomes money. A row that drifted
    // outside the accepted band is refused rather than applied.
    const proposedPrice = parsePrice(revision.proposedPrice);
    if (proposedPrice == null) {
      console.error("price revision has an out-of-band amount", revision.id);
      return {
        success: false,
        error: "This request is no longer valid — please contact us.",
      };
    }

    const approved = input.response === "APPROVE";
    const result = await applyRevisionDecision({
      revision: { id: revision.id, previousPrice: revision.previousPrice, proposedPrice },
      job: revision.job,
      approved,
      actorId: session.user.id,
      actorLabel: "the customer",
      note: null,
    });
    if (!result.applied) {
      return {
        success: false,
        error: result.drift
          ? "The price on this job has changed since this request was raised — it needs to be raised again."
          : "This request has already been resolved.",
      };
    }

    await logAudit({
      entityType: "JobPriceRevision",
      entityId: revision.id,
      action: approved ? "PRICE_REVISION_APPROVED" : "PRICE_REVISION_REJECTED",
      description:
        `Job #${revision.job.jobNumber}: customer ${approved ? "approved" : "rejected"} price revision ` +
        `${money(revision.previousPrice)} → ${money(proposedPrice)}`,
      field: "price",
      oldValue: String(revision.previousPrice),
      newValue: String(approved ? proposedPrice : revision.previousPrice),
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    void notifyProviderOfResponse({
      jobId: revision.job.id,
      jobNumber: revision.job.jobNumber,
      requestedById: revision.requestedById,
      fallbackProviderId: revision.job.employeeId,
      approved,
      previousPrice: revision.previousPrice,
      proposedPrice,
      resolutionNote: null,
      resolvedByAdmin: false,
    });

    revalidatePath("/portal");
    revalidatePath("/portal/bookings");
    revalidatePath(`/portal/bookings/${revision.job.id}`);
    revalidatePath(`/my-jobs/${revision.job.id}`);
    revalidatePath(`/jobs/${revision.job.id}`);
    revalidatePath("/requests");
    return { success: true, newPrice: result.newPrice };
  } catch (error) {
    console.error("respondToPriceRevision failed", error);
    return { success: false, error: "Failed to submit your response" };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Admin: override / cancel
// ───────────────────────────────────────────────────────────────────────────

/**
 * Ops override from /requests. Used when the customer agreed by phone, when the
 * revision was raised in error, or when ops decline it outright. A reason is
 * mandatory — this is someone moving a customer's bill without the customer
 * clicking anything, so the audit trail has to explain itself.
 */
export async function adminResolvePriceRevision(input: {
  revisionId: string;
  decision: "APPROVE" | "REJECT" | "CANCEL";
  note: string;
}): Promise<ActionResult<{ newPrice: number }>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!isAdminRole(role)) return { success: false, error: "Not authorized" };

    if (!isNonEmptyId(input?.revisionId)) {
      return { success: false, error: "Invalid request" };
    }
    if (
      input.decision !== "APPROVE" &&
      input.decision !== "REJECT" &&
      input.decision !== "CANCEL"
    ) {
      return { success: false, error: "Invalid decision" };
    }
    const note = parseText(input.note, MIN_REASON, MAX_NOTE);
    if (!note) {
      return {
        success: false,
        error: `Give a reason of at least ${MIN_REASON} characters for the override.`,
      };
    }

    const revision = await db.jobPriceRevision.findUnique({
      where: { id: input.revisionId },
      include: {
        job: {
          select: {
            id: true,
            jobNumber: true,
            jobType: true,
            status: true,
            paymentReceived: true,
            price: true,
            bookedSubtotalAmount: true,
            employeeId: true,
          },
        },
      },
    });
    if (!revision) return { success: false, error: "Request not found" };
    if (revision.status !== "PENDING") {
      return { success: false, error: "This request has already been resolved." };
    }
    if (jobIsSettled(revision.job)) {
      return { success: false, error: "This job is closed for price changes." };
    }

    const proposedPrice = parsePrice(revision.proposedPrice);
    if (proposedPrice == null) {
      console.error("price revision has an out-of-band amount", revision.id);
      return { success: false, error: "This request is no longer valid." };
    }

    if (input.decision === "CANCEL") {
      const now = new Date();
      const updated = await db.$transaction(async (tx) => {
        const res = await tx.jobPriceRevision.updateMany({
          where: { id: revision.id, status: "PENDING" },
          data: {
            status: "CANCELLED",
            respondedAt: now,
            resolvedById: session.user.id,
            resolutionNote: note,
          },
        });
        if (res.count === 0) return false;
        await tx.jobLog.create({
          data: {
            jobId: revision.job.id,
            userId: session.user.id,
            action: "NOTE_ADDED",
            description:
              `Price revision (${money(revision.previousPrice)} → ${money(proposedPrice)}) cancelled by ops ` +
              `(${session.user.name ?? "admin"}). The job price is unchanged. Reason: ${note}`,
          },
        });
        return true;
      });
      if (!updated) {
        return { success: false, error: "This request has already been resolved." };
      }

      await logAudit({
        entityType: "JobPriceRevision",
        entityId: revision.id,
        action: "PRICE_REVISION_CANCELLED",
        description: `Job #${revision.job.jobNumber}: price revision cancelled by ops`,
        reason: note,
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
      });

      void notifyProviderOfResponse({
        jobId: revision.job.id,
        jobNumber: revision.job.jobNumber,
        requestedById: revision.requestedById,
        fallbackProviderId: revision.job.employeeId,
        approved: false,
        previousPrice: revision.previousPrice,
        proposedPrice,
        resolutionNote: note,
        resolvedByAdmin: true,
      });

      revalidatePath("/requests");
      revalidatePath(`/jobs/${revision.job.id}`);
      revalidatePath(`/my-jobs/${revision.job.id}`);
      revalidatePath(`/portal/bookings/${revision.job.id}`);
      return { success: true, newPrice: round2(revision.job.price ?? 0) };
    }

    const approved = input.decision === "APPROVE";
    const result = await applyRevisionDecision({
      revision: { id: revision.id, previousPrice: revision.previousPrice, proposedPrice },
      job: revision.job,
      approved,
      actorId: session.user.id,
      actorLabel: `ops (${session.user.name ?? "admin"})`,
      note,
    });
    if (!result.applied) {
      return {
        success: false,
        error: result.drift
          ? "The price on this job has changed since this request was raised — it needs to be raised again."
          : "This request has already been resolved.",
      };
    }

    await logAudit({
      entityType: "JobPriceRevision",
      entityId: revision.id,
      action: approved ? "PRICE_REVISION_APPROVED" : "PRICE_REVISION_REJECTED",
      description:
        `Job #${revision.job.jobNumber}: ops ${approved ? "approved" : "rejected"} price revision ` +
        `${money(revision.previousPrice)} → ${money(proposedPrice)} on the customer's behalf`,
      field: "price",
      oldValue: String(revision.previousPrice),
      newValue: String(approved ? proposedPrice : revision.previousPrice),
      reason: note,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    void notifyProviderOfResponse({
      jobId: revision.job.id,
      jobNumber: revision.job.jobNumber,
      requestedById: revision.requestedById,
      fallbackProviderId: revision.job.employeeId,
      approved,
      previousPrice: revision.previousPrice,
      proposedPrice,
      resolutionNote: note,
      resolvedByAdmin: true,
    });

    revalidatePath("/requests");
    revalidatePath(`/jobs/${revision.job.id}`);
    revalidatePath(`/my-jobs/${revision.job.id}`);
    revalidatePath(`/portal/bookings/${revision.job.id}`);
    return { success: true, newPrice: result.newPrice };
  } catch (error) {
    console.error("adminResolvePriceRevision failed", error);
    return { success: false, error: "Failed to resolve the request" };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Shared money application
// ───────────────────────────────────────────────────────────────────────────

/**
 * Flip a PENDING revision to APPROVED/REJECTED and, on approval, move the
 * client charge. All writes happen in ONE transaction, and the status flip is
 * guarded on `status: "PENDING"` so a double-submit (or a customer and an admin
 * racing) can only apply the price once.
 *
 * Provider pay is intentionally absent from this function — see the file header.
 */
async function applyRevisionDecision(args: {
  revision: { id: string; previousPrice: number; proposedPrice: number };
  job: {
    id: string;
    jobNumber: number;
    jobType: string | null;
    price: number | null;
    bookedSubtotalAmount: number | null;
  };
  approved: boolean;
  actorId: string;
  actorLabel: string;
  note: string | null;
}): Promise<{ applied: boolean; newPrice: number; drift?: boolean }> {
  const { revision, job, approved, actorId, actorLabel, note } = args;
  const currentPrice = round2(job.price ?? 0);
  const now = new Date();

  // Rejection leaves every money field alone.
  if (!approved) {
    const ok = await db.$transaction(async (tx) => {
      const res = await tx.jobPriceRevision.updateMany({
        where: { id: revision.id, status: "PENDING" },
        data: {
          status: "REJECTED",
          respondedAt: now,
          resolvedById: actorId,
          resolutionNote: note,
        },
      });
      if (res.count === 0) return false;
      await tx.jobLog.create({
        data: {
          jobId: job.id,
          userId: actorId,
          action: "NOTE_ADDED",
          description:
            `Price revision REJECTED by ${actorLabel}: ${money(revision.previousPrice)} → ` +
            `${money(revision.proposedPrice)} declined. The job price stays at ${money(currentPrice)}.` +
            `${note ? ` Note: ${note}` : ""}`,
        },
      });
      return true;
    });
    return { applied: ok, newPrice: currentPrice };
  }

  // Approval — rewrite the client charge. How, depends on the pricing model,
  // because "what the customer consented to" means different things:
  const cfg = await getBillingConfig();
  const pricingModel = getServicePricingModel(job.jobType, cfg);
  const deltaTotal = round2(revision.proposedPrice - revision.previousPrice);

  let newTotal: number;
  let baselineDelta: number | null = null;
  let baselineNote = "";

  if (pricingModel === "hourly" && job.bookedSubtotalAmount != null) {
    // HOURLY — the consented quantity is the DELTA for the extra scope, not the
    // absolute figure. The absolute total legitimately moves on its own while a
    // revision sits pending (clock-out recomputes labour), so we add the delta
    // to the immutable booked baseline rather than pinning an absolute price.
    // That is also the only way the change survives: computeChargeAmount()
    // rebuilds an hourly price from the baseline at every clock-out and clock
    // correction, so an absolute write to `price` would be wiped.
    baselineDelta = round2(deltaTotal / (1 + COMBINED_RATE));
    newTotal = round2(currentPrice + deltaTotal);
    baselineNote =
      ` Carried as a ${baselineDelta >= 0 ? "+" : "−"}${money(Math.abs(baselineDelta))} pre-tax change to the booked baseline,` +
      ` so it survives clock-out and any later clock correction.` +
      (Math.abs(currentPrice - round2(revision.previousPrice)) > 0.01
        ? ` (The live total had since moved to ${money(currentPrice)} from clocked hours; the approved scope delta is applied on top.)`
        : "");
  } else {
    // FIXED / QUOTE (and legacy hourly with no baseline) — the stored price is
    // authoritative and static, so the customer consented to an ABSOLUTE figure.
    // If it moved underneath them, someone re-priced the job: fail closed and
    // make the revision be raised again rather than charging a number that was
    // never presented in its current context.
    if (Math.abs(currentPrice - round2(revision.previousPrice)) > 0.01) {
      console.error(
        "price revision refused: job price drifted while pending",
        revision.id,
        { snapshot: revision.previousPrice, live: currentPrice }
      );
      return { applied: false, newPrice: currentPrice, drift: true };
    }
    newTotal = round2(revision.proposedPrice);
    if (pricingModel === "hourly") {
      baselineNote =
        " This hourly job predates the booked baseline, so the new price is stored directly.";
    }
  }

  const split = taxInclusiveBreakdown(newTotal);
  const jobData: Prisma.JobUpdateInput = {
    price: split.total,
    subtotalAmount: split.subtotal,
    gstAmount: split.gstAmount,
    qstAmount: split.qstAmount,
  };
  if (baselineDelta !== null && job.bookedSubtotalAmount != null) {
    jobData.bookedSubtotalAmount = round2(job.bookedSubtotalAmount + baselineDelta);
  }

  const ok = await db.$transaction(async (tx) => {
    const res = await tx.jobPriceRevision.updateMany({
      where: { id: revision.id, status: "PENDING" },
      data: {
        status: "APPROVED",
        respondedAt: now,
        resolvedById: actorId,
        resolutionNote: note,
      },
    });
    // Lost the race — someone already resolved it. Do NOT touch the price.
    if (res.count === 0) return false;

    await tx.job.update({ where: { id: job.id }, data: jobData });

    await tx.jobLog.create({
      data: {
        jobId: job.id,
        userId: actorId,
        action: "NOTE_ADDED",
        description:
          `Price revision APPROVED by ${actorLabel}: agreed ${money(revision.previousPrice)} → ` +
          `${money(revision.proposedPrice)}; job total now ${money(split.total)} (${pricingModel} pricing).${baselineNote}` +
          ` Provider pay is unchanged by this approval — pay remains hourly rate × clocked hours,` +
          ` so extra scope pays out through the extra time clocked.` +
          `${note ? ` Note: ${note}` : ""}`,
      },
    });
    return true;
  });

  return { applied: ok, newPrice: ok ? split.total : currentPrice };
}

// ───────────────────────────────────────────────────────────────────────────
// Notifications (fire-and-forget; never throw into the action)
// ───────────────────────────────────────────────────────────────────────────

async function notifyCustomerOfRequest(args: {
  clientEmail: string | null;
  clientPhone: string | null;
  clientName: string;
  jobId: string;
  jobNumber: number;
  previousPrice: number;
  proposedPrice: number;
  reason: string;
  providerName: string | null;
}): Promise<void> {
  try {
    if (args.clientEmail) {
      await sendCustomerPriceRevisionRequest({
        to: args.clientEmail,
        clientName: args.clientName,
        jobId: args.jobId,
        jobNumber: args.jobNumber,
        previousPrice: args.previousPrice,
        proposedPrice: args.proposedPrice,
        reason: args.reason,
        providerName: args.providerName,
      });
    }
  } catch (err) {
    console.error("price revision customer email failed", err);
  }
  try {
    if (args.clientPhone) {
      await smsPriceRevisionRequest({
        to: args.clientPhone,
        jobNumber: args.jobNumber,
        proposedPrice: args.proposedPrice,
      });
    }
  } catch (err) {
    console.error("price revision customer sms failed", err);
  }
}

/** In-app alert for ops (catalog `admin.scope.revision_pending` — APP_PUSH). */
async function raiseAdminPendingAlert(args: {
  jobId: string;
  jobNumber: number;
  previousPrice: number;
  proposedPrice: number;
}): Promise<void> {
  try {
    if (!(await isNotificationEnabled("ADMIN", "admin.scope.revision_pending", "APP_PUSH"))) {
      return;
    }
    await db.alert.create({
      data: {
        type: "GENERAL",
        severity: "INFO",
        title: "Price revision awaiting customer",
        message:
          `Job #${args.jobNumber}: a Pro proposed ${money(args.previousPrice)} → ${money(args.proposedPrice)}. ` +
          `Visible in Requests until the customer responds.`,
        relatedId: args.jobId,
        relatedType: "price_revision",
      },
    });
  } catch (err) {
    console.error("price revision admin alert failed", err);
  }
}

async function notifyProviderOfResponse(args: {
  jobId: string;
  jobNumber: number;
  requestedById: string | null;
  fallbackProviderId: string | null;
  approved: boolean;
  previousPrice: number;
  proposedPrice: number;
  resolutionNote: string | null;
  resolvedByAdmin: boolean;
}): Promise<void> {
  try {
    const targetId = args.requestedById ?? args.fallbackProviderId;
    if (!targetId) return;

    const provider = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, email: true },
    });
    if (!provider) return;

    const [appPushOn, emailOn] = await Promise.all([
      isNotificationEnabled("PROVIDER", "prov.scope.revision_response", "APP_PUSH"),
      isNotificationEnabled("PROVIDER", "prov.scope.revision_response", "EMAIL"),
    ]);

    if (appPushOn) {
      await db.alert.create({
        data: {
          type: "GENERAL",
          severity: "INFO",
          title: args.approved ? "Price revision approved" : "Price revision declined",
          message: args.approved
            ? `Job #${args.jobNumber}: the new price of ${money(args.proposedPrice)} was approved. Clock the extra time you work.`
            : `Job #${args.jobNumber}: the price revision was declined. Stay with the original scope at ${money(args.previousPrice)}.`,
          relatedId: args.jobId,
          relatedType: "price_revision",
          recipientUserId: provider.id,
        },
      });
    }

    if (emailOn && provider.email) {
      await sendProviderPriceRevisionResponse({
        to: provider.email,
        providerName: provider.name ?? "there",
        jobId: args.jobId,
        jobNumber: args.jobNumber,
        approved: args.approved,
        proposedPrice: args.proposedPrice,
        previousPrice: args.previousPrice,
        resolutionNote: args.resolutionNote,
        resolvedByAdmin: args.resolvedByAdmin,
      });
    }
  } catch (err) {
    console.error("price revision provider notification failed", err);
  }
}
