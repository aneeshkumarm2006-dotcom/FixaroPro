"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getJobsForCalendar(startDate?: Date, endDate?: Date) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Check user role - admins/owners can see all jobs
  const isAdmin =
    (session.user as any).role === "ADMIN" ||
    (session.user as any).role === "OWNER";

  // Build where clause
  const where: any = {};
  
  if (!isAdmin) {
    // Regular employees see jobs where they are either the primary employee or a cleaner
    where.OR = [
      { employeeId: session.user.id },
      { cleaners: { some: { id: session.user.id } } }
    ];
  }

  // Add date range filter if provided
  if (startDate || endDate) {
    where.AND = where.AND || [];
    
    if (startDate && endDate) {
      where.AND.push({
        OR: [
          // Jobs with jobDate in range
          {
            jobDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          // Jobs with startTime in range
          {
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          },
        ],
      });
    } else if (startDate) {
      where.AND.push({
        OR: [
          { jobDate: { gte: startDate } },
          { startTime: { gte: startDate } },
        ],
      });
    } else if (endDate) {
      where.AND.push({
        OR: [
          { jobDate: { lte: endDate } },
          { startTime: { lte: endDate } },
        ],
      });
    }
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
    orderBy: [
      { jobDate: "asc" },
      { startTime: "asc" },
    ],
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

    const employeeInventory: Record<string, { quantity: number; name: string }> = {};
    for (const ep of employeeProducts) {
      employeeInventory[ep.productId] = {
        quantity: ep.quantity,
        name: ep.product.name,
      };
    }

    for (const job of jobs) {
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

  // Transform jobs to calendar event format
  return jobs.map((job) => {
    // Create start time by combining date with startTime
    const start = new Date(job.startTime);

    // Create end time if available
    const end = job.endTime ? new Date(job.endTime) : undefined;

    // Create cleaner names string
    const cleanerNames = job.cleaners.map((c) => c.name).join(", ");
    const label = cleanerNames || (job.employee?.name ?? "Unassigned");

    return {
      id: job.id,
      title: job.clientName,
      description: job.description || undefined,
      label: label,
      start: start.toISOString(),
      end: end?.toISOString(),
      confirmed: job.status !== "CREATED" && job.status !== "CANCELLED",
      importance: job.status === "IN_PROGRESS" ? 5 : job.status === "SCHEDULED" ? 3 : 1,
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
        employeeId: job.employee?.id ?? "",
        employeeName: job.employee?.name ?? "Unassigned",
        cleaners: job.cleaners,
        missingEquipment: missingEquipmentMap[job.id] || [],
      },
    };
  });
}

