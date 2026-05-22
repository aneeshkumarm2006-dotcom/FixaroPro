"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export interface PendingRatingJob {
  jobId: string;
  jobNumber: number;
  cleanerName: string;
  cleanerId: string;
  completedAt: string;
}

export async function getPendingClientRating(): Promise<PendingRatingJob | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const email = session.user.email?.toLowerCase();
  if (!email) return null;

  // Find the client record for this email
  const client = await db.client.findFirst({
    where: { email },
    select: { id: true },
  });
  if (!client) return null;

  // Find most recent completed job for this client in the last 60 days
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const jobs = await db.job.findMany({
    where: {
      clientId: client.id,
      status: "COMPLETED",
      jobDate: { gte: since },
    },
    orderBy: { jobDate: "desc" },
    take: 10,
    select: {
      id: true,
      jobNumber: true,
      jobDate: true,
      startTime: true,
      employeeId: true,
      employee: { select: { id: true, name: true } },
      ratings: { select: { notes: true } },
    },
  });

  // Find the first job that hasn't had a customer rating or skip
  const unrated = jobs.find(
    (j) => j.employee && !j.ratings.some((r) => r.notes?.startsWith("customer:"))
  );

  if (!unrated || !unrated.employee) return null;

  return {
    jobId: unrated.id,
    jobNumber: unrated.jobNumber,
    cleanerName: unrated.employee.name,
    cleanerId: unrated.employee.id,
    completedAt: (unrated.jobDate ?? unrated.startTime).toISOString(),
  };
}

export async function submitCustomerRating(
  jobId: string,
  cleanerId: string,
  stars: number,
  skipped: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { success: false, error: "Not authenticated" };

  const email = session.user.email?.toLowerCase();
  if (!email) return { success: false, error: "No email" };

  // Verify this job belongs to this client
  const client = await db.client.findFirst({ where: { email }, select: { id: true } });
  if (!client) return { success: false, error: "Client not found" };

  const job = await db.job.findUnique({ where: { id: jobId }, select: { clientId: true } });
  if (!job || job.clientId !== client.id) {
    return { success: false, error: "Not authorized" };
  }

  if (skipped) {
    await db.employeeRating.create({
      data: {
        employeeId: cleanerId,
        jobId,
        rating: 0,
        notes: "customer:skipped",
        ratedBy: session.user.id,
      },
    });
  } else {
    if (stars < 1 || stars > 5) return { success: false, error: "Invalid rating" };

    // Map 1-5 star input to 4.0-5.0 display range
    const mappedRating = Math.round((4 + ((stars - 1) / 4)) * 10) / 10;

    await db.employeeRating.create({
      data: {
        employeeId: cleanerId,
        jobId,
        rating: mappedRating,
        notes: `customer:${stars}`,
        ratedBy: session.user.id,
      },
    });
  }

  revalidatePath("/portal");
  return { success: true };
}
