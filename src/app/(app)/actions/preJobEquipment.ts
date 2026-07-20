"use server";

// Fix #7 — Pre-Job Equipment & Materials workflow (SOP §8).
//
// Before a job runs, the assigned Pro submits a six-bucket equipment &
// materials plan; a manager approves, rejects (with a reason) or edits it; and
// only once it is APPROVED may the Pro file a reimbursement for anything they
// had to purchase.
//
// ── Two things called "readiness" ──────────────────────────────────────────
// src/lib/equipment-readiness.ts answers "does this Pro's INVENTORY profile
// cover the service checklist?" — a fuzzy, deliberately fail-open signal used
// for notification targeting. THIS module answers "has the paperwork for this
// specific job been submitted and approved?" — a hard, fail-closed workflow
// state. They are never mixed: nothing here reads EmployeeProduct, and nothing
// there reads JobEquipmentSubmission.
//
// Constants/types/pure helpers live in src/lib/pre-job-equipment.ts, because a
// "use server" module may only export async functions.

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { getRequiredEquipmentFor } from "@/lib/equipment-server";
import {
  BUCKET_KEYS,
  BUCKET_LABELS,
  derivePreJobReadiness,
  emptyBuckets,
  submissionDeadline,
  type EquipmentBuckets,
  type PreJobEquipmentReadiness,
} from "@/lib/pre-job-equipment";

// Manager actions are OWNER/ADMIN/OPS_MANAGER only. Deliberately NOT
// isAdminRole() from role-routing — that one includes FIELD_LEAD, who may read
// the ops queue but must not approve spend.
const MANAGER_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"] as const;

const MAX_ITEMS_PER_BUCKET = 60;
const MAX_ITEM_LENGTH = 120;
const MAX_NOTES_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;
/** Reimbursement requests one Pro may file per job per hour. */
const REIMBURSEMENT_RATE_LIMIT = 10;

// ── Input sanitising ───────────────────────────────────────────────────────

/**
 * Allow-list the incoming buckets: only the six known keys survive, each item
 * is trimmed, length-capped, de-duplicated and count-capped. Anything that is
 * not a string array is rejected rather than coerced.
 */
function sanitiseBuckets(
  input: unknown
): { ok: true; buckets: EquipmentBuckets } | { ok: false; error: string } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const buckets = emptyBuckets();

  for (const key of BUCKET_KEYS) {
    const value = raw[key];
    if (value == null) continue;
    if (!Array.isArray(value)) return { ok: false, error: "Invalid equipment list" };

    const seen = new Set<string>();
    for (const entry of value) {
      if (typeof entry !== "string") return { ok: false, error: "Invalid equipment list" };
      const item = entry.trim().replace(/\s+/g, " ");
      if (!item) continue;
      if (item.length > MAX_ITEM_LENGTH) {
        return { ok: false, error: "One of your items is too long" };
      }
      const dedupeKey = item.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      buckets[key].push(item);
      if (buckets[key].length > MAX_ITEMS_PER_BUCKET) {
        return { ok: false, error: `Too many items in ${BUCKET_LABELS[key]}` };
      }
    }
  }

  return { ok: true, buckets };
}

function sanitiseNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_NOTES_LENGTH) : null;
}

/**
 * Receipt links are stored and later rendered as anchors, so only absolute
 * http(s) URLs are accepted — this rejects javascript:, data: and relative
 * values outright rather than trying to scrub them.
 */
function sanitiseReceiptUrl(
  value: unknown
): { ok: true; url: string | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, url: null };
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) {
    return { ok: false, error: "Invalid receipt link" };
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return { ok: false, error: "Receipt link must be a full http(s) URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Receipt link must be a full http(s) URL" };
  }
  return { ok: true, url: parsed.toString() };
}

function totalItems(buckets: EquipmentBuckets): number {
  return BUCKET_KEYS.reduce((sum, key) => sum + buckets[key].length, 0);
}

// ── Auth helpers ───────────────────────────────────────────────────────────

interface Actor {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
}

async function getActor(): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  const user = session.user as {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  };
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    role: user.role ?? null,
  };
}

function isManager(actor: Actor | null): boolean {
  return !!actor?.role && (MANAGER_ROLES as readonly string[]).includes(actor.role);
}

/** Only the lead employee or an assigned crew member counts as "on the job".
 *  This is the IDOR guard for every provider-side action — the jobId always
 *  comes from the client, so it is never trusted on its own. */
async function isAssignedToJob(jobId: string, userId: string): Promise<boolean> {
  const job = await db.job.findFirst({
    where: {
      id: jobId,
      OR: [{ employeeId: userId }, { cleaners: { some: { id: userId } } }],
    },
    select: { id: true },
  });
  return !!job;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

// Generic client-facing errors; detail stays in the server log.
const DENIED = { success: false as const, error: "Not authorized" };
const FAILED = { success: false as const, error: "Something went wrong" };

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ── Load (provider + manager view) ─────────────────────────────────────────

export interface ReimbursementView {
  id: string;
  item: string;
  amount: number;
  reason: string | null;
  receiptUrl: string | null;
  status: "PENDING" | "APPROVED" | "DENIED" | "PAID";
  reviewNotes: string | null;
  createdAt: string;
  paidAt: string | null;
  providerName: string | null;
}

export interface PreJobEquipmentView {
  jobId: string;
  jobNumber: number;
  startTime: string;
  deadline: string;
  /** Late relative to the deadline: for a saved plan, when it was submitted;
   *  for an unsubmitted one, right now. */
  isLate: boolean;
  readiness: PreJobEquipmentReadiness;
  /** true when the signed-in user may submit/resubmit right now. */
  canSubmit: boolean;
  /** true when the signed-in user may approve/reject/edit. */
  canReview: boolean;
  /** true when the signed-in user may file a reimbursement (APPROVED plan). */
  canRequestReimbursement: boolean;
  /** Buckets to render: the saved submission, else the service prefill. */
  buckets: EquipmentBuckets;
  /** Service checklist behind the prefill, for "reset to checklist". */
  checklist: string[];
  providerNotes: string | null;
  reviewNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  submittedByName: string | null;
  reviewedByName: string | null;
  reimbursements: ReimbursementView[];
}

export async function loadPreJobEquipment(
  jobId: string
): Promise<Result<PreJobEquipmentView>> {
  try {
    if (!validId(jobId)) return DENIED;
    const actor = await getActor();
    if (!actor) return { success: false, error: "Not authenticated" };

    const manager = isManager(actor);
    const readOnlyStaff = actor.role === "FIELD_LEAD";
    const assigned = await isAssignedToJob(jobId, actor.id);
    // Fail closed: not staff and not on this job → nothing to see.
    if (!manager && !readOnlyStaff && !assigned) return DENIED;

    const job = await db.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        jobNumber: true,
        startTime: true,
        jobType: true,
        equipmentSubmission: true,
      },
    });
    if (!job) return DENIED;

    const [checklist, reimbursements] = await Promise.all([
      getRequiredEquipmentFor(job.jobType),
      db.equipmentReimbursement.findMany({
        where: { jobId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const submission = job.equipmentSubmission;
    const readiness = derivePreJobReadiness(submission);

    // Names for the review trail — resolved separately because the schema
    // stores plain ids rather than relations.
    const userIds = [
      submission?.submittedById,
      submission?.reviewedById,
      ...reimbursements.map((r) => r.providerId),
    ].filter((v): v is string => !!v);
    const users = userIds.length
      ? await db.user.findMany({
          where: { id: { in: [...new Set(userIds)] } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name ?? null]));

    const buckets: EquipmentBuckets = submission
      ? {
          coreTools: submission.coreTools,
          consumables: submission.consumables,
          accessEquipment: submission.accessEquipment,
          ppe: submission.ppe,
          customerSupplied: submission.customerSupplied,
          toPurchase: submission.toPurchase,
        }
      : // First visit: seed core tools from the service checklist (which
        // honours the admin's ServiceEquipment override) so the Pro edits an
        // informed draft rather than starting from a blank form.
        { ...emptyBuckets(), coreTools: checklist };

    const deadline = submissionDeadline(job.startTime);

    return {
      success: true,
      data: {
        jobId: job.id,
        jobNumber: job.jobNumber,
        startTime: job.startTime.toISOString(),
        deadline: deadline.toISOString(),
        isLate: (submission?.submittedAt ?? new Date()) > deadline,
        readiness,
        canSubmit: assigned && readiness !== "APPROVED",
        canReview: manager,
        canRequestReimbursement: assigned && readiness === "APPROVED",
        buckets,
        checklist,
        providerNotes: submission?.providerNotes ?? null,
        reviewNotes: submission?.reviewNotes ?? null,
        submittedAt: submission?.submittedAt?.toISOString() ?? null,
        reviewedAt: submission?.reviewedAt?.toISOString() ?? null,
        submittedByName: submission?.submittedById
          ? nameById.get(submission.submittedById) ?? null
          : null,
        reviewedByName: submission?.reviewedById
          ? nameById.get(submission.reviewedById) ?? null
          : null,
        reimbursements: reimbursements.map((r) => ({
          id: r.id,
          item: r.item,
          amount: r.amount,
          reason: r.reason,
          receiptUrl: r.receiptUrl,
          status: r.status,
          reviewNotes: r.reviewNotes,
          createdAt: r.createdAt.toISOString(),
          paidAt: r.paidAt?.toISOString() ?? null,
          providerName: nameById.get(r.providerId) ?? null,
        })),
      },
    };
  } catch (error) {
    console.error("loadPreJobEquipment failed", error);
    return FAILED;
  }
}

// ── 7a: provider submission ────────────────────────────────────────────────

export async function submitPreJobEquipment(input: {
  jobId: string;
  buckets: Partial<EquipmentBuckets>;
  providerNotes?: string;
}) {
  try {
    if (!validId(input?.jobId)) return DENIED;
    const actor = await getActor();
    if (!actor) return { success: false, error: "Not authenticated" };
    // Assignment is the authorization, not role: an EMPLOYEE on another job
    // has no more access here than a stranger.
    if (!(await isAssignedToJob(input.jobId, actor.id))) return DENIED;

    const cleaned = sanitiseBuckets(input.buckets);
    if (!cleaned.ok) return { success: false, error: cleaned.error };
    if (totalItems(cleaned.buckets) === 0) {
      return { success: false, error: "Add at least one item before submitting" };
    }
    const notes = sanitiseNotes(input.providerNotes);

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: {
        id: true,
        jobNumber: true,
        startTime: true,
        equipmentSubmission: { select: { status: true } },
      },
    });
    if (!job) return DENIED;

    const status = job.equipmentSubmission?.status;
    // Resubmission is allowed while PENDING or REJECTED. Once APPROVED the
    // plan is locked — a manager must REOPEN it, so approved spend can never
    // be silently rewritten after the fact.
    if (status === "APPROVED") {
      return {
        success: false,
        error: "This plan is approved and locked. Ask ops to reopen it.",
      };
    }

    const now = new Date();
    const deadline = submissionDeadline(job.startTime);
    const late = now > deadline;

    await db.jobEquipmentSubmission.upsert({
      where: { jobId: job.id },
      create: {
        jobId: job.id,
        status: "PENDING",
        ...cleaned.buckets,
        providerNotes: notes,
        submittedById: actor.id,
        submittedAt: now,
      },
      update: {
        status: "PENDING",
        ...cleaned.buckets,
        providerNotes: notes,
        submittedById: actor.id,
        submittedAt: now,
        // A resubmission clears the previous decision, so the queue never
        // shows a stale rejection reason beside fresh content.
        reviewedById: null,
        reviewedAt: null,
        reviewNotes: null,
      },
    });

    await logAudit({
      entityType: "JobEquipmentSubmission",
      entityId: job.id,
      action: status ? "EQUIPMENT_PLAN_RESUBMITTED" : "EQUIPMENT_PLAN_SUBMITTED",
      oldValue: status ?? "none",
      newValue: "PENDING",
      reason: late ? "Submitted after the 24h deadline" : null,
      actorId: actor.id,
      actorEmail: actor.email,
      description: `Equipment plan ${status ? "resubmitted" : "submitted"} for job #${job.jobNumber}${late ? " (late)" : ""}.`,
    });

    await notifyOps({
      title: late ? "Equipment plan submitted (late)" : "Equipment plan submitted",
      message: `${actor.name ?? "A Pro"} submitted an equipment plan for job #${job.jobNumber}${late ? " after the 24h deadline" : ""}. ${totalItems(cleaned.buckets)} item(s) to review.`,
      jobId: job.id,
      severity: late ? "WARNING" : "INFO",
    });

    revalidatePath(`/my-jobs/${job.id}`);
    revalidatePath(`/jobs/${job.id}`);
    revalidatePath("/equipment-checklists/approvals");
    return { success: true as const, late };
  } catch (error) {
    console.error("submitPreJobEquipment failed", error);
    return FAILED;
  }
}

// ── 7c: manager approve / reject / reopen ──────────────────────────────────

export type ReviewDecision = "APPROVE" | "REJECT" | "REOPEN";

export async function reviewPreJobEquipment(input: {
  jobId: string;
  decision: ReviewDecision;
  reviewNotes?: string;
}) {
  try {
    if (!validId(input?.jobId)) return DENIED;
    const decision = input?.decision;
    if (decision !== "APPROVE" && decision !== "REJECT" && decision !== "REOPEN") {
      return { success: false, error: "Invalid decision" };
    }
    const actor = await getActor();
    if (!actor) return { success: false, error: "Not authenticated" };
    // Re-checked server-side on every call — never inferred from the UI that
    // rendered the button.
    if (!isManager(actor)) return DENIED;

    const notes = sanitiseNotes(input.reviewNotes);
    if (decision === "REJECT" && !notes) {
      return { success: false, error: "A rejection reason is required" };
    }

    const submission = await db.jobEquipmentSubmission.findUnique({
      where: { jobId: input.jobId },
      select: { id: true, status: true, job: { select: { jobNumber: true } } },
    });
    if (!submission) return { success: false, error: "No plan has been submitted yet" };

    const next =
      decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "PENDING";
    // Idempotent: re-clicking approve on an approved plan is a no-op success
    // rather than a second audit row.
    if (submission.status === next && decision !== "REOPEN") {
      return { success: true as const };
    }

    await db.jobEquipmentSubmission.update({
      where: { jobId: input.jobId },
      data: {
        status: next,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });

    await logAudit({
      entityType: "JobEquipmentSubmission",
      entityId: input.jobId,
      action:
        decision === "APPROVE"
          ? "EQUIPMENT_PLAN_APPROVED"
          : decision === "REJECT"
          ? "EQUIPMENT_PLAN_REJECTED"
          : "EQUIPMENT_PLAN_REOPENED",
      oldValue: submission.status,
      newValue: next,
      reason: notes,
      actorId: actor.id,
      actorEmail: actor.email,
      description: `Equipment plan for job #${submission.job.jobNumber} set to ${next} by ${actor.name ?? "a manager"}.`,
    });

    revalidatePath(`/my-jobs/${input.jobId}`);
    revalidatePath(`/jobs/${input.jobId}`);
    revalidatePath("/equipment-checklists/approvals");
    return { success: true as const };
  } catch (error) {
    console.error("reviewPreJobEquipment failed", error);
    return FAILED;
  }
}

/** Manager corrects the buckets before any purchase happens (7c). */
export async function editPreJobEquipment(input: {
  jobId: string;
  buckets: Partial<EquipmentBuckets>;
  reviewNotes?: string;
}) {
  try {
    if (!validId(input?.jobId)) return DENIED;
    const actor = await getActor();
    if (!actor) return { success: false, error: "Not authenticated" };
    if (!isManager(actor)) return DENIED;

    const cleaned = sanitiseBuckets(input.buckets);
    if (!cleaned.ok) return { success: false, error: cleaned.error };
    const notes = sanitiseNotes(input.reviewNotes);

    const existing = await db.jobEquipmentSubmission.findUnique({
      where: { jobId: input.jobId },
      select: { status: true, toPurchase: true, job: { select: { jobNumber: true } } },
    });
    if (!existing) return { success: false, error: "No plan has been submitted yet" };

    await db.jobEquipmentSubmission.update({
      where: { jobId: input.jobId },
      data: {
        ...cleaned.buckets,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        ...(notes ? { reviewNotes: notes } : {}),
      },
    });

    await logAudit({
      entityType: "JobEquipmentSubmission",
      entityId: input.jobId,
      action: "EQUIPMENT_PLAN_EDITED",
      field: "toPurchase",
      oldValue: existing.toPurchase.join(", ") || "none",
      newValue: cleaned.buckets.toPurchase.join(", ") || "none",
      reason: notes,
      actorId: actor.id,
      actorEmail: actor.email,
      description: `Equipment plan for job #${existing.job.jobNumber} edited by ${actor.name ?? "a manager"}.`,
    });

    revalidatePath(`/my-jobs/${input.jobId}`);
    revalidatePath(`/jobs/${input.jobId}`);
    revalidatePath("/equipment-checklists/approvals");
    return { success: true as const };
  } catch (error) {
    console.error("editPreJobEquipment failed", error);
    return FAILED;
  }
}

// ── 7d: reimbursement records ──────────────────────────────────────────────

/**
 * The Pro files a real reimbursement row against the job. Gated on an APPROVED
 * equipment plan — ops approve the spend BEFORE it happens, which is the whole
 * point of 7a/7c. Still raises the ops Alert the old flow relied on.
 */
export async function createEquipmentReimbursement(input: {
  jobId: string;
  item: string;
  amount: number;
  reason?: string;
  receiptUrl?: string;
}) {
  try {
    if (!validId(input?.jobId)) return DENIED;
    const actor = await getActor();
    if (!actor) return { success: false, error: "Not authenticated" };
    if (!(await isAssignedToJob(input.jobId, actor.id))) return DENIED;

    const item = typeof input.item === "string" ? input.item.trim() : "";
    if (!item) return { success: false, error: "Describe what you bought" };
    if (item.length > MAX_ITEM_LENGTH) {
      return { success: false, error: "Description is too long" };
    }
    // Reject NaN/Infinity/negatives/absurd values, and round to cents so the
    // stored figure matches what was displayed.
    if (typeof input.amount !== "number" || !Number.isFinite(input.amount)) {
      return { success: false, error: "Enter a valid amount" };
    }
    const amount = Math.round(input.amount * 100) / 100;
    if (amount <= 0 || amount > 10000) {
      return { success: false, error: "Enter an amount between $0.01 and $10,000" };
    }
    const reason = sanitiseNotes(input.reason);
    const receipt = sanitiseReceiptUrl(input.receiptUrl);
    if (!receipt.ok) return { success: false, error: receipt.error };

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: {
        id: true,
        jobNumber: true,
        equipmentSubmission: { select: { status: true } },
      },
    });
    if (!job) return DENIED;

    // Fail closed: no plan, or a plan not yet approved, means no spend.
    if (derivePreJobReadiness(job.equipmentSubmission) !== "APPROVED") {
      return {
        success: false,
        error:
          "Your equipment plan must be approved by ops before you can claim a purchase.",
      };
    }

    // Cheap per-actor rate limit on a money-adjacent write.
    const recent = await db.equipmentReimbursement.count({
      where: {
        jobId: job.id,
        providerId: actor.id,
        createdAt: { gte: new Date(Date.now() - 3600_000) },
      },
    });
    if (recent >= REIMBURSEMENT_RATE_LIMIT) {
      return { success: false, error: "Too many requests — try again later" };
    }

    const created = await db.equipmentReimbursement.create({
      data: {
        jobId: job.id,
        providerId: actor.id,
        item,
        amount,
        reason,
        receiptUrl: receipt.url,
        status: "PENDING",
      },
      select: { id: true },
    });

    await logAudit({
      entityType: "EquipmentReimbursement",
      entityId: created.id,
      action: "REIMBURSEMENT_REQUESTED",
      field: "amount",
      newValue: amount.toFixed(2),
      reason,
      actorId: actor.id,
      actorEmail: actor.email,
      description: `Equipment reimbursement of $${amount.toFixed(2)} requested for job #${job.jobNumber}.`,
    });

    await notifyOps({
      title: "Equipment reimbursement request",
      message: `${actor.name ?? "A Pro"} requests $${amount.toFixed(2)} for "${item}" on job #${job.jobNumber}.`,
      jobId: job.id,
      severity: "INFO",
    });

    revalidatePath(`/my-jobs/${job.id}`);
    revalidatePath(`/jobs/${job.id}`);
    revalidatePath("/equipment-checklists/approvals");
    return { success: true as const };
  } catch (error) {
    console.error("createEquipmentReimbursement failed", error);
    return FAILED;
  }
}

export type ReimbursementDecision = "APPROVE" | "DENY" | "MARK_PAID";

export async function reviewEquipmentReimbursement(input: {
  reimbursementId: string;
  decision: ReimbursementDecision;
  reviewNotes?: string;
}) {
  try {
    if (!validId(input?.reimbursementId)) return DENIED;
    const decision = input?.decision;
    if (decision !== "APPROVE" && decision !== "DENY" && decision !== "MARK_PAID") {
      return { success: false, error: "Invalid decision" };
    }
    const actor = await getActor();
    if (!actor) return { success: false, error: "Not authenticated" };
    if (!isManager(actor)) return DENIED;

    const notes = sanitiseNotes(input.reviewNotes);
    if (decision === "DENY" && !notes) {
      return { success: false, error: "A denial reason is required" };
    }

    const row = await db.equipmentReimbursement.findUnique({
      where: { id: input.reimbursementId },
      select: {
        id: true,
        status: true,
        amount: true,
        item: true,
        jobId: true,
        job: { select: { jobNumber: true } },
      },
    });
    if (!row) return DENIED;

    // Money only moves forward: PENDING → APPROVED/DENIED → PAID. Marking paid
    // requires an approval first, so nothing is ever paid unreviewed.
    if (decision === "MARK_PAID" && row.status !== "APPROVED") {
      return { success: false, error: "Approve this request before marking it paid" };
    }
    if (decision !== "MARK_PAID" && row.status !== "PENDING") {
      return { success: false, error: "This request has already been reviewed" };
    }

    const next =
      decision === "APPROVE" ? "APPROVED" : decision === "DENY" ? "DENIED" : "PAID";

    // Compare-and-set: the update only lands if the row is still in the status
    // we validated, so a double-click cannot pay twice.
    const updated = await db.equipmentReimbursement.updateMany({
      where: { id: row.id, status: row.status },
      data: {
        status: next,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        ...(notes ? { reviewNotes: notes } : {}),
        ...(decision === "MARK_PAID" ? { paidAt: new Date() } : {}),
      },
    });
    if (updated.count === 0) {
      return { success: false, error: "This request just changed — reload and retry" };
    }

    await logAudit({
      entityType: "EquipmentReimbursement",
      entityId: row.id,
      action: `REIMBURSEMENT_${next}`,
      oldValue: row.status,
      newValue: next,
      reason: notes,
      actorId: actor.id,
      actorEmail: actor.email,
      description: `Reimbursement of $${row.amount.toFixed(2)} for "${row.item}" on job #${row.job.jobNumber} marked ${next}.`,
    });

    revalidatePath(`/my-jobs/${row.jobId}`);
    revalidatePath(`/jobs/${row.jobId}`);
    revalidatePath("/equipment-checklists/approvals");
    return { success: true as const };
  } catch (error) {
    console.error("reviewEquipmentReimbursement failed", error);
    return FAILED;
  }
}

// ── Ops queue (7e, admin page) ─────────────────────────────────────────────

export interface ApprovalQueueRow {
  jobId: string;
  jobNumber: number;
  clientName: string;
  jobType: string | null;
  startTime: string;
  deadline: string;
  readiness: PreJobEquipmentReadiness;
  submittedAt: string | null;
  submittedByName: string | null;
  toPurchase: string[];
  itemCount: number;
  pendingReimbursements: number;
}

/** Jobs with a submitted plan, newest first. Read access includes FIELD_LEAD;
 *  every write still re-checks isManager(). */
export async function loadEquipmentApprovalQueue(
  status: PreJobEquipmentReadiness | "ALL" = "PENDING"
): Promise<Result<ApprovalQueueRow[]>> {
  try {
    const actor = await getActor();
    if (!actor) return { success: false, error: "Not authenticated" };
    if (!isManager(actor) && actor.role !== "FIELD_LEAD") return DENIED;

    // NOT_SUBMITTED can't appear here by definition — a row only exists once
    // something has been submitted — so it collapses to the unfiltered list.
    const where =
      status === "ALL" || status === "NOT_SUBMITTED"
        ? {}
        : { status: status as "PENDING" | "APPROVED" | "REJECTED" };

    const rows = await db.jobEquipmentSubmission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: 200,
      select: {
        jobId: true,
        status: true,
        submittedAt: true,
        submittedById: true,
        toPurchase: true,
        coreTools: true,
        consumables: true,
        accessEquipment: true,
        ppe: true,
        customerSupplied: true,
        job: {
          select: { jobNumber: true, clientName: true, jobType: true, startTime: true },
        },
      },
    });

    const submitterIds = rows.map((r) => r.submittedById).filter((v): v is string => !!v);
    const [users, pending] = await Promise.all([
      submitterIds.length
        ? db.user.findMany({
            where: { id: { in: [...new Set(submitterIds)] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as { id: string; name: string | null }[]),
      rows.length
        ? db.equipmentReimbursement.groupBy({
            by: ["jobId"],
            where: { jobId: { in: rows.map((r) => r.jobId) }, status: "PENDING" },
            _count: { _all: true },
          })
        : Promise.resolve([] as { jobId: string; _count: { _all: number } }[]),
    ]);
    const nameById = new Map(users.map((u) => [u.id, u.name ?? null]));
    const pendingByJob = new Map(pending.map((p) => [p.jobId, p._count._all]));

    return {
      success: true,
      data: rows.map((r) => ({
        jobId: r.jobId,
        jobNumber: r.job.jobNumber,
        clientName: r.job.clientName,
        jobType: r.job.jobType,
        startTime: r.job.startTime.toISOString(),
        deadline: submissionDeadline(r.job.startTime).toISOString(),
        readiness: derivePreJobReadiness(r),
        submittedAt: r.submittedAt?.toISOString() ?? null,
        submittedByName: r.submittedById ? nameById.get(r.submittedById) ?? null : null,
        toPurchase: r.toPurchase,
        itemCount:
          r.coreTools.length +
          r.consumables.length +
          r.accessEquipment.length +
          r.ppe.length +
          r.customerSupplied.length +
          r.toPurchase.length,
        pendingReimbursements: pendingByJob.get(r.jobId) ?? 0,
      })),
    };
  } catch (error) {
    console.error("loadEquipmentApprovalQueue failed", error);
    return FAILED;
  }
}

// ── Shared ops notification ────────────────────────────────────────────────

// Deliberately NOT exported: every export of a "use server" module is a public
// HTTP endpoint, and an unauthenticated "send arbitrary text to every admin"
// endpoint is an alert-spam and phishing vector. Callers are in this file only.
/** Alerts every manager. Copy carries no PII beyond the job number. */
async function notifyOps(input: {
  title: string;
  message: string;
  jobId: string | null;
  severity?: "INFO" | "WARNING";
}) {
  const admins = await db.user.findMany({
    where: { role: { in: [...MANAGER_ROLES] } },
    select: { id: true },
  });
  if (admins.length === 0) return;
  await db.alert.createMany({
    data: admins.map((a) => ({
      type: "GENERAL" as const,
      severity: (input.severity ?? "INFO") as "INFO" | "WARNING",
      title: input.title,
      message: input.message,
      relatedId: input.jobId,
      relatedType: "equipment_submission",
      recipientUserId: a.id,
    })),
  });
}
