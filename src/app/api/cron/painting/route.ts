import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
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
  const within24h = new Date(now.getTime() + 24 * 3600_000);
  const followUps = await db.job.findMany({
    where: {
      paintingStatus: "OFFER_SENT",
      offerRespondedAt: null,
      followUpFlaggedAt: null,
      startTime: { lte: within24h, gte: now },
    },
    select: { id: true, jobNumber: true, clientName: true },
  });
  if (followUps.length > 0) {
    const admins = await db.user.findMany({
      where: { role: { in: ["OWNER", "ADMIN", "OPS_MANAGER"] } },
      select: { id: true },
    });
    for (const job of followUps) {
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
      await db.job.update({
        where: { id: job.id },
        data: { followUpFlaggedAt: now },
      });
      result.flagged++;
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
