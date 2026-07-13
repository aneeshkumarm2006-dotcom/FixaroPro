import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { isNotificationEnabled } from "@/lib/notifications";
import { sendAdminPaintingFollowUp } from "@/lib/email";
import {
  PAINTING_BID_WINDOW_HOURS,
  closeBiddingAndSendOffer,
  sendPaintingOfferReminder,
} from "@/lib/painting-workflow";

// Painting bid workflow cron (SOP §6). Runs daily. Three jobs:
//   1. Auto-close bidding after the bid window → send lowest-bid offer.
//   2. Daily reminders while an offer awaits a client response.
//   3. Flag offers unanswered < 24h before the job for an ops phone follow-up.
// vercel.json: { "path": "/api/cron/painting", "schedule": "0 13 * * *" }
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result = { closed: 0, reminded: 0, flagged: 0 };

  // 1. Auto-close bidding once the window has elapsed and at least one valid
  //    bid exists. Software auto-selects the lowest bid (handled in the helper).
  const windowCutoff = new Date(now.getTime() - PAINTING_BID_WINDOW_HOURS * 3600_000);
  const bidding = await db.job.findMany({
    where: {
      jobType: "PAINTING",
      paintingStatus: "BIDDING",
      offerSentAt: null,
      createdAt: { lte: windowCutoff },
    },
    select: { id: true, _count: { select: { paintingBids: true } } },
  });
  for (const job of bidding) {
    if (job._count.paintingBids === 0) continue; // keep waiting for bids
    const r = await closeBiddingAndSendOffer(job.id);
    if (r.sent) result.closed++;
  }

  // 2. Daily reminders while the offer is unanswered (max one per ~24h).
  const reminderCutoff = new Date(now.getTime() - 24 * 3600_000);
  const awaiting = await db.job.findMany({
    where: {
      paintingStatus: "OFFER_SENT",
      offerRespondedAt: null,
      OR: [{ offerLastReminderAt: null }, { offerLastReminderAt: { lte: reminderCutoff } }],
    },
    select: { id: true },
  });
  for (const job of awaiting) {
    const sent = await sendPaintingOfferReminder(job.id);
    if (sent) result.reminded++;
  }

  // 3. Flag offers still unanswered within 24h of the job → ops phone follow-up.
  //    The catalog declares admin.painting.followup_24h on EMAIL + APP_PUSH and
  //    the catalog is authoritative (D0.5), so both are dispatched — each gated
  //    on its own toggle, both to the same ops audience.
  //
  //    NOTE the two lower-bound decisions here, both of which exist because
  //    `followUpFlaggedAt` is a one-shot latch (nothing else reads it — it is
  //    purely this cron's idempotency guard), so anything that stamps it without
  //    telling a human means that client is NEVER called:
  //
  //      • no `startTime: { gte: now }` filter. This cron runs daily; if one run
  //        is skipped or fails, a job whose start fell inside the lost window
  //        would be in the past by the next run and would be latched out forever.
  //        An unanswered offer on a job that should already have started is when
  //        ops most needs the call, not least.
  //      • the flag is stamped only when a channel actually dispatched. Stamping
  //        it with every channel toggled off would silently consume the one
  //        follow-up this job ever gets, and re-enabling the toggle tomorrow
  //        would not bring it back.
  const within24h = new Date(now.getTime() + 24 * 3600_000);
  const followUps = await db.job.findMany({
    where: {
      paintingStatus: "OFFER_SENT",
      offerRespondedAt: null,
      followUpFlaggedAt: null,
      startTime: { lte: within24h },
    },
    select: {
      id: true,
      jobNumber: true,
      clientName: true,
      startTime: true,
      paintingFinalAmount: true,
      client: { select: { phone: true } },
    },
  });
  if (followUps.length > 0) {
    const [appPushOn, emailOn] = await Promise.all([
      isNotificationEnabled("ADMIN", "admin.painting.followup_24h", "APP_PUSH"),
      isNotificationEnabled("ADMIN", "admin.painting.followup_24h", "EMAIL"),
    ]);
    const admins = await db.user.findMany({
      where: { role: { in: ["OWNER", "ADMIN", "OPS_MANAGER"] } },
      select: { id: true, email: true },
    });

    // Nothing to dispatch on (every channel off, or no ops user to receive it)
    // → leave the jobs unflagged so a later run still catches them.
    const canNotify = (appPushOn || emailOn) && admins.length > 0;

    for (const job of followUps) {
      if (!canNotify) continue;

      if (appPushOn) {
        await db.alert.createMany({
          data: admins.map((a) => ({
            type: "GENERAL" as const,
            severity: "CRITICAL" as const,
            title: "Painting offer unanswered — call client",
            message: `Painting booking #${job.jobNumber} (${job.clientName}) hasn't responded to the final offer and the job is < 24h away. Phone the client to confirm.`,
            relatedId: job.id,
            relatedType: "painting_followup",
            recipientUserId: a.id,
          })),
        });
      }

      if (emailOn) {
        for (const admin of admins) {
          if (!admin.email) continue;
          await sendAdminPaintingFollowUp({
            to: admin.email,
            jobId: job.id,
            jobNumber: job.jobNumber,
            clientName: job.clientName,
            clientPhone: job.client?.phone ?? null,
            startTime: job.startTime.toISOString(),
            finalAmount: job.paintingFinalAmount,
          }).catch((err) =>
            console.error("painting follow-up email failed", admin.email, err)
          );
        }
      }

      await db.job.update({
        where: { id: job.id },
        data: { followUpFlaggedAt: now },
      });
      result.flagged++;
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
