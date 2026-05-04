"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Utility to clamp a date to start/end of day in local time
function getDayBounds(dateStr: string) {
  const day = new Date(dateStr);
  if (Number.isNaN(day.getTime())) {
    throw new Error("Invalid date");
  }
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Helper to format date preserving the UTC values as local time
// The database stores the intended local time (EST) as UTC timestamps
// We need to extract the UTC values and present them as local time
function preserveTimeAsLocal(date: Date): string {
  // Get the UTC components (which represent the intended local time)
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  
  // Return without 'Z' suffix so it's parsed as local time
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

export async function getJobsForDay(dateStr: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const isAdmin =
    (session.user as any).role === "ADMIN" ||
    (session.user as any).role === "OWNER";

  const { start, end } = getDayBounds(dateStr);

  const where: any = {
    OR: [
      // jobDate within day
      { jobDate: { gte: start, lte: end } },
      // startTime within day
      { startTime: { gte: start, lte: end } },
    ],
  };

  if (!isAdmin) {
    where.AND = [
      {
        OR: [
          { employeeId: session.user.id },
          { cleaners: { some: { id: session.user.id } } },
        ],
      },
    ];
  }

  const jobs = await db.job.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      cleaners: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ jobDate: "asc" }, { startTime: "asc" }],
  });

  // For employees, check equipment availability
  let missingEquipmentMap: Record<string, { productName: string; needed: number; have: number }[]> = {};
  if (!isAdmin && jobs.length > 0) {
    const [employeeProducts, inventoryRules] = await Promise.all([
      db.employeeProduct.findMany({
        where: { employeeId: session.user.id },
        include: { product: true },
      }),
      db.inventoryRule.findMany({
        include: { product: true },
      }),
    ]);

    // Build a map of what the employee has: productId -> quantity
    const employeeInventory: Record<string, { quantity: number; name: string }> = {};
    for (const ep of employeeProducts) {
      employeeInventory[ep.productId] = {
        quantity: ep.quantity,
        name: ep.product.name,
      };
    }

    // For each job, check if any products needed per job exceed what the employee has
    for (const job of jobs) {
      // Only check for upcoming/active jobs
      if (job.status === "COMPLETED" || job.status === "PAID" || job.status === "CANCELLED") {
        continue;
      }

      const missing: { productName: string; needed: number; have: number }[] = [];
      for (const rule of inventoryRules) {
        if (rule.usagePerJob > 0) {
          const have = employeeInventory[rule.productId]?.quantity ?? 0;
          if (have < rule.usagePerJob) {
            missing.push({
              productName: rule.product.name,
              needed: rule.usagePerJob,
              have,
            });
          }
        }
      }
      if (missing.length > 0) {
        missingEquipmentMap[job.id] = missing;
      }
    }
  }

  return jobs.map((job) => {
    const startTime = new Date(job.startTime);
    const endTime = job.endTime ? new Date(job.endTime) : undefined;
    const cleanerNames = job.cleaners.map((c) => c.name).join(", ");
    const label = cleanerNames || job.employee.name;

    return {
      id: job.id,
      title: job.clientName,
      description: job.description || undefined,
      label,
      // Preserve the UTC time components as local time
      start: preserveTimeAsLocal(startTime),
      end: endTime ? preserveTimeAsLocal(endTime) : undefined,
      confirmed: job.status !== "CREATED" && job.status !== "CANCELLED",
      importance:
        job.status === "IN_PROGRESS"
          ? 5
          : job.status === "SCHEDULED"
          ? 3
          : 1,
      metadata: {
        jobId: job.id,
        jobType: job.jobType,
        location: job.location,
        status: job.status,
        price: job.price,
        employeePay: job.employeePay,
        totalTip: job.totalTip,
        parking: job.parking,
        paymentReceived: job.paymentReceived,
        invoiceSent: job.invoiceSent,
        notes: job.notes,
        employeeId: job.employee.id,
        employeeName: job.employee.name,
        cleaners: job.cleaners,
        missingEquipment: missingEquipmentMap[job.id] || [],
      },
    };
  });
}

