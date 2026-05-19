"use server";

import { db } from "@/db";

interface SubmitRatingInput {
  token: string;
  stars: number;
  comment?: string;
}

export async function submitRating(input: SubmitRatingInput) {
  try {
    if (!input.token) return { success: false, error: "Missing token" };
    if (
      !Number.isInteger(input.stars) ||
      input.stars < 1 ||
      input.stars > 5
    ) {
      return { success: false, error: "Rating must be 1-5 stars" };
    }

    const tokenRow = await db.jobRatingToken.findUnique({
      where: { token: input.token },
      include: {
        job: {
          include: {
            cleaners: { select: { id: true } },
          },
        },
      },
    });

    if (!tokenRow) return { success: false, error: "Invalid rating link" };
    if (tokenRow.usedAt) {
      return { success: false, error: "This rating link has already been used" };
    }
    if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
      return { success: false, error: "This rating link has expired" };
    }

    // Cleaners to rate: prefer the explicit cleaner on the token, fall back
    // to all cleaners assigned to the job.
    const cleanerIds = tokenRow.cleanerId
      ? [tokenRow.cleanerId]
      : tokenRow.job.cleaners.map((c) => c.id);

    if (cleanerIds.length === 0) {
      return {
        success: false,
        error: "No cleaners were assigned to this job",
      };
    }

    await db.$transaction([
      ...cleanerIds.map((employeeId) =>
        db.employeeRating.create({
          data: {
            jobId: tokenRow.jobId,
            employeeId,
            rating: input.stars,
            notes: input.comment?.trim() || null,
            ratedBy: "client-link",
          },
        })
      ),
      db.jobRatingToken.update({
        where: { id: tokenRow.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("Error submitting rating:", error);
    return { success: false, error: "Failed to submit rating" };
  }
}
