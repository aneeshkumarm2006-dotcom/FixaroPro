"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { sendAdminClockedOut } from "@/lib/email";
import { ensureRatingRequest } from "@/lib/rating";
import { getBillingConfig, computeChargeAmount } from "@/lib/billing";
import { logAudit } from "@/lib/audit";

const ML_PER_SPRAY = 1.25;
const MAX_COMPLETION_NOTES = 4000;

export interface PostJobUsage {
  sprays: Array<{ productId: string; sprayCount: number }>;
  mops: Array<{ productId: string; mopCount: number }>;
  disposables: Array<{ productId: string; quantity: number }>;
  // Fallback for products with category "OTHER" — legacy remaining-quantity input.
  remaining: Array<{ productId: string; inventoryAfter: number }>;
}

interface RestockItem {
  name: string;
  productId: string;
}

async function updatePayoutsForCompletedJob(
  job: {
    id: string;
    employeeId: string | null;
    employeePay: number | null;
    totalTip: number | null;
    payRateMultiplier: number | null;
    jobDate: Date | null;
    startTime: Date;
    clockInTime: Date | null;
    cleaners: Array<{ id: string }>;
  },
  cleanerIds: string[],
  clockOutTime: Date
) {
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

  const employeeMultipliers = await db.user.findMany({
    where: { id: { in: cleanerIds } },
    select: { id: true, payMultiplier: true },
  });
  const multiplierMap = new Map(
    employeeMultipliers.map((e) => [e.id, e.payMultiplier ?? 1])
  );

  const basePay = (job.employeePay ?? 0) + (job.totalTip ?? 0);
  const jobPayMultiplier = job.payRateMultiplier ?? 1;
  const totalJobPay = basePay * jobPayMultiplier;
  const perPerson = cleanerIds.length > 0 ? totalJobPay / cleanerIds.length : 0;

  const clockIn = job.clockInTime;
  const hours =
    clockIn
      ? Math.max(0, (clockOutTime.getTime() - clockIn.getTime()) / 3_600_000)
      : 0;
  const perPersonHours = cleanerIds.length > 0 ? hours / cleanerIds.length : 0;

  for (const period of activePeriods) {
    for (const cleanerId of cleanerIds) {
      const empMultiplier = multiplierMap.get(cleanerId) ?? 1;
      const contribution = Number((perPerson * empMultiplier).toFixed(2));
      const hoursContrib = Number(perPersonHours.toFixed(4));

      const existing = await db.payout.findUnique({
        where: { payPeriodId_employeeId: { payPeriodId: period.id, employeeId: cleanerId } },
      });

      if (existing) {
        const newBase = Number((existing.baseAmount + contribution).toFixed(2));
        await db.payout.update({
          where: { id: existing.id },
          data: {
            baseAmount: newBase,
            finalAmount: Number((newBase + existing.adjustments - existing.deductions + existing.reimbursements).toFixed(2)),
            jobCount: { increment: 1 },
            totalHours: Number((existing.totalHours + hoursContrib).toFixed(2)),
          },
        });
      } else {
        await db.payout.create({
          data: {
            payPeriodId: period.id,
            employeeId: cleanerId,
            baseAmount: contribution,
            finalAmount: contribution,
            jobCount: 1,
            totalHours: hoursContrib,
          },
        });
      }
    }
  }
}

/**
 * Clock out — the PRIMARY job-completion path (SOP §8). It closes the clock,
 * bills the hours, sets COMPLETED, and (7.2) carries the handyman's completion
 * write-up, so the provider documents and completes the job in one step rather
 * than clocking out and then hunting for a separate "mark complete" button.
 */
export async function clockOut(
  jobId: string,
  usage: PostJobUsage,
  completionNotes?: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      include: {
        employee: true,
        cleaners: true,
        productUsage: { include: { product: true } },
      },
    });

    if (!job) return { success: false, error: "Job not found" };

    const isEmployee = job.employeeId === session.user.id;
    const isCleaner = job.cleaners.some((c) => c.id === session.user.id);
    if (!isEmployee && !isCleaner) {
      return { success: false, error: "You are not assigned to this job" };
    }
    if (!job.clockInTime) return { success: false, error: "Not clocked in" };
    if (job.clockOutTime) return { success: false, error: "Already clocked out" };

    const notes = completionNotes?.trim();
    if (notes && notes.length > MAX_COMPLETION_NOTES) {
      return {
        success: false,
        error: `Completion notes are limited to ${MAX_COMPLETION_NOTES} characters.`,
      };
    }

    const now = new Date();

    // Recompute the labour charge from the now-complete clock record and write
    // it into the stored charge fields so EVERY consumer (receipts, invoices,
    // portal, analytics, refunds) reads one authoritative figure (SOP §10.1.3).
    // Only hourly jobs are clock-derived and only while unpaid; fixed/quote keep
    // their price. The immutable booked baseline (bookedSubtotalAmount /
    // basePriceAmount) is untouched, so a later clock correction recomputes cleanly.
    const billingCfg = await getBillingConfig();
    const charge = computeChargeAmount({ ...job, clockOutTime: now }, billingCfg);
    const computedBilling =
      charge.pricingModel === "hourly" &&
      !charge.clockMissing &&
      !charge.baseMissing &&
      !job.paymentReceived
        ? {
            price: charge.total,
            subtotalAmount: charge.subtotal,
            gstAmount: charge.gst,
            qstAmount: charge.qst,
            billableHours: charge.billableHours,
            computedLabourAmount: charge.labourAmount,
            computedTotal: charge.total,
          }
        : {};

    const employeeProducts = await db.employeeProduct.findMany({
      where: { employeeId: session.user.id },
      include: { product: { include: { inventoryRule: true } } },
    });
    const epByProductId = new Map(employeeProducts.map((ep) => [ep.productId, ep]));

    // Compute deductions per product.
    const deductions = new Map<string, number>();

    for (const s of usage.sprays) {
      if (s.sprayCount > 0) {
        deductions.set(s.productId, (deductions.get(s.productId) ?? 0) + s.sprayCount * ML_PER_SPRAY);
      }
    }
    for (const m of usage.mops) {
      if (m.mopCount > 0) {
        deductions.set(m.productId, (deductions.get(m.productId) ?? 0) + m.mopCount);
      }
    }
    for (const d of usage.disposables) {
      if (d.quantity > 0) {
        deductions.set(d.productId, (deductions.get(d.productId) ?? 0) + d.quantity);
      }
    }
    // "OTHER" remaining-style inputs — convert to a "used" deduction.
    for (const r of usage.remaining) {
      const ep = epByProductId.get(r.productId);
      if (!ep) continue;
      const used = ep.quantity - r.inventoryAfter;
      if (used > 0) {
        deductions.set(r.productId, (deductions.get(r.productId) ?? 0) + used);
      }
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let suppliesCost = 0;
    const restockNeeded: RestockItem[] = [];

    for (const [productId, used] of deductions.entries()) {
      const ep = epByProductId.get(productId);
      if (!ep) continue;

      const inventoryBefore = ep.quantity;
      const inventoryAfter = Math.max(0, inventoryBefore - used);
      const actualUsed = inventoryBefore - inventoryAfter;
      suppliesCost += actualUsed * ep.product.costPerUnit;

      // Upsert per-job usage record (merge if a partial pre-existed).
      const existingUsage = job.productUsage.find((pu) => pu.productId === productId);
      if (existingUsage) {
        ops.push(
          db.jobProductUsage.update({
            where: { id: existingUsage.id },
            data: {
              quantity: existingUsage.quantity + actualUsed,
              inventoryBefore,
              inventoryAfter,
            },
          })
        );
      } else {
        ops.push(
          db.jobProductUsage.create({
            data: {
              jobId,
              productId,
              quantity: actualUsed,
              inventoryBefore,
              inventoryAfter,
            },
          })
        );
      }

      // Deduct from employee stock.
      ops.push(
        db.employeeProduct.update({
          where: { id: ep.id },
          data: { quantity: inventoryAfter },
        })
      );

      // Job log.
      ops.push(
        db.jobLog.create({
          data: {
            jobId,
            userId: session.user.id,
            action: "PRODUCT_USED",
            description: `Used ${actualUsed.toFixed(2)} ${ep.product.unit} of ${ep.product.name}`,
          },
        })
      );

      // Threshold check — per the spec, restock alert fires when stock <= threshold.
      const threshold = ep.product.inventoryRule?.refillThreshold ?? ep.product.minStock ?? 0;
      if (threshold > 0 && inventoryAfter <= threshold) {
        restockNeeded.push({ name: ep.product.name, productId });
      }
    }

    // Assigned crew (assignee + any co-cleaners), deduped. Used to distribute
    // payout contributions across everyone who worked the job.
    const assignedCleanerIds = (() => {
      const ids = new Set<string>();
      if (job.employeeId) ids.add(job.employeeId);
      for (const c of job.cleaners) ids.add(c.id);
      return Array.from(ids);
    })();

    // Close the job.
    ops.push(
      db.job.update({
        where: { id: jobId },
        data: {
          clockOutTime: now,
          status: "COMPLETED",
          // Completed marker + the handyman's write-up (SOP §8). Kept distinct
          // from clockOutTime, which an admin can later correct.
          completedAt: now,
          completedById: session.user.id,
          ...(notes ? { completionNotes: notes } : {}),
          // Persisted recomputed labour/total for hourly jobs (SOP §10.1.3).
          ...computedBilling,
        },
      })
    );

    ops.push(
      db.jobLog.create({
        data: {
          jobId,
          userId: session.user.id,
          action: "CLOCKED_OUT",
          description: `${session.user.name} clocked out`,
        },
      })
    );
    ops.push(
      db.jobLog.create({
        data: {
          jobId,
          userId: session.user.id,
          action: "STATUS_CHANGED",
          field: "status",
          oldValue: job.status,
          newValue: "COMPLETED",
          description: `Status changed from ${job.status} to COMPLETED`,
        },
      })
    );

    if (notes) {
      ops.push(
        db.jobLog.create({
          data: {
            jobId,
            userId: session.user.id,
            action: "NOTE_ADDED",
            field: "completionNotes",
            description: `${session.user.name} added completion notes`,
          },
        })
      );
    }

    if (suppliesCost > 0) {
      ops.push(
        db.transaction.create({
          data: {
            date: now,
            category: "SUPPLIES",
            amount: suppliesCost,
            description: `Supplies consumed for ${job.clientName}`,
            jobId,
            source: "AUTO_CLOCK_OUT",
            isAuto: true,
          },
        })
      );
    }

    // Per spec: one combined cleaner-facing restock alert when ≥1 item is low.
    if (restockNeeded.length > 0) {
      const names = restockNeeded.map((r) => r.name);
      const list =
        names.length === 1
          ? names[0]
          : names.length === 2
          ? `${names[0]} and ${names[1]}`
          : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
      const message =
        names.length === 1
          ? `You are low on ${list}. Please refill it from the storage locker before your next job.`
          : `You are low on ${list}. Please refill these items from the storage locker before your next job.`;

      ops.push(
        db.alert.create({
          data: {
            type: "PROVIDER_LOW_STOCK",
            severity: "WARNING",
            title: "Restock needed before your next job",
            message,
            recipientUserId: session.user.id,
            relatedId: jobId,
            relatedType: "Job",
          },
        })
      );
    }

    await db.$transaction(ops);

    // SOP §8: "Audit job status changes." The JobLog entry above is the job
    // timeline; this is the central, cross-entity audit trail (§9) that the
    // Audit page reads. Fire-and-forget — logAudit never throws.
    logAudit({
      entityType: "Job",
      entityId: jobId,
      action: "JOB_COMPLETED",
      field: "status",
      oldValue: job.status,
      newValue: "COMPLETED",
      reason: "Clocked out",
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      description: `${session.user.name} clocked out of job #${job.jobNumber}, completing it.`,
    }).catch((e) => console.error("audit (clockOut)", e));

    // Admin email — gated by `admin.clock.clocked_out`.
    const clockInTime = job.clockInTime ? new Date(job.clockInTime) : null;
    const durationMinutes = clockInTime
      ? Math.max(1, Math.round((now.getTime() - clockInTime.getTime()) / 60000))
      : 0;
    sendAdminClockedOut({
      jobId,
      jobNumber: job.jobNumber,
      clientName: job.clientName,
      cleanerName: session.user.name ?? "Cleaner",
      durationMinutes,
    }).catch((e) => console.error("admin clocked-out email", e));

    // Auto-update payout records in any active pay period covering this job.
    updatePayoutsForCompletedJob(job, assignedCleanerIds, now).catch((e) =>
      console.error("payout update after clock-out", e)
    );

    // Job is now COMPLETED — mint the rating token + send the "rate us" email
    // once (idempotent; shares the token used by markJobComplete + the popup).
    ensureRatingRequest(jobId).catch((e) =>
      console.error("ensureRatingRequest (clockOut)", e)
    );

    revalidatePath("/my-jobs");
    revalidatePath(`/my-jobs/${jobId}`);
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath(`/employees/${session.user.id}`);
    revalidatePath("/finances");
    revalidatePath("/analytics");
    revalidatePath("/my-inventory");
    revalidatePath("/my-pay");

    return { success: true, restockNeeded: restockNeeded.length > 0 };
  } catch (error) {
    console.error("Error clocking out:", error);
    return { success: false, error: "Failed to clock out" };
  }
}
