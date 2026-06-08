"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";

export interface LabourCostFilters {
  from?: string; // ISO date
  to?: string; // ISO date
  serviceType?: string;
  cleanerId?: string;
  area?: string; // matched against job.location
}

export interface LabourCostResult {
  labour: number;
  revenue: number;
  labourPct: number | null;
  jobCount: number;
  // Filter option lists for the card's dropdowns.
  serviceTypes: string[];
  cleaners: Array<{ id: string; name: string }>;
}

/**
 * Labour-as-%-of-revenue for completed + paid jobs, with optional filters.
 *  - labour  = sum(employeePay)
 *  - revenue = sum(subtotalAmount) − sum(refundedAmount)
 *              (excludes tips, taxes, and transport/parking)
 * Self-contained: returns the metric plus the dropdown option lists so the
 * card never has to thread filters through the main AnalyticsView.
 */
export async function getLabourCostMetric(
  filters: LabourCostFilters = {}
): Promise<{ success: false; error: string } | ({ success: true } & LabourCostResult)> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };
  const role = (session.user as { role?: string }).role;
  if (role === "EMPLOYEE") return { success: false, error: "Not authorized" };

  const where: Prisma.JobWhereInput = {
    status: { in: ["COMPLETED", "PAID"] },
    paymentReceived: true,
  };

  if (filters.from || filters.to) {
    where.jobDate = {};
    if (filters.from) where.jobDate.gte = new Date(filters.from);
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      where.jobDate.lte = end;
    }
  }
  if (filters.serviceType) where.jobType = filters.serviceType;
  if (filters.cleanerId) {
    where.OR = [
      { employeeId: filters.cleanerId },
      { cleaners: { some: { id: filters.cleanerId } } },
    ];
  }
  if (filters.area?.trim()) {
    where.location = { contains: filters.area.trim(), mode: "insensitive" };
  }

  const jobs = await db.job.findMany({
    where,
    select: { employeePay: true, subtotalAmount: true, refundedAmount: true },
  });

  const labour = jobs.reduce((s, j) => s + (j.employeePay ?? 0), 0);
  const revenue = jobs.reduce(
    (s, j) => s + (j.subtotalAmount ?? 0) - (j.refundedAmount ?? 0),
    0
  );
  const labourPct = revenue > 0 ? (labour / revenue) * 100 : null;

  // Dropdown options (independent of the current filter selection).
  const [serviceTypeRows, cleaners] = await Promise.all([
    db.job.findMany({
      where: { jobType: { not: null } },
      distinct: ["jobType"],
      select: { jobType: true },
    }),
    db.user.findMany({
      where: { role: { in: ["EMPLOYEE", "FIELD_LEAD"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    success: true,
    labour: Math.round(labour * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    labourPct: labourPct === null ? null : Math.round(labourPct * 10) / 10,
    jobCount: jobs.length,
    serviceTypes: serviceTypeRows
      .map((r) => r.jobType)
      .filter((t): t is string => !!t),
    cleaners,
  };
}
