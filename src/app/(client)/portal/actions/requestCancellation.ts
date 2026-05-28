"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { sendAdminBookingCancellationRequest } from "@/lib/email";

// Per spec: cancellation requests are flagged for admin review — never auto-cancel.
export async function requestCancellation(jobId: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };

    const email = session.user.email?.toLowerCase();
    if (!email) return { success: false, error: "Session has no email" };

    const job = await db.job.findUnique({
      where: { id: jobId },
      include: { client: { select: { email: true } } },
    });
    if (!job) return { success: false, error: "Booking not found" };
    if (job.client?.email !== email) {
      return { success: false, error: "Not authorized" };
    }
    if (
      job.status === "CANCELLED" ||
      job.status === "COMPLETED" ||
      job.status === "PAID"
    ) {
      return {
        success: false,
        error: "This booking can no longer be cancelled online — please contact us.",
      };
    }

    await db.$transaction([
      db.job.update({
        where: { id: jobId },
        data: { cancellationRequestedAt: new Date() },
      }),
      db.jobLog.create({
        data: {
          jobId,
          userId: session.user.id,
          action: "NOTE_ADDED",
          description: "Cancellation requested by client",
        },
      }),
    ]);

    // Notify all admins (gated by Settings → Notifications).
    sendAdminBookingCancellationRequest({
      jobId,
      jobNumber: job.jobNumber,
      clientName: job.clientName,
      startTime: job.startTime.toISOString(),
      address: job.location ?? "",
      serviceType: job.jobType,
    }).catch((e) => console.error("admin cancellation-request email", e));

    revalidatePath("/portal");
    revalidatePath("/portal/bookings");
    return { success: true };
  } catch (error) {
    console.error("Error requesting cancellation:", error);
    return { success: false, error: "Failed to submit request" };
  }
}
