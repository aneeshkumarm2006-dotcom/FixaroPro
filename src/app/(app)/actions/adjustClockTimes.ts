"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { getBillingConfig, computeChargeAmount } from "@/lib/billing";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

interface AdjustClockInput {
  jobId: string;
  // ISO timestamps. Provide one or both; omitted fields keep their value.
  clockInTime?: string;
  clockOutTime?: string;
  // Mandatory — every manual clock correction must say why (SOP §10.2).
  reason: string;
}

// Allow a small clock-skew margin when rejecting future timestamps.
const FUTURE_SKEW_MS = 2 * 60_000;

function parseIso(value: string, label: string): { date: Date } | { error: string } {
  const date = new Date(value);
  if (isNaN(date.getTime())) return { error: `Invalid ${label} timestamp` };
  if (date.getTime() > Date.now() + FUTURE_SKEW_MS) {
    return { error: `${label} cannot be in the future` };
  }
  return { date };
}

// Read the job's current clock record for the admin correction form. Guarded
// to the same roles as the write so the panel never leaks to non-admins.
export async function getJobClockTimes(jobId: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false as const, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false as const, error: "Not authorized" };
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
      select: { clockInTime: true, clockOutTime: true },
    });
    if (!job) return { success: false as const, error: "Job not found" };

    return {
      success: true as const,
      clockInTime: job.clockInTime?.toISOString() ?? null,
      clockOutTime: job.clockOutTime?.toISOString() ?? null,
    };
  } catch (error) {
    console.error("Error reading clock times:", error);
    return { success: false as const, error: "Failed to load clock times" };
  }
}

// If the job was already completed with both clock times, its hours were
// folded into open payouts at clock-out (see clockOut.ts). Apply the delta so
// pay-period hour totals stay in sync with the corrected clock record.
async function applyPayoutHoursDelta(
  job: {
    employeeId: string | null;
    jobDate: Date | null;
    startTime: Date;
    cleaners: Array<{ id: string }>;
  },
  oldHours: number,
  newHours: number
) {
  const deltaHours = newHours - oldHours;
  if (Math.abs(deltaHours) < 0.0001) return;

  const cleanerIds = (() => {
    const ids = new Set<string>();
    if (job.employeeId) ids.add(job.employeeId);
    for (const c of job.cleaners) ids.add(c.id);
    return Array.from(ids);
  })();
  if (cleanerIds.length === 0) return;

  const jobDateForLookup = job.jobDate ?? job.startTime;
  const rangeEnd = new Date(jobDateForLookup);
  rangeEnd.setHours(23, 59, 59, 999);

  const activePeriods = await db.payPeriod.findMany({
    where: {
      status: { in: ["DRAFT", "APPROVED"] },
      startDate: { lte: rangeEnd },
      endDate: { gte: jobDateForLookup },
    },
  });
  if (activePeriods.length === 0) return;

  const perPersonDelta = deltaHours / cleanerIds.length;

  for (const period of activePeriods) {
    for (const cleanerId of cleanerIds) {
      const existing = await db.payout.findUnique({
        where: { payPeriodId_employeeId: { payPeriodId: period.id, employeeId: cleanerId } },
      });
      if (!existing) continue;
      await db.payout.update({
        where: { id: existing.id },
        data: {
          totalHours: Math.max(0, Number((existing.totalHours + perPersonDelta).toFixed(2))),
        },
      });
    }
  }
}

// Admin manually corrects a job's clock-in/clock-out record (SOP §10.2), e.g.
// a provider who forgot to clock out. Requires a reason; old and new
// timestamps are audit-logged and the change appears in the job log. Labour
// on the bill is derived from these fields, so no billing amounts are stored.
export async function adjustClockTimes(input: AdjustClockInput) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }

    const reason = input.reason?.trim();
    if (!reason) {
      return { success: false, error: "A reason is required for clock corrections" };
    }
    if (!input.clockInTime && !input.clockOutTime) {
      return { success: false, error: "Provide a clock-in and/or clock-out time" };
    }

    let newIn: Date | null = null;
    if (input.clockInTime) {
      const parsed = parseIso(input.clockInTime, "Clock-in");
      if ("error" in parsed) return { success: false, error: parsed.error };
      newIn = parsed.date;
    }
    let newOut: Date | null = null;
    if (input.clockOutTime) {
      const parsed = parseIso(input.clockOutTime, "Clock-out");
      if ("error" in parsed) return { success: false, error: parsed.error };
      newOut = parsed.date;
    }

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: {
        id: true,
        jobNumber: true,
        clockInTime: true,
        clockOutTime: true,
        employeeId: true,
        jobDate: true,
        startTime: true,
        cleaners: { select: { id: true } },
        // Fields computeChargeAmount needs to recompute hourly labour (SOP §10.1.3).
        jobType: true,
        price: true,
        discountAmount: true,
        subtotalAmount: true,
        gstAmount: true,
        qstAmount: true,
        basePriceAmount: true,
        bookedSubtotalAmount: true,
        paymentReceived: true,
        depositPaid: true,
        materialsAmount: true,
        materialsType: true,
        materialsAppliedAmount: true,
        materialsRefundedAt: true,
        cancellationFeeChargedAt: true,
        refundedAmount: true,
      },
    });
    if (!job) return { success: false, error: "Job not found" };

    // Validate the record as it will exist after the change.
    const effectiveIn = newIn ?? job.clockInTime;
    const effectiveOut = newOut ?? job.clockOutTime;
    if (effectiveOut && !effectiveIn) {
      return { success: false, error: "Cannot set a clock-out without a clock-in" };
    }
    if (effectiveIn && effectiveOut && effectiveOut.getTime() <= effectiveIn.getTime()) {
      return { success: false, error: "Clock-out must be after clock-in" };
    }

    const updateData: {
      clockInTime?: Date;
      clockOutTime?: Date;
      price?: number;
      subtotalAmount?: number;
      gstAmount?: number;
      qstAmount?: number;
      billableHours?: number | null;
      computedLabourAmount?: number | null;
      computedTotal?: number | null;
    } = {};
    if (newIn) updateData.clockInTime = newIn;
    if (newOut) updateData.clockOutTime = newOut;

    // Re-run the hourly labour recompute against the corrected clock record and
    // rewrite the stored charge fields so downstream consumers stay in sync (SOP
    // §10.1.3). Skip once the job is PAID: the card was already charged at the
    // prior amount, so silently rewriting the stored price would misrepresent it
    // (a post-payment correction is an ops refund/top-up decision, not automatic).
    const billingCfg = await getBillingConfig();
    const charge = computeChargeAmount(
      { ...job, clockInTime: effectiveIn, clockOutTime: effectiveOut },
      billingCfg
    );
    if (charge.pricingModel === "hourly" && !job.paymentReceived) {
      if (!charge.clockMissing && !charge.baseMissing) {
        updateData.price = charge.total;
        updateData.subtotalAmount = charge.subtotal;
        updateData.gstAmount = charge.gst;
        updateData.qstAmount = charge.qst;
        updateData.billableHours = charge.billableHours;
        updateData.computedLabourAmount = charge.labourAmount;
        updateData.computedTotal = charge.total;
      } else {
        // Correction left the record incomplete — clear the computed cache; the
        // stored price stays at its booked baseline (it was never overwritten).
        updateData.billableHours = null;
        updateData.computedLabourAmount = null;
        updateData.computedTotal = null;
      }
    }

    await db.job.update({ where: { id: job.id }, data: updateData });

    const changes: Array<{ field: string; oldValue: string; newValue: string; label: string }> = [];
    if (newIn) {
      changes.push({
        field: "clockInTime",
        oldValue: job.clockInTime?.toISOString() ?? "none",
        newValue: newIn.toISOString(),
        label: "Clock-in",
      });
    }
    if (newOut) {
      changes.push({
        field: "clockOutTime",
        oldValue: job.clockOutTime?.toISOString() ?? "none",
        newValue: newOut.toISOString(),
        label: "Clock-out",
      });
    }

    for (const change of changes) {
      await logAudit({
        entityType: "Job",
        entityId: job.id,
        action: "CLOCK_TIME_ADJUSTED",
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        reason,
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        description: `${change.label} on job #${job.jobNumber} corrected from ${change.oldValue} to ${change.newValue}.`,
      });
      await db.jobLog.create({
        data: {
          jobId: job.id,
          userId: session.user.id,
          action: "UPDATED",
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          description: `${change.label} corrected by ${session.user.name} from ${change.oldValue} to ${change.newValue} — ${reason}`,
        },
      });
    }

    // Keep payout hour totals consistent if the job's hours were already
    // credited at clock-out (only when a full old and new record exists).
    if (job.clockInTime && job.clockOutTime && effectiveIn && effectiveOut) {
      const oldHours = Math.max(
        0,
        (job.clockOutTime.getTime() - job.clockInTime.getTime()) / 3_600_000
      );
      const newHours = Math.max(0, (effectiveOut.getTime() - effectiveIn.getTime()) / 3_600_000);
      await applyPayoutHoursDelta(job, oldHours, newHours).catch((e) =>
        console.error("payout hours delta after clock correction", e)
      );
    }

    revalidatePath(`/jobs/${job.id}`);
    revalidatePath(`/my-jobs/${job.id}`);
    revalidatePath("/my-pay");

    return {
      success: true,
      clockInTime: effectiveIn?.toISOString() ?? null,
      clockOutTime: effectiveOut?.toISOString() ?? null,
    };
  } catch (error) {
    console.error("Error adjusting clock times:", error);
    return { success: false, error: "Failed to adjust clock times" };
  }
}
