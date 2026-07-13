import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  sendCustomerRateUs,
  sendCustomerPoorRatingFollowUp,
  sendAdminNewReview,
  sendProviderNewReview,
} from "@/lib/email";
import { getRuntimeConfig } from "@/lib/config/service-config";
import { maybeApplyLowRatingStrike } from "@/lib/strikes";

/**
 * Idempotently ensure a rating request exists for a completed job.
 *
 * The customer can be prompted through two channels — the "rate us" email
 * link and the in-portal popup — but they must share ONE token, or the
 * customer gets double-prompted and we risk two conflicting rating rows.
 * This mints at most one JobRatingToken per job, sends the email exactly
 * once (stamping emailSentAt + writing a single RATING_REQUEST EmailLog),
 * and is safe to call repeatedly (e.g. from both markJobComplete and
 * clockOut).
 */
export async function ensureRatingRequest(jobId: string) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      jobNumber: true,
      clientId: true,
      clientName: true,
      employeeId: true,
      client: { select: { id: true, email: true, name: true } },
      cleaners: { select: { id: true } },
    },
  });
  if (!job) return null;

  // One token per job — reuse the oldest if one already exists.
  let token = await db.jobRatingToken.findFirst({
    where: { jobId },
    orderBy: { createdAt: "asc" },
  });

  if (!token) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    token = await db.jobRatingToken.create({
      data: {
        jobId,
        token: randomBytes(24).toString("base64url"),
        cleanerId: job.employeeId ?? job.cleaners[0]?.id ?? null,
        customerId: job.clientId ?? null,
        expiresAt,
      },
    });
  } else if (!token.customerId && job.clientId) {
    token = await db.jobRatingToken.update({
      where: { id: token.id },
      data: { customerId: job.clientId },
    });
  }

  // Email is sent at most once — guard on emailSentAt.
  if (token.emailSentAt) return token;

  const to = job.client?.email ?? null;
  if (!to) return token; // no email on file — the popup channel still works

  const log = await db.emailLog.create({
    data: {
      kind: "RATING_REQUEST",
      recipient: to,
      subject: `Rate your Fixaro service — job #${job.jobNumber}`,
      jobId: job.id,
      status: "PENDING",
    },
  });

  const res = await sendCustomerRateUs({
    to,
    clientName: job.client?.name ?? job.clientName ?? "there",
    jobId: job.id,
    jobNumber: job.jobNumber,
    ratingToken: token.token,
  }).catch((e) => {
    console.error("ensureRatingRequest sendCustomerRateUs", e);
    return { ok: false as const, error: e };
  });

  // Stamp emailSentAt regardless of the gate result so we never re-send.
  token = await db.jobRatingToken.update({
    where: { id: token.id },
    data: { emailSentAt: new Date() },
  });
  await db.emailLog
    .update({
      where: { id: log.id },
      data: res.ok
        ? { status: "SENT", sentAt: new Date() }
        : { status: "FAILED", error: String((res as { error?: unknown }).error ?? "skipped") },
    })
    .catch(() => {});

  return token;
}

/**
 * Single source of truth for recording a customer rating from a token —
 * used by BOTH the public /rate/[token] link and the in-portal popup, so the
 * two channels can never drift or double-write.
 *
 *  - `ratherNotAnswer: true` (the popup "Rather not answer" / dismiss) stamps
 *    the token and writes NO EmployeeRating row. A skip must never become a
 *    `rating: 0`, which would poison the cleaner's average and pay multiplier.
 *  - otherwise we apply the late-arrival cap, write one rating row per
 *    cleaner (raw 1–5 stars), mark the token used, then fire the poor-rating
 *    follow-up + admin/provider notifications.
 */
export async function recordRatingFromToken(opts: {
  token: string;
  stars: number;
  comment?: string | null;
  ratedBy: string;
  ratherNotAnswer?: boolean;
}): Promise<{ success: true } | { success: false; error: string }> {
  const tokenRow = await db.jobRatingToken.findUnique({
    where: { token: opts.token },
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          clientName: true,
          lateArrivalRatingCap: true,
          client: { select: { email: true, name: true } },
          cleaners: { select: { id: true } },
        },
      },
    },
  });

  if (!tokenRow) return { success: false, error: "Invalid rating link" };
  if (tokenRow.usedAt)
    return { success: false, error: "This rating has already been submitted" };
  if (tokenRow.expiresAt && tokenRow.expiresAt < new Date())
    return { success: false, error: "This rating link has expired" };

  // ── Skip path: customer declined. No rating row. ──
  if (opts.ratherNotAnswer) {
    await db.jobRatingToken.update({
      where: { id: tokenRow.id },
      data: { ratherNotAnswer: true, usedAt: new Date() },
    });
    return { success: true };
  }

  const stars = opts.stars;
  if (!Number.isInteger(stars) || stars < 1 || stars > 5)
    return { success: false, error: "Rating must be 1–5 stars" };

  // Apply the late-arrival cap (clamp down only, never up).
  const cap = tokenRow.job.lateArrivalRatingCap;
  const effectiveStars = cap ? Math.min(stars, Math.floor(cap)) : stars;

  // Cleaners to rate: prefer the explicit cleaner on the token, fall back to
  // everyone assigned to the job.
  const cleanerIds = tokenRow.cleanerId
    ? [tokenRow.cleanerId]
    : tokenRow.job.cleaners.map((c) => c.id);
  if (cleanerIds.length === 0)
    return { success: false, error: "No cleaners were assigned to this job" };

  const comment = opts.comment?.trim() || null;
  const capNote =
    effectiveStars !== stars
      ? `Late-arrival cap applied (${stars} → ${effectiveStars})`
      : null;
  const notes = [comment, capNote].filter(Boolean).join(" | ") || null;

  await db.$transaction([
    ...cleanerIds.map((employeeId) =>
      db.employeeRating.create({
        data: {
          jobId: tokenRow.jobId,
          employeeId,
          rating: effectiveStars,
          notes,
          ratedBy: opts.ratedBy,
        },
      })
    ),
    db.jobRatingToken.update({
      where: { id: tokenRow.id },
      data: { usedAt: new Date(), ratingStars: stars },
    }),
  ]);

  const job = tokenRow.job;

  // 1-star follow-up: email the customer + raise a CRITICAL admin alert.
  const { policy } = await getRuntimeConfig();
  if (stars <= policy.poorRatingFollowupStars) {
    const clientEmail = job.client?.email ?? null;
    const clientName = job.client?.name ?? job.clientName ?? "the customer";
    if (clientEmail) {
      sendCustomerPoorRatingFollowUp({
        to: clientEmail,
        clientName,
        jobNumber: job.jobNumber,
      }).catch((e) => console.error("poor-rating follow-up email", e));
    }
    await db.alert
      .create({
        data: {
          type: "CLIENT_COMPLAINT",
          severity: "CRITICAL",
          title: `1-star rating — ${clientName}`,
          message: `Booking #${job.jobNumber} received a 1-star rating${
            comment ? `: "${comment}"` : "."
          } Customer was promised a follow-up; reach out with compensation.`,
          relatedId: job.id,
          relatedType: "Job",
        },
      })
      .catch((e) => console.error("poor-rating admin alert", e));
  }

  // Notify admin + each rated cleaner (recalc overall for the dropped check).
  for (const employeeId of cleanerIds) {
    // Three-strike accountability: two consecutive sub-3★ ratings = a strike.
    await maybeApplyLowRatingStrike(employeeId, job.id).catch((e) =>
      console.error("low-rating strike", e)
    );

    const cleaner = await db.user.findUnique({
      where: { id: employeeId },
      select: { name: true, email: true },
    });
    if (!cleaner) continue;
    const agg = await db.employeeRating.aggregate({
      where: { employeeId },
      _avg: { rating: true },
    });
    sendAdminNewReview({
      jobId: job.id,
      jobNumber: job.jobNumber,
      employeeName: cleaner.name,
      rating: effectiveStars,
      notes,
      overallRating: agg._avg.rating ?? null,
    }).catch((e) => console.error("admin new-review email", e));
    if (cleaner.email) {
      sendProviderNewReview({
        to: cleaner.email,
        employeeName: cleaner.name,
        jobId: job.id,
        jobNumber: job.jobNumber,
        rating: effectiveStars,
        notes,
      }).catch((e) => console.error("provider new-review email", e));
    }
  }

  return { success: true };
}
