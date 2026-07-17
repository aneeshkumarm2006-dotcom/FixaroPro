import { requireCleaner } from "@/lib/page-guards";
import { db } from "@/db";
import { getEligibleServiceTypes } from "@/lib/eligibility";
import { getRequiredEquipmentFor } from "@/lib/equipment-server";
import {
  getEquipmentReadinessByService,
  getEquipmentReadinessMode,
} from "@/lib/equipment-readiness";
import {
  businessDateKey,
  dateKeyFromStoredDate,
} from "@/lib/availability-exceptions";
import AvailableJobsClient from "./AvailableJobsClient";

export default async function AvailableJobsPage() {
  const session = await requireCleaner();

  const now = new Date();

  // Provider eligibility (SOP §8): only show jobs for services this provider is
  // admin-approved for. Painting is excluded (won by bidding, not claimed).
  // Filtering happens server-side — ineligible jobs are never sent to the client.
  const eligibleTypes = (await getEligibleServiceTypes(session.user.id)).filter(
    (t) => t !== "PAINTING"
  );

  // Jobs that: are upcoming, not cancelled, not fully staffed, the cleaner
  // hasn't already claimed, and match an eligible service type.
  const jobs = await db.job.findMany({
    where: {
      startTime: { gte: now },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      cleaners: { none: { id: session.user.id } },
      jobType: { in: eligibleTypes },
    },
    include: {
      cleaners: { select: { id: true } },
    },
    orderBy: { startTime: "asc" },
    take: 100,
  });

  // Filter to only jobs that still need cleaners
  const openJobs = jobs.filter((j) => j.cleaners.length < j.requiredCleaners);

  // Hide jobs that land on a day this provider has blocked off (time off) so the
  // board never shows a card they can't claim. `claimJob` re-checks this
  // server-side — this filter is only to keep the board honest, never the gate.
  const blockedRows = await db.availabilityException.findMany({
    where: {
      employeeId: session.user.id,
      // Wide lower bound so today's midnight-UTC row is always included
      // regardless of server timezone; equality on the business date key below
      // is what actually decides a match.
      date: { gte: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
    },
    select: { date: true },
  });
  const blockedKeys = new Set(
    blockedRows.map((r) => dateKeyFromStoredDate(r.date))
  );
  const claimableJobs =
    blockedKeys.size === 0
      ? openJobs
      : openJobs.filter((j) => !blockedKeys.has(businessDateKey(j.startTime)));

  // Required equipment per job type (SOP §8.4: providers must see the kit
  // before claiming). Resolved server-side via the admin-overridable checklist
  // (equipment-server), deduped by type so we hit the DB once per type.
  //
  // Per D0.9.2 this STATIC list stays visible pre-claim regardless of readiness
  // — "sees required equipment before booking" is about knowing what the job
  // needs, not about what this particular provider is short of.
  const uniqueTypes = [...new Set(claimableJobs.map((j) => j.jobType ?? "*"))];
  const equipmentEntries = await Promise.all(
    uniqueTypes.map(async (t) => [t, await getRequiredEquipmentFor(t === "*" ? null : t)] as const)
  );
  const equipmentByType = Object.fromEntries(equipmentEntries);

  // Equipment readiness for THIS provider (SOP §8 "Missing equipment
  // validation", §3.3 warn-vs-block). One batched pass over the distinct
  // service types on the board — never a query per card. Fail-open: only tools
  // matched to a TOOL-category product they hold none of can ever appear here,
  // so with no TOOL products categorised every job comes back ready.
  const readinessMode = await getEquipmentReadinessMode();
  const readinessByType =
    readinessMode === "off"
      ? new Map<string, { missing: string[] }>()
      : await getEquipmentReadinessByService(uniqueTypes, session.user.id);

  const serialized = claimableJobs.map((j) => {
    const readiness = readinessByType.get(j.jobType ?? "*");
    return {
      id: j.id,
      jobNumber: j.jobNumber,
      startTime: j.startTime.toISOString(),
      isFlexible: j.isFlexible,
      location: j.location,
      jobType: j.jobType,
      price: j.price,
      bedCount: j.bedCount,
      bathCount: j.bathCount,
      requiredCleaners: j.requiredCleaners,
      claimedCount: j.cleaners.length,
      notes: j.notes,
      // SOP §8.4: material status must be visible before claiming.
      customerRequestsMaterials: j.customerRequestsMaterials,
      requiredEquipment: equipmentByType[j.jobType ?? "*"] ?? [],
      // Tools we can positively prove this provider holds none of. The claim
      // action re-checks this server-side — the UI never gets the last word.
      missingEquipment: readiness?.missing ?? [],
    };
  });

  return (
    <div className="cl-page-wrap">
      <div className="cl-page-head">
        <div>
          <h1 className="cl-page-title">
            <span className="cl-page-title-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
            </span>
            Available jobs
          </h1>
          <p className="cl-page-sub">Open shifts you can claim. Jobs disappear once they&apos;re fully staffed.</p>
        </div>
      </div>

      <AvailableJobsClient jobs={serialized} readinessMode={readinessMode} />
    </div>
  );
}
