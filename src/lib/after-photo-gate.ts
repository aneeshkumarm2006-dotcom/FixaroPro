/**
 * Completion-photo gate (Fix #3c / #8b / Phase-2 E).
 *
 * A job may not be marked complete/closed until at least one AFTER-type
 * JobPhoto exists for it. Enforced SERVER-SIDE on every completion path
 * (clockOut, completeJobAsProvider, markJobComplete) — the client button state
 * is a convenience, not the control.
 *
 * Two documented carve-outs, both of which exist to avoid an unclosable job
 * rather than to weaken the rule:
 *
 *  1. `Job.afterPhotoOverrideAt` — the existing admin consent override. When an
 *     admin has stamped it, the after-photo requirement is waived for that job.
 *     Setting it is itself an admin-only, audit-logged action
 *     (setAfterPhotoOverride.ts), so the bypass is attributable.
 *  2. No customer consent AND no override — uploadJobPhoto refuses AFTER photos
 *     in that state (see its consent gate), so requiring one would make the job
 *     permanently uncloseable. The gate stands down and the caller records that
 *     the job closed without photos.
 *
 * Everything else fails CLOSED: consent on file and no photo ⇒ blocked.
 */

import { db } from "@/db";

export interface AfterPhotoGateJob {
  afterPhotoConsent: boolean | null;
  afterPhotoOverrideAt: Date | null;
}

export type AfterPhotoGateResult =
  | { ok: true; waived: false }
  /** Requirement did not apply — `reason` is for the job/audit log, not the client. */
  | { ok: true; waived: true; reason: "ADMIN_OVERRIDE" | "NO_CONSENT" }
  | { ok: false; error: string };

export const AFTER_PHOTO_REQUIRED_MESSAGE =
  "Add at least one completion (after) photo before finishing this job.";

export async function checkAfterPhotoGate(
  jobId: string,
  job: AfterPhotoGateJob
): Promise<AfterPhotoGateResult> {
  if (job.afterPhotoOverrideAt != null) {
    return { ok: true, waived: true, reason: "ADMIN_OVERRIDE" };
  }
  if (!job.afterPhotoConsent) {
    // The crew is not permitted to take after-photos on this job at all.
    return { ok: true, waived: true, reason: "NO_CONSENT" };
  }

  // Count AFTER photos only — customer INTAKE photos share the table and must
  // not satisfy the completion requirement.
  const count = await db.jobPhoto.count({ where: { jobId, kind: "AFTER" } });
  if (count > 0) return { ok: true, waived: false };

  return { ok: false, error: AFTER_PHOTO_REQUIRED_MESSAGE };
}
