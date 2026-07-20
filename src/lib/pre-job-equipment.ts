// Fix #7 — shared vocabulary for the Pre-Job Equipment & Materials workflow.
//
// Constants, types and pure helpers live here rather than in the server-action
// module, because a "use server" file may only export async functions. Safe to
// import from both client components and server code — no database import.
//
// NOTE ON NAMING: "readiness" here means the PAPERWORK state of one job's
// equipment plan (submitted? approved?). It is a different concept from
// src/lib/equipment-readiness.ts, which compares a Pro's inventory profile
// against a service checklist for notification targeting. Do not conflate them.

/** How far ahead of job start the plan is due. */
export const SUBMISSION_LEAD_HOURS = 24;

export const BUCKET_KEYS = [
  "coreTools",
  "consumables",
  "accessEquipment",
  "ppe",
  "customerSupplied",
  "toPurchase",
] as const;

export type BucketKey = (typeof BUCKET_KEYS)[number];
export type EquipmentBuckets = Record<BucketKey, string[]>;

export const BUCKET_LABELS: Record<BucketKey, string> = {
  coreTools: "Core tools",
  consumables: "Consumables & materials",
  accessEquipment: "Access equipment",
  ppe: "PPE",
  customerSupplied: "Customer-supplied",
  toPurchase: "Needs purchasing",
};

export const BUCKET_HINTS: Record<BucketKey, string> = {
  coreTools: "Tools you'll bring — drill, wrenches, stud finder.",
  consumables: "Materials used up on site — sealant, fixings, filler.",
  accessEquipment: "Ladders, scaffold, dust sheets, floor protection.",
  ppe: "Gloves, eye protection, mask, knee pads.",
  customerSupplied: "Anything the customer is providing — confirm before the visit.",
  toPurchase: "Items you must buy. Ops must approve these before you spend.",
};

export type PreJobEquipmentReadiness =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export const READINESS_LABELS: Record<PreJobEquipmentReadiness, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function emptyBuckets(): EquipmentBuckets {
  return {
    coreTools: [],
    consumables: [],
    accessEquipment: [],
    ppe: [],
    customerSupplied: [],
    toPurchase: [],
  };
}

/**
 * The single place readiness is derived. Absence of a submission row is
 * NOT_SUBMITTED — never "approved by default". Fails closed.
 */
export function derivePreJobReadiness(
  submission: { status: string } | null | undefined
): PreJobEquipmentReadiness {
  if (!submission) return "NOT_SUBMITTED";
  if (submission.status === "APPROVED") return "APPROVED";
  if (submission.status === "REJECTED") return "REJECTED";
  return "PENDING";
}

/** Plan is due SUBMISSION_LEAD_HOURS before the job starts. */
export function submissionDeadline(startTime: Date | string): Date {
  const start = typeof startTime === "string" ? new Date(startTime) : startTime;
  return new Date(start.getTime() - SUBMISSION_LEAD_HOURS * 3600_000);
}

export function countItems(buckets: EquipmentBuckets): number {
  return BUCKET_KEYS.reduce((sum, key) => sum + buckets[key].length, 0);
}
