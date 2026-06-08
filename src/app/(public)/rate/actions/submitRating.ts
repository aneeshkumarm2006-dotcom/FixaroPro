"use server";

import { recordRatingFromToken } from "@/lib/rating";

interface SubmitRatingInput {
  token: string;
  stars: number;
  comment?: string;
}

/**
 * Public "rate your service" link handler. Thin wrapper over the shared
 * token-based path so the email link and the in-portal popup record ratings
 * identically (one token, one code path).
 */
export async function submitRating(input: SubmitRatingInput) {
  try {
    if (!input.token) return { success: false, error: "Missing token" };
    return await recordRatingFromToken({
      token: input.token,
      stars: input.stars,
      comment: input.comment,
      ratedBy: "client-link",
    });
  } catch (error) {
    console.error("Error submitting rating:", error);
    return { success: false, error: "Failed to submit rating" };
  }
}
