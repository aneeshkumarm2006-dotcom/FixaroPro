"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { multiplierForRating } from "@/lib/pay-multiplier";

export type RecentRating = {
  id: string;
  rating: number;
  notes: string | null;
  createdAt: string;
  jobId: string | null;
  clientName: string | null;
};

export type TrendPoint = {
  date: string;
  average: number;
  count: number;
};

export type PerformanceData = {
  currentMultiplier: number;
  rating30Day: number | null;
  ratingCount30Day: number;
  tierLabel: string;
  nextTierAt: number | null;
  nextTierMultiplier: number | null;
  trend90Day: TrendPoint[];
  recentRatings: RecentRating[];
  oldestRating30DayAt: string | null;
  expiringSoon: number;
};

const RATING_EXPIRY_DAYS = 30;

interface GetInput {
  employeeId?: string;
}

export async function getPerformanceData(
  input: GetInput = {}
): Promise<
  | { success: true; data: PerformanceData }
  | { success: false; error: string }
> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { success: false, error: "Not authenticated" };
    }

    const role = (session.user as { role?: string }).role;
    const isAdmin = role === "OWNER" || role === "ADMIN";
    const targetEmployeeId = input.employeeId || session.user.id;

    if (!isAdmin && targetEmployeeId !== session.user.id) {
      return { success: false, error: "Not authorized" };
    }

    const employee = await db.user.findUnique({
      where: { id: targetEmployeeId },
      select: { id: true, payMultiplier: true },
    });
    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - RATING_EXPIRY_DAYS);
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const ratings90 = await db.employeeRating.findMany({
      where: {
        employeeId: targetEmployeeId,
        createdAt: { gte: ninetyDaysAgo },
      },
      orderBy: { createdAt: "asc" },
      include: {
        job: { select: { id: true, clientName: true } },
      },
    });

    const ratings30 = ratings90.filter((r) => r.createdAt >= thirtyDaysAgo);

    let rating30Day: number | null = null;
    let tierLabel = "Standard";
    if (ratings30.length > 0) {
      const sum = ratings30.reduce((acc, r) => acc + r.rating, 0);
      rating30Day = sum / ratings30.length;
      tierLabel = multiplierForRating(rating30Day).label;
    }

    const TIER_BOUNDARIES = [4.0, 4.5, 4.7, 5.0];
    let nextTierAt: number | null = null;
    let nextTierMultiplier: number | null = null;
    if (rating30Day !== null) {
      for (const boundary of TIER_BOUNDARIES) {
        if (rating30Day < boundary) {
          nextTierAt = boundary;
          nextTierMultiplier = multiplierForRating(boundary).multiplier;
          break;
        }
      }
    }

    const buckets = new Map<string, { sum: number; count: number }>();
    for (const r of ratings90) {
      const day = r.createdAt.toISOString().slice(0, 10);
      const cur = buckets.get(day) ?? { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count += 1;
      buckets.set(day, cur);
    }

    const trend90Day: TrendPoint[] = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, count }]) => ({
        date,
        average: sum / count,
        count,
      }));

    const recentSorted = [...ratings90].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const recentRatings: RecentRating[] = recentSorted.slice(0, 10).map((r) => ({
      id: r.id,
      rating: r.rating,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      jobId: r.jobId,
      clientName: r.job?.clientName ?? null,
    }));

    const oldestRating30DayAt =
      ratings30.length > 0
        ? new Date(
            Math.min(...ratings30.map((r) => r.createdAt.getTime()))
          ).toISOString()
        : null;

    const expiryWindow = new Date(now);
    expiryWindow.setDate(expiryWindow.getDate() - (RATING_EXPIRY_DAYS - 7));
    const expiringSoon = ratings30.filter(
      (r) => r.createdAt < expiryWindow
    ).length;

    return {
      success: true,
      data: {
        currentMultiplier: employee.payMultiplier,
        rating30Day,
        ratingCount30Day: ratings30.length,
        tierLabel,
        nextTierAt,
        nextTierMultiplier,
        trend90Day,
        recentRatings,
        oldestRating30DayAt,
        expiringSoon,
      },
    };
  } catch (error) {
    console.error("Error getting performance data:", error);
    return { success: false, error: "Failed to load performance data" };
  }
}
