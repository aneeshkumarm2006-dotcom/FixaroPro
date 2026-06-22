import { requireCleaner } from "@/lib/page-guards";
import { db } from "@/db";
import { getPaintingScope } from "@/lib/painting";
import { isEligibleFor } from "@/lib/eligibility";
import PaintingBidsClient from "./PaintingBidsClient";

export default async function PaintingBidsPage() {
  const session = await requireCleaner();

  // SOP §8: only providers admin-approved for PAINTING see open bids.
  const eligible = await isEligibleFor(session.user.id, "PAINTING");
  if (!eligible) return <PaintingBidsClient jobs={[]} eligible={false} />;

  // Open painting jobs accepting bids (SOP §6).
  const jobs = await db.job.findMany({
    where: { jobType: "PAINTING", paintingStatus: "BIDDING" },
    include: {
      paintingBids: {
        where: { bidderId: session.user.id },
        select: { amount: true, note: true },
      },
    },
    orderBy: { startTime: "asc" },
    take: 100,
  });

  const serialized = jobs.map((j) => {
    const scope = getPaintingScope(j.paintingScope);
    const myBid = j.paintingBids[0] ?? null;
    return {
      id: j.id,
      jobNumber: j.jobNumber,
      startTime: j.startTime.toISOString(),
      isFlexible: j.isFlexible,
      location: j.location,
      scopeLabel: scope?.label ?? j.paintingScope ?? "Painting",
      quoteRangeMin: j.quoteRangeMin,
      quoteRangeMax: j.quoteRangeMax,
      notes: j.notes,
      myBidAmount: myBid?.amount ?? null,
      myBidNote: myBid?.note ?? null,
    };
  });

  return <PaintingBidsClient jobs={serialized} eligible={true} />;
}
