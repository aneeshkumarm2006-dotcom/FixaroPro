"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import {
  clockedHours,
  computeProviderJobPay,
  getDefaultProviderHourlyRate,
  perPersonHours,
  perPersonTip,
  resolveProviderHourlyRate,
} from "@/lib/provider-pay";

export async function createPayPeriod(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "OWNER") {
    return { error: "Forbidden" };
  }

  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;
  const notes = (formData.get("notes") as string) || null;

  if (!startDateStr || !endDateStr) {
    return { error: "Start and end dates are required" };
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: "Invalid dates" };
  }

  if (endDate < startDate) {
    return { error: "End date must be on or after start date" };
  }

  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  try {
    // Provider pay is hourly (Fix #3 / #8): rate × clocked hours + tip share.
    // `payMultiplier` / `payRateMultiplier` are deprecated and deliberately not
    // selected here so they cannot creep back into the money math.
    const employees = await db.user.findMany({
      where: { role: { in: ["EMPLOYEE", "ADMIN", "OWNER"] } },
      select: { id: true, hourlyRate: true },
    });
    const providerRateMap = new Map(employees.map((e) => [e.id, e.hourlyRate]));
    const defaultRate = await getDefaultProviderHourlyRate();

    const jobs = await db.job.findMany({
      where: {
        status: { in: ["COMPLETED", "PAID"] },
        OR: [
          { jobDate: { gte: startDate, lte: rangeEnd } },
          {
            AND: [
              { jobDate: null },
              { startTime: { gte: startDate, lte: rangeEnd } },
            ],
          },
        ],
      },
      select: {
        id: true,
        employeeId: true,
        totalTip: true,
        providerHourlyRate: true,
        clockInTime: true,
        clockOutTime: true,
        startTime: true,
        endTime: true,
        cleaners: { select: { id: true } },
      },
    });

    // A participant on a job may not be in the role-filtered list above (e.g. a
    // role changed since). Resolve their rate too rather than silently paying
    // them the default.
    const participantIdsAll = new Set<string>();
    for (const job of jobs) {
      if (job.employeeId) participantIdsAll.add(job.employeeId);
      for (const c of job.cleaners) participantIdsAll.add(c.id);
    }
    const missingIds = Array.from(participantIdsAll).filter(
      (id) => !providerRateMap.has(id)
    );
    if (missingIds.length > 0) {
      const extra = await db.user.findMany({
        where: { id: { in: missingIds } },
        select: { id: true, hourlyRate: true },
      });
      for (const e of extra) providerRateMap.set(e.id, e.hourlyRate);
    }

    const payoutMap = new Map<
      string,
      { base: number; jobCount: number; hours: number }
    >();
    for (const emp of employees) {
      payoutMap.set(emp.id, { base: 0, jobCount: 0, hours: 0 });
    }

    for (const job of jobs) {
      const cleanerIds = job.cleaners.map((c) => c.id);
      const participantIds = Array.from(
        new Set(
          [job.employeeId, ...cleanerIds].filter(
            (id): id is string => !!id
          )
        )
      );
      if (participantIds.length === 0) continue;

      // Hours come from the clock record; the scheduled start/end is the
      // fallback for a job that was completed without a clock (unchanged).
      const start = job.clockInTime ?? job.startTime;
      const end = job.clockOutTime ?? job.endTime;
      const hours = clockedHours(start, end);
      const hoursEach = perPersonHours(hours, participantIds.length);
      const tipEach = perPersonTip(job.totalTip || 0, participantIds.length);

      for (const pid of participantIds) {
        if (!payoutMap.has(pid)) {
          payoutMap.set(pid, { base: 0, jobCount: 0, hours: 0 });
        }
        const entry = payoutMap.get(pid)!;
        // Each provider is paid at THEIR OWN resolved rate for THEIR share of
        // the clocked hours, plus an even share of the tip.
        const hourlyRate = resolveProviderHourlyRate({
          jobRate: job.providerHourlyRate,
          providerRate: providerRateMap.get(pid),
          defaultRate,
        });
        const pay = computeProviderJobPay({
          hourlyRate,
          hours: hoursEach,
          tipShare: tipEach,
        });
        entry.base += pay.total;
        entry.jobCount += 1;
        entry.hours += hoursEach;
      }
    }

    const payPeriod = await db.payPeriod.create({
      data: {
        startDate,
        endDate,
        notes,
        status: "DRAFT",
        payouts: {
          create: Array.from(payoutMap.entries())
            .filter(([, v]) => v.jobCount > 0 || v.base > 0)
            .map(([employeeId, v]) => ({
              employeeId,
              baseAmount: Number(v.base.toFixed(2)),
              finalAmount: Number(v.base.toFixed(2)),
              jobCount: v.jobCount,
              totalHours: Number(v.hours.toFixed(2)),
            })),
        },
      },
    });

    revalidatePath("/payouts");
    return { success: true, payPeriodId: payPeriod.id };
  } catch (error) {
    console.error("Error creating pay period:", error);
    return { error: "Failed to create pay period" };
  }
}
