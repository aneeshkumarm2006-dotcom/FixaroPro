"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { recordRatingFromToken } from "@/lib/rating";

export interface PendingRatingJob {
  jobId: string;
  jobNumber: number;
  cleanerName: string;
  cleanerId: string;
  // Shared rating token — the same one used by the "rate us" email link, so
  // the customer is never double-prompted across channels.
  token: string;
  completedAt: string;
}

export async function getPendingClientRating(): Promise<PendingRatingJob | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const email = session.user.email?.toLowerCase();
  if (!email) return null;

  const client = await db.client.findFirst({
    where: { email },
    select: { id: true },
  });
  if (!client) return null;

  // Find an unused, un-skipped, unexpired rating token for one of this
  // client's completed jobs.
  const token = await db.jobRatingToken.findFirst({
    where: {
      usedAt: null,
      ratherNotAnswer: false,
      job: { status: "COMPLETED", clientId: client.id },
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          jobDate: true,
          startTime: true,
          employee: { select: { id: true, name: true } },
          cleaners: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!token) return null;

  // Prefer the cleaner pinned on the token, then the job's primary employee,
  // then the first assigned cleaner.
  const cleaner =
    (token.cleanerId
      ? token.job.cleaners.find((c) => c.id === token.cleanerId) ?? null
      : null) ??
    token.job.employee ??
    token.job.cleaners[0] ??
    null;
  if (!cleaner) return null;

  // Stamp the first time the popup is shown (idempotent).
  if (!token.popupShownAt) {
    await db.jobRatingToken
      .update({ where: { id: token.id }, data: { popupShownAt: new Date() } })
      .catch(() => {});
  }

  return {
    jobId: token.jobId,
    jobNumber: token.job.jobNumber,
    cleanerName: cleaner.name,
    cleanerId: cleaner.id,
    token: token.token,
    completedAt: (token.job.jobDate ?? token.job.startTime).toISOString(),
  };
}

export async function submitCustomerRating(
  token: string,
  stars: number,
  skipped: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { success: false, error: "Not authenticated" };

  const email = session.user.email?.toLowerCase();
  if (!email) return { success: false, error: "No email" };

  // Verify the token belongs to a job owned by this client.
  const client = await db.client.findFirst({
    where: { email },
    select: { id: true },
  });
  if (!client) return { success: false, error: "Client not found" };

  const tokenRow = await db.jobRatingToken.findUnique({
    where: { token },
    select: { job: { select: { clientId: true } } },
  });
  if (!tokenRow || tokenRow.job.clientId !== client.id) {
    return { success: false, error: "Not authorized" };
  }

  const result = await recordRatingFromToken({
    token,
    stars,
    ratedBy: session.user.id,
    ratherNotAnswer: skipped,
  });

  revalidatePath("/portal");
  return result;
}
