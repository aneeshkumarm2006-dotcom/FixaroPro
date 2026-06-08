"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { RECURRING_FREQUENCIES } from "@/lib/retention-constants";
import type { ServiceFrequency } from "@prisma/client";

export interface RetentionKpiRow {
  id: string;
  clientName: string;
  frequency: string;
  reason: string | null;
  cancelledAt: string;
  offerStatus: string;
  emailSentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  reactivatedAt: string | null;
}

export interface RetentionKpi {
  totalCancellations: number;
  reactivated: number;
  pending: number;
  replied: number;
  reactivationRate: number | null; // %
  emailSent: number;
  opened: number;
  clicked: number;
  activeRecurringClients: number;
  rows: RetentionKpiRow[];
}

/**
 * Recurring retention KPIs for a {from,to} period (reads RecurringCancellation
 * from the Phase 4 save flow + the current recurring client base).
 */
export async function getRetentionKpi(input: {
  from: string;
  to: string;
}): Promise<
  { success: false; error: string } | ({ success: true } & RetentionKpi)
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };
  const role = (session.user as { role?: string }).role;
  if (role === "EMPLOYEE") return { success: false, error: "Not authorized" };

  const from = new Date(input.from);
  const to = new Date(input.to);
  to.setHours(23, 59, 59, 999);

  const cancellations = await db.recurringCancellation.findMany({
    where: { cancelledAt: { gte: from, lte: to } },
    orderBy: { cancelledAt: "desc" },
    include: { client: { select: { name: true } } },
  });

  const reactivated = cancellations.filter((c) => c.reactivatedAt).length;
  const replied = cancellations.filter((c) => c.repliedAt).length;
  const emailSent = cancellations.filter((c) => c.emailSentAt).length;
  const opened = cancellations.filter((c) => c.openedAt).length;
  const clicked = cancellations.filter((c) => c.clickedAt).length;
  const total = cancellations.length;

  const activeRecurringClients = await db.client.count({
    where: {
      isActive: true,
      serviceFrequency: {
        in: RECURRING_FREQUENCIES as unknown as ServiceFrequency[],
      },
    },
  });

  return {
    success: true,
    totalCancellations: total,
    reactivated,
    pending: total - reactivated,
    replied,
    reactivationRate: total > 0 ? Math.round((reactivated / total) * 1000) / 10 : null,
    emailSent,
    opened,
    clicked,
    activeRecurringClients,
    rows: cancellations.map((c) => ({
      id: c.id,
      clientName: c.client?.name ?? "—",
      frequency: c.frequency,
      reason: c.reason,
      cancelledAt: c.cancelledAt.toISOString(),
      offerStatus: c.offerStatus,
      emailSentAt: c.emailSentAt?.toISOString() ?? null,
      openedAt: c.openedAt?.toISOString() ?? null,
      clickedAt: c.clickedAt?.toISOString() ?? null,
      repliedAt: c.repliedAt?.toISOString() ?? null,
      reactivatedAt: c.reactivatedAt?.toISOString() ?? null,
    })),
  };
}
