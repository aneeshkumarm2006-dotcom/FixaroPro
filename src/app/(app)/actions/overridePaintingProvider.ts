"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { paintingFinalAmount } from "@/lib/painting";
import { getRuntimeConfig } from "@/lib/config/service-config";
import { sendCustomerPaintingOffer } from "@/lib/email";
import { logAudit } from "@/lib/audit";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

interface OverrideInput {
  jobId: string;
  newProviderId: string;
  reason: string;
  // Optional explicit re-price. Omit to keep the client's agreed price.
  newBidAmount?: number;
}

// Admin replaces the auto-accepted provider on a painting job (SOP §6).
//
// Decision D3 — provider swap and price are INDEPENDENT:
//   • By default the client's already-agreed final price is preserved and the
//     client is NOT re-notified (no offer reset, reminders untouched).
//   • Only when the admin explicitly passes a new bid amount do we re-price,
//     reset the offer, re-notify the client, and require a fresh acceptance.
// A reason is always required and the override is audit-logged.
export async function overridePaintingProvider(input: OverrideInput) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }
    if (!input.reason?.trim()) {
      return { success: false, error: "A reason is required to override the provider" };
    }

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      include: {
        client: { select: { email: true } },
        // Previous provider — captured as the audit `oldValue`.
        employee: { select: { id: true, name: true } },
      },
    });
    if (!job || job.jobType !== "PAINTING") {
      return { success: false, error: "Not a painting job" };
    }

    const newProvider = await db.user.findUnique({
      where: { id: input.newProviderId },
      select: { id: true, name: true },
    });
    if (!newProvider) return { success: false, error: "Provider not found" };

    const reprice =
      typeof input.newBidAmount === "number" &&
      Number.isFinite(input.newBidAmount) &&
      input.newBidAmount > 0;

    // Reprice at the rate the job was booked under, not today's policy value.
    const cfg = await getRuntimeConfig();
    const surplus = job.paintingSurplusRate ?? cfg.policy.paintingSurplusRate;
    const newFinal = reprice
      ? paintingFinalAmount(input.newBidAmount!, surplus)
      : job.paintingFinalAmount;

    await db.job.update({
      where: { id: job.id },
      data: {
        employeeId: newProvider.id,
        providerOverrideReason: input.reason.trim(),
        providerOverrideAt: new Date(),
        providerOverrideBy: session.user.id,
        ...(reprice && {
          // Re-price → reset the offer and require fresh client acceptance.
          acceptedBidAmount: input.newBidAmount,
          paintingFinalAmount: newFinal,
          paintingStatus: "OFFER_SENT",
          offerSentAt: new Date(),
          offerRespondedAt: null,
          offerResponse: null,
          offerLastReminderAt: null,
          followUpFlaggedAt: null,
        }),
      },
    });

    await db.jobLog.create({
      data: {
        jobId: job.id,
        userId: session.user.id,
        action: "UPDATED",
        field: "paintingProvider",
        newValue: newProvider.name,
        description: reprice
          ? `Provider overridden to ${newProvider.name} and re-priced to $${newFinal!.toFixed(2)} — new offer sent to client. Reason: ${input.reason.trim()}`
          : `Provider overridden to ${newProvider.name}; client price unchanged ($${(job.paintingFinalAmount ?? 0).toFixed(2)}). Reason: ${input.reason.trim()}`,
      },
    });

    // High-impact change → central AuditLog (SOP §9). The Audit page advertises
    // "provider overrides"; every other high-impact action already uses logAudit.
    // old/new provider, actor, reason and timestamp are all recorded.
    const prevProviderName = job.employee?.name ?? "Unassigned";
    await logAudit({
      entityType: "Job",
      entityId: job.id,
      action: "PAINTING_PROVIDER_OVERRIDE",
      field: "employeeId",
      oldValue: prevProviderName,
      newValue: newProvider.name,
      reason: input.reason.trim(),
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      description: reprice
        ? `Painting provider on booking #${job.jobNumber} overridden from ${prevProviderName} to ${newProvider.name} and re-priced to $${newFinal!.toFixed(2)} — new offer sent to client.`
        : `Painting provider on booking #${job.jobNumber} overridden from ${prevProviderName} to ${newProvider.name}; client price unchanged ($${(job.paintingFinalAmount ?? 0).toFixed(2)}).`,
    });

    // Only re-notify the client when the price actually changed (D3).
    if (reprice && job.client?.email && newFinal) {
      await sendCustomerPaintingOffer({
        to: job.client.email,
        clientName: job.clientName,
        jobId: job.id,
        jobNumber: job.jobNumber,
        finalAmount: newFinal,
      }).catch((err) => console.error("painting re-price offer email failed", err));
    }

    revalidatePath(`/jobs/${job.id}`);
    revalidatePath("/jobs");
    return { success: true, repriced: reprice };
  } catch (error) {
    console.error("Error overriding painting provider:", error);
    return { success: false, error: "Failed to override provider" };
  }
}
