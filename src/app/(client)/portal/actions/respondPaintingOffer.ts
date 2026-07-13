"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { rejectPaintingAndRefund } from "@/lib/painting-workflow";
import { taxInclusiveBreakdown } from "@/lib/tax";

// Client accepts or rejects the final painting offer from their portal (SOP §6).
//   accept → booking confirmed at the agreed final price
//   reject → booking cancelled + $119 materials/equipment charge refunded/removed
export async function respondPaintingOffer(input: {
  jobId: string;
  response: "ACCEPT" | "REJECT";
}) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const email = session.user.email?.toLowerCase();
    if (!email) return { success: false, error: "No email on account" };

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      include: { client: { select: { email: true } } },
    });
    if (!job) return { success: false, error: "Booking not found" };
    if (job.client?.email?.toLowerCase() !== email) {
      return { success: false, error: "Not authorized" };
    }
    if (job.paintingStatus !== "OFFER_SENT") {
      return { success: false, error: "This offer is no longer awaiting a response." };
    }

    if (input.response === "ACCEPT") {
      // Confirm at the agreed final price and rewrite the stored tax split to
      // reconcile with it (the final amount is all-in / tax-inclusive — chargeJob
      // charges job.price directly). Keeps receipts/invoices consistent (SOP §10).
      const finalPrice = job.paintingFinalAmount ?? job.price ?? 0;
      const split = taxInclusiveBreakdown(finalPrice);
      await db.$transaction([
        db.job.update({
          where: { id: job.id },
          data: {
            paintingStatus: "ACCEPTED",
            offerResponse: "ACCEPTED",
            offerRespondedAt: new Date(),
            // Confirm the booking at the agreed final painting price.
            status: "SCHEDULED",
            price: finalPrice,
            subtotalAmount: split.subtotal,
            gstAmount: split.gstAmount,
            qstAmount: split.qstAmount,
          },
        }),
        db.jobLog.create({
          data: {
            jobId: job.id,
            action: "STATUS_CHANGED",
            field: "paintingStatus",
            newValue: "ACCEPTED",
            description: `Client accepted the final painting amount ($${(job.paintingFinalAmount ?? 0).toFixed(2)}). Booking confirmed.`,
          },
        }),
      ]);
      revalidatePath("/portal/bookings");
      revalidatePath(`/portal/bookings/${job.id}`);
      return { success: true, accepted: true };
    }

    // REJECT → cancel + refund deposit
    const result = await rejectPaintingAndRefund(job.id, {
      reason: "Client rejected the final painting offer.",
    });
    if (!result.success) {
      return { success: false, error: result.error ?? "Failed to process rejection" };
    }
    revalidatePath("/portal/bookings");
    revalidatePath(`/portal/bookings/${job.id}`);
    return { success: true, accepted: false, refunded: result.refunded };
  } catch (error) {
    console.error("Error responding to painting offer:", error);
    return { success: false, error: "Failed to submit your response" };
  }
}
