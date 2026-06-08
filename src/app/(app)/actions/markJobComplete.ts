"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ensureRatingRequest } from "@/lib/rating";

export async function markJobComplete(jobId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated" };

  await db.job.update({
    where: { id: jobId },
    data: { status: "COMPLETED" },
  });

  // Mint the rating token + send the "rate us" email once (idempotent).
  await ensureRatingRequest(jobId).catch((e) =>
    console.error("ensureRatingRequest (markJobComplete)", e)
  );

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { success: true };
}
