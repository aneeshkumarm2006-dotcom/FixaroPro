// New eligible-job notifications (SOP §8/§11).
//
//   "New eligible job notification — Notify only eligible providers.
//    Handyman receives notification for jobs they are approved to claim or bid on.
//    Respect provider eligibility, job type, and equipment readiness rules."
//
// Painting has its own bid-specific flow (see notifyPaintingProviders in
// painting-workflow.ts). This covers every other service: when a booking lands
// unassigned, the providers an admin has approved for that service type — and
// only those providers — are told it is claimable.
//
// Server-only. Fire-and-forget from the caller; never throw into a booking flow.

import { db } from "@/db";
import { getEligibleProviderIdsFor } from "@/lib/eligibility";
import { SERVICE_CATALOG } from "@/app/(book)/book/types";

function serviceLabel(jobType: string | null): string {
  if (!jobType) return "job";
  return SERVICE_CATALOG.find((s) => s.value === jobType)?.label ?? jobType;
}

/**
 * Notify providers admin-approved for this job's service type that a new
 * claimable job exists. Returns how many providers were notified.
 *
 * No-ops when the job is already assigned, is a painting job (handled by the bid
 * workflow), or when no provider is eligible — an admin has simply not approved
 * anyone for that service yet, which is a configuration state, not an error.
 */
export async function notifyEligibleProviders(jobId: string): Promise<number> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      jobNumber: true,
      jobType: true,
      location: true,
      employeeId: true,
      customerRequestsMaterials: true,
    },
  });
  if (!job || !job.jobType) return 0;
  // Painting is notified through the bidding flow, not the claim flow.
  if (job.jobType === "PAINTING") return 0;
  // Only unassigned jobs are claimable.
  if (job.employeeId) return 0;

  const providerIds = await getEligibleProviderIdsFor(job.jobType);
  if (providerIds.length === 0) return 0;

  const label = serviceLabel(job.jobType);
  const materials = job.customerRequestsMaterials
    ? "Fixaro provides the materials and equipment."
    : "The customer provides all materials and equipment.";

  await db.alert.createMany({
    data: providerIds.map((uid) => ({
      type: "GENERAL" as const,
      severity: "INFO" as const,
      title: `New ${label} job available`,
      message: `${label} booking #${job.jobNumber}${job.location ? ` · ${job.location}` : ""} is open to claim. ${materials}`,
      relatedId: job.id,
      relatedType: "available_job",
      recipientUserId: uid,
    })),
  });

  return providerIds.length;
}
