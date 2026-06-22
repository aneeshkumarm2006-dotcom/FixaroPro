"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { closeBiddingAndSendOffer } from "@/lib/painting-workflow";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

// Admin closes bidding on a painting job: the software auto-selects the lowest
// valid bid, applies the 35% surplus, and sends the client the final offer
// (SOP §6). Bidding also auto-closes via cron after the bid window.
export async function sendPaintingOffer(jobId: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }

    const result = await closeBiddingAndSendOffer(jobId);
    if (!result.sent) {
      const msg =
        result.reason === "no_bids"
          ? "No valid bids yet — nothing to accept."
          : result.reason === "not_bidding"
          ? "This job is not open for bidding."
          : "Could not send offer.";
      return { success: false, error: msg };
    }

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs");
    return { success: true, finalAmount: result.finalAmount };
  } catch (error) {
    console.error("Error sending painting offer:", error);
    return { success: false, error: "Failed to send offer" };
  }
}
