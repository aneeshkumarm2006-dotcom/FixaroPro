/**
 * Accept / decline workflow helpers.
 *
 * When a cleaner is added to a job, we create a JobAssignmentInvite with
 * an expiry of `ACCEPT_DECLINE_TIMEOUT_MIN` minutes from now. The cleaner
 * accepts or declines from /my-jobs; if they don't respond in time the
 * cron sweep marks it EXPIRED and removes them from the job.
 */

import { db } from "@/db";
import { ACCEPT_DECLINE_TIMEOUT_MIN } from "./policy";

interface CreateInviteOpts {
  jobId: string;
  cleanerIds: string[];
  isLastMinute?: boolean;
  bonusUsd?: number;
}

export async function createAssignmentInvites(opts: CreateInviteOpts) {
  if (opts.cleanerIds.length === 0) return [];
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + ACCEPT_DECLINE_TIMEOUT_MIN * 60_000
  );
  const isLastMinute = opts.isLastMinute ?? false;
  const bonusUsd = opts.bonusUsd ?? 0;

  const created: Array<{ id: string; cleanerId: string }> = [];
  for (const cleanerId of opts.cleanerIds) {
    try {
      const invite = await db.jobAssignmentInvite.upsert({
        where: {
          jobId_cleanerId: { jobId: opts.jobId, cleanerId },
        },
        update: {
          decision: "PENDING",
          sentAt: now,
          respondedAt: null,
          expiresAt,
          declineReason: null,
          isLastMinute,
          bonusUsd,
        },
        create: {
          jobId: opts.jobId,
          cleanerId,
          sentAt: now,
          expiresAt,
          isLastMinute,
          bonusUsd,
        },
        select: { id: true, cleanerId: true },
      });
      created.push(invite);
    } catch (e) {
      console.error("createAssignmentInvites: upsert failed", cleanerId, e);
    }
  }
  return created;
}
