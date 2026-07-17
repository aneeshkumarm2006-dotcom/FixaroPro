"use server";

import { db } from "@/db";
import { recordRatingFromToken } from "@/lib/rating";
import { isTrustedIntakePhotoUrl } from "@/lib/cloudinary-url";

// Server-authoritative cap on review photos per submission, independent of the
// client-side MAX_REVIEW_PHOTOS. Never trust the client to enforce this.
const MAX_REVIEW_PHOTOS = 5;

interface SubmitRatingInput {
  token: string;
  stars: number;
  comment?: string;
  /** Cloudinary URLs of customer-attached review photos. Optional. */
  photoUrls?: string[];
}

/**
 * Public "rate your service" link handler. Thin wrapper over the shared
 * token-based path so the email link and the in-portal popup record ratings
 * identically (one token, one code path).
 *
 * Review photos are persisted only AFTER recordRatingFromToken succeeds — that
 * call is the single authorization gate (valid, unused, unexpired token). We
 * fail closed: if the rating is rejected, no ReviewPhoto rows are written.
 */
export async function submitRating(input: SubmitRatingInput) {
  try {
    if (!input.token) return { success: false, error: "Missing token" };
    const result = await recordRatingFromToken({
      token: input.token,
      stars: input.stars,
      comment: input.comment,
      ratedBy: "client-link",
    });

    // Only persist photos once the rating itself was accepted for this token.
    if (result.success && input.photoUrls?.length) {
      await persistReviewPhotos(input.token, input.stars, input.photoUrls);
    }

    return result;
  } catch (error) {
    console.error("Error submitting rating:", error);
    return { success: false, error: "Failed to submit rating" };
  }
}

/**
 * Sanitize + persist customer-attached review photos.
 *
 * `photoUrls` is attacker-controlled (a crafted request can POST arbitrary
 * strings), and these URLs are later rendered in <img src>/<a href> by admins
 * on the job detail surface. So we allow-list only genuine uploads to OUR
 * Cloudinary account/folder (isTrustedIntakePhotoUrl) and hard-cap the count.
 * The jobId is resolved from the same token the rating was recorded under —
 * never from client input — so photos can only attach to the caller's own job.
 */
async function persistReviewPhotos(
  token: string,
  stars: number,
  urls: string[]
): Promise<void> {
  const clean = Array.from(
    new Set(
      urls
        .filter((u): u is string => typeof u === "string")
        .map((u) => u.trim())
        .filter((u) => isTrustedIntakePhotoUrl(u))
    )
  ).slice(0, MAX_REVIEW_PHOTOS);
  if (clean.length === 0) return;

  const tokenRow = await db.jobRatingToken.findUnique({
    where: { token },
    select: { jobId: true },
  });
  if (!tokenRow) return; // fail closed — no job, no photos

  // Bound total photos per job across resubmissions.
  const existing = await db.reviewPhoto.count({
    where: { jobId: tokenRow.jobId },
  });
  const room = Math.max(0, MAX_REVIEW_PHOTOS - existing);
  if (room === 0) return;

  const rating = Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : null;

  await db.reviewPhoto
    .createMany({
      data: clean.slice(0, room).map((url) => ({
        jobId: tokenRow.jobId,
        url,
        rating,
      })),
    })
    .catch((e) => console.error("review photo save", e));
}
