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
// Targeting runs through getNotificationTargetsFor, which applies all three
// §11.1 filters (eligibility, job type, equipment readiness). Channels come
// from the catalog: `prov.job.new_eligible` declares APP_PUSH only, so the
// in-app Alert is the only channel dispatched here — and only when the admin
// has left that toggle on (D0.5: the catalog declaration is authoritative,
// filtered by the NotificationSetting toggles).
//
// Server-only. Fire-and-forget from the caller; never throw into a booking flow.

import { db } from "@/db";
import { getNotificationTargetsFor } from "@/lib/eligibility";
import { missingEquipmentSummary } from "@/lib/equipment-readiness";
import { isNotificationEnabled } from "@/lib/notifications";
import { getRuntimeConfig } from "@/lib/config/service-config";
import { serviceLabel as labelFor } from "@/lib/config/types";

/** Label a provider sees for the job's service. Reads the DB catalog, so a
 *  service an admin adds is named properly in the notification rather than
 *  arriving as a raw enum code. */
async function serviceLabel(jobType: string | null): Promise<string> {
  if (!jobType) return "job";
  const cfg = await getRuntimeConfig();
  return labelFor(cfg, jobType);
}

/**
 * Notify providers admin-approved for this job's service type that a new
 * claimable job exists. Returns how many providers were notified.
 *
 * No-ops when the job is already assigned, is a painting job (handled by the bid
 * workflow), when no provider is eligible — an admin has simply not approved
 * anyone for that service yet, which is a configuration state, not an error —
 * or when the admin has switched this notification off.
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

  // The catalog declares APP_PUSH for this key and nothing else; if the admin
  // has turned it off there is no other channel to fall back to.
  if (!(await isNotificationEnabled("PROVIDER", "prov.job.new_eligible", "APP_PUSH"))) {
    return 0;
  }

  const targets = await getNotificationTargetsFor(job.jobType);
  if (targets.length === 0) return 0;

  const label = await serviceLabel(job.jobType);
  const materials = job.customerRequestsMaterials
    ? "Fixaro provides the materials and equipment."
    : "The customer provides all materials and equipment.";

  await db.alert.createMany({
    data: targets.map(({ employeeId, readiness }) => {
      // In "warn" mode a provider short of a tracked item is still notified —
      // they are told what to pick up rather than quietly skipped.
      const shortOf = missingEquipmentSummary(readiness);
      return {
        type: "GENERAL" as const,
        severity: "INFO" as const,
        title: `New ${label} job available`,
        message:
          `${label} booking #${job.jobNumber}${job.location ? ` · ${job.location}` : ""} is open to claim. ${materials}` +
          (shortOf ? ` Check your kit before claiming — you may be missing: ${shortOf}.` : ""),
        relatedId: job.id,
        relatedType: "available_job",
        recipientUserId: employeeId,
      };
    }),
  });

  return targets.length;
}
