"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { PayBreakdown } from "./getPayBreakdown.types";
import {
  clockedHours,
  computeProviderJobPay,
  getDefaultProviderHourlyRate,
  perPersonHours,
  perPersonTip,
  resolveProviderHourlyRate,
} from "@/lib/provider-pay";

/**
 * "Why is my pay this?" for the provider (Fix #3d / #8).
 *
 * Returns the CREW's numbers only — hourly rate, clocked hours and the pay that
 * falls out of them. Client pricing (base price, add-on prices, discount,
 * parking, client total) was previously included and rendered in the crew
 * modal; it has been removed from this payload entirely.
 */
export async function getPayBreakdown(
  jobId: string
): Promise<
  | { success: true; breakdown: PayBreakdown }
  | { success: false; error: string }
> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        clientName: true,
        employeeId: true,
        totalTip: true,
        providerHourlyRate: true,
        clockInTime: true,
        clockOutTime: true,
        cleaners: { select: { id: true } },
      },
    });

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    const role = (session.user as { role?: string }).role;
    const isLead = job.employeeId === session.user.id;
    const isCleaner = job.cleaners.some((c) => c.id === session.user.id);
    const isAdmin = role === "ADMIN" || role === "OWNER" || role === "OPS_MANAGER";

    // Authorization is per-resource: only someone actually assigned to THIS job
    // (or ops) may see its pay. Fails closed.
    if (!isLead && !isCleaner && !isAdmin) {
      return { success: false, error: "You do not have access to this job" };
    }

    // Whose pay are we explaining? The viewer's, when they worked the job.
    // An admin viewing someone else's job sees the lead's numbers.
    const subjectId =
      isLead || isCleaner ? session.user.id : job.employeeId ?? session.user.id;

    const subject = await db.user.findUnique({
      where: { id: subjectId },
      select: { hourlyRate: true },
    });

    const defaultRate = await getDefaultProviderHourlyRate();
    const hourlyRate = resolveProviderHourlyRate({
      jobRate: job.providerHourlyRate,
      providerRate: subject?.hourlyRate,
      defaultRate,
    });
    const hourlyRateSource: PayBreakdown["hourlyRateSource"] =
      job.providerHourlyRate != null && hourlyRate === job.providerHourlyRate
        ? "JOB_OVERRIDE"
        : subject?.hourlyRate != null && hourlyRate === subject.hourlyRate
        ? "PROVIDER_RATE"
        : "DEFAULT";

    // Team = lead + assigned crew. Hours and tips are split evenly across it,
    // matching how the payout is actually written at clock-out.
    const participantIds = new Set<string>();
    if (job.employeeId) participantIds.add(job.employeeId);
    for (const c of job.cleaners) participantIds.add(c.id);
    const teamSize = Math.max(1, participantIds.size);

    const totalJobHours = clockedHours(job.clockInTime, job.clockOutTime);
    const hours = perPersonHours(totalJobHours, teamSize);
    const totalTip = job.totalTip || 0;
    const tipShare = perPersonTip(totalTip, teamSize);

    const pay = computeProviderJobPay({ hourlyRate, hours, tipShare });

    return {
      success: true,
      breakdown: {
        jobId: job.id,
        clientName: job.clientName,
        hourlyRate: pay.hourlyRate,
        hourlyRateSource,
        hours: Number(hours.toFixed(2)),
        totalJobHours: Number(totalJobHours.toFixed(2)),
        clockIncomplete: !job.clockInTime || !job.clockOutTime,
        hourlyPay: pay.hourlyPay,
        totalTip,
        teamSize,
        tipShare: pay.tipShare,
        totalEmployeePay: pay.total,
        isLead,
      },
    };
  } catch (error) {
    console.error("Error getting pay breakdown:", error);
    return { success: false, error: "Failed to load pay breakdown" };
  }
}
