/**
 * Weekly cron — runs every Monday morning at 09:00 server time.
 *
 *  - Provider performance email to each active cleaner (hours, jobs, rating, tips)
 *
 * Idempotent: each provider's weekly email is logged with a unique
 * `notificationKey` of `weekly_perf:<YYYY-MM-DD>` so re-runs in the same
 * week don't double-send.
 *
 * Auth: `Bearer ${process.env.CRON_SECRET}` header.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sendProviderWeeklyPerformance } from "@/lib/email";

const DAY = 24 * 60 * 60 * 1000;

function weekRange(now: Date) {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 7 * DAY);
  const label = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  return { start, end, label };
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function ensureNotSent(notificationKey: string, recipient: string) {
  const existing = await db.emailLog.findFirst({
    where: {
      notificationKey,
      recipient,
      status: { in: ["SENT", "PENDING"] },
    },
    select: { id: true },
  });
  if (existing) return null;
  return db.emailLog.create({
    data: {
      kind: "OTHER",
      notificationKey,
      recipient,
      subject: notificationKey,
      status: "PENDING",
    },
    select: { id: true },
  });
}

async function runProviderPerformance(weekStart: Date, weekEnd: Date, label: string) {
  const notificationKey = `weekly_perf:${isoDay(weekStart)}`;

  const providers = await db.user.findMany({
    where: { role: { in: ["EMPLOYEE", "FIELD_LEAD"] } },
    select: { id: true, name: true, email: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const provider of providers) {
    if (!provider.email) {
      skipped++;
      continue;
    }
    const log = await ensureNotSent(notificationKey, provider.email);
    if (!log) {
      skipped++;
      continue;
    }

    // Jobs completed in window. Tips are stored on the Job as a single
    // `tipAmount` and split equally across assigned cleaners (matches the
    // multi-cleaner "split equally into wallets" policy).
    const completedJobs = await db.job.findMany({
      where: {
        status: "COMPLETED",
        clockOutTime: { gte: weekStart, lt: weekEnd },
        cleaners: { some: { id: provider.id } },
      },
      select: {
        id: true,
        clockInTime: true,
        clockOutTime: true,
        tipAmount: true,
        cleaners: { select: { id: true } },
      },
    });

    const jobsCompleted = completedJobs.length;
    const hours = completedJobs.reduce((sum, j) => {
      if (!j.clockInTime || !j.clockOutTime) return sum;
      return sum + (j.clockOutTime.getTime() - j.clockInTime.getTime()) / 3_600_000;
    }, 0);
    const tipsTotal = completedJobs.reduce((sum, j) => {
      const headcount = Math.max(1, j.cleaners.length);
      return sum + (j.tipAmount ?? 0) / headcount;
    }, 0);

    const ratingAgg = await db.employeeRating.aggregate({
      where: {
        employeeId: provider.id,
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const avgRating = ratingAgg._count.rating > 0 ? ratingAgg._avg.rating : null;

    // Skip the email if the cleaner had zero activity this week. The
    // PENDING row stays so re-runs in the same week don't re-process them.
    if (jobsCompleted === 0 && hours === 0 && !avgRating && tipsTotal === 0) {
      skipped++;
      continue;
    }

    try {
      await sendProviderWeeklyPerformance({
        to: provider.email,
        providerName: provider.name,
        weekLabel: label,
        hours,
        jobsCompleted,
        avgRating,
        tipsTotal,
      });
      await db.emailLog.update({
        where: { id: log.id },
        data: { status: "SENT" },
      });
      sent++;
    } catch (e) {
      console.error("weekly perf email failed", provider.email, e);
    }
  }

  return { sent, skipped, total: providers.length };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    secret !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { start, end, label } = weekRange(now);

  const perf = await runProviderPerformance(start, end, label);

  return NextResponse.json({ ok: true, weekLabel: label, perf });
}
