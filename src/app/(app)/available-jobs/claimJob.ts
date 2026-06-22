"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isEligibleFor } from "@/lib/eligibility";

export async function claimJob(jobId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };

  const role = (session.user as any).role;
  if (!role || role === "CLIENT") return { success: false, error: "Not authorized" };

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { cleaners: { select: { id: true } } },
  });
  if (!job) return { success: false, error: "Job not found" };

  // Painting is won by bidding, not claimed (SOP §6).
  if (job.jobType === "PAINTING") {
    return { success: false, error: "Painting jobs are won by bidding, not claiming." };
  }

  // SOP §8: provider must be admin-approved for this service type. Enforced
  // server-side so a crafted request can't bypass the UI filter.
  const eligible = await isEligibleFor(session.user.id, job.jobType);
  if (!eligible) {
    return { success: false, error: "You're not approved for this service type." };
  }

  const alreadyCleaner = job.cleaners.some((c) => c.id === session.user.id);
  if (alreadyCleaner) return { success: false, error: "You already claimed this job" };

  const currentCount = job.cleaners.length;
  if (currentCount >= job.requiredCleaners) {
    return { success: false, error: "This job is already fully staffed" };
  }

  await db.job.update({
    where: { id: jobId },
    data: { cleaners: { connect: { id: session.user.id } } },
  });

  await db.jobLog.create({
    data: {
      jobId,
      userId: session.user.id,
      action: "UPDATED",
      field: "cleaners",
      description: `${session.user.name} claimed this job`,
    },
  });

  revalidatePath("/available-jobs");
  revalidatePath("/my-jobs");
  return { success: true };
}
