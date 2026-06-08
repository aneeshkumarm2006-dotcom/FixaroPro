import { db } from "@/db";
import type { StrikeReason } from "@prisma/client";
import {
  STRIKE_THRESHOLD,
  STRIKE_WINDOW_DAYS,
  STRIKE_LOW_RATING_BELOW,
  STRIKE_REASON_LABELS,
  strikeLevel,
  type StrikeLevel,
} from "@/lib/strikes-constants";

function windowStart(): Date {
  return new Date(Date.now() - STRIKE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Issue a strike against a cleaner. Idempotent per (cleaner, job, reason):
 * the same job can't double-strike a cleaner for the same reason. When the
 * new strike pushes the cleaner to the threshold for the first time, a
 * CLEANER_STRIKE alert is raised.
 */
export async function applyStrike(opts: {
  cleanerId: string;
  jobId?: string | null;
  reason: StrikeReason;
  note?: string | null;
  actionBy?: string | null;
}): Promise<{ created: boolean; activeCount: number }> {
  // Dedupe: skip if an active strike already exists for this job + reason.
  if (opts.jobId) {
    const existing = await db.cleanerStrike.findFirst({
      where: {
        cleanerId: opts.cleanerId,
        jobId: opts.jobId,
        reason: opts.reason,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (existing) {
      return { created: false, activeCount: await getActiveStrikeCount(opts.cleanerId) };
    }
  }

  await db.cleanerStrike.create({
    data: {
      cleanerId: opts.cleanerId,
      jobId: opts.jobId ?? null,
      reason: opts.reason,
      note: opts.note ?? null,
      actionBy: opts.actionBy ?? null,
    },
  });

  const activeCount = await getActiveStrikeCount(opts.cleanerId);

  // Raise the alert exactly when the cleaner first reaches the threshold.
  if (activeCount === STRIKE_THRESHOLD) {
    const cleaner = await db.user.findUnique({
      where: { id: opts.cleanerId },
      select: { name: true },
    });
    await db.alert
      .create({
        data: {
          type: "CLEANER_STRIKE",
          severity: "CRITICAL",
          title: `${cleaner?.name ?? "Cleaner"} hit ${STRIKE_THRESHOLD} strikes`,
          message: `${cleaner?.name ?? "This cleaner"} has reached ${STRIKE_THRESHOLD} active strikes in the last ${STRIKE_WINDOW_DAYS} days (most recent: ${STRIKE_REASON_LABELS[opts.reason]}). Review their account.`,
          relatedId: opts.cleanerId,
          relatedType: "User",
        },
      })
      .catch((e) => console.error("CLEANER_STRIKE alert", e));
  }

  return { created: true, activeCount };
}

/** Active strikes for a cleaner within the rolling 30-day window. */
export async function getActiveStrikeCount(cleanerId: string): Promise<number> {
  return db.cleanerStrike.count({
    where: {
      cleanerId,
      status: "ACTIVE",
      createdAt: { gte: windowStart() },
    },
  });
}

export interface StrikeSummary {
  activeCount: number;
  level: StrikeLevel;
  strikes: Array<{
    id: string;
    reason: StrikeReason;
    status: string;
    note: string | null;
    jobId: string | null;
    createdAt: string;
    countsTowardThreshold: boolean;
  }>;
}

/**
 * Full strike history for a cleaner, newest first, with the active-count and
 * severity level. `countsTowardThreshold` flags the rows that are ACTIVE and
 * inside the rolling window.
 */
export async function getStrikeSummary(cleanerId: string): Promise<StrikeSummary> {
  const cutoff = windowStart();
  const rows = await db.cleanerStrike.findMany({
    where: { cleanerId },
    orderBy: { createdAt: "desc" },
  });
  const activeCount = rows.filter(
    (r) => r.status === "ACTIVE" && r.createdAt >= cutoff
  ).length;
  return {
    activeCount,
    level: strikeLevel(activeCount),
    strikes: rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      note: r.note,
      jobId: r.jobId,
      createdAt: r.createdAt.toISOString(),
      countsTowardThreshold: r.status === "ACTIVE" && r.createdAt >= cutoff,
    })),
  };
}

/**
 * Issue a LOW_RATING strike when a cleaner's two most recent ratings are both
 * below the threshold. Deduped on the triggering job. Call after a rating is
 * recorded (both rating channels flow through recordRatingFromToken).
 */
export async function maybeApplyLowRatingStrike(
  cleanerId: string,
  jobId?: string | null
): Promise<void> {
  const recent = await db.employeeRating.findMany({
    where: { employeeId: cleanerId },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { rating: true },
  });
  if (recent.length < 2) return;
  const bothLow = recent.every((r) => r.rating < STRIKE_LOW_RATING_BELOW);
  if (!bothLow) return;

  await applyStrike({
    cleanerId,
    jobId: jobId ?? null,
    reason: "LOW_RATING",
    note: "Two consecutive ratings below 3 stars.",
  });
}
