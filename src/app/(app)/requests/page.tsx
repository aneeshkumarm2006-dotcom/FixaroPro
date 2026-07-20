import { requireAdmin } from "@/lib/page-guards";
import { db } from "@/db";
import { depositCollected, getBillingConfig } from "@/lib/billing";
import RequestsPageClient from "./RequestsPageClient";

export default async function RequestsPage() {
  await requireAdmin();

  const cfg = await getBillingConfig();

  const jobs = await db.job.findMany({
    where: {
      OR: [
        { cancellationRequestedAt: { not: null } },
        { rescheduleRequestedAt: { not: null } },
        // Phase 2B — an on-site price revision the Pro raised and the customer
        // has not answered yet. Ops can approve/reject on the customer's behalf
        // (phone agreement) or cancel a request raised in error.
        { priceRevisions: { some: { status: "PENDING" } } },
      ],
    },
    orderBy: [
      { cancellationRequestedAt: "desc" },
      { rescheduleRequestedAt: "desc" },
    ],
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      cleaners: { select: { id: true, name: true } },
      priceRevisions: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 200,
  });

  const serialized = jobs.map((j) => {
    // Amount collected at booking and how much of it is still refundable — drives
    // the one-click "Refund deposit" action on cancellation cards (D0.6 / 4.1).
    const collected = depositCollected(j, cfg);
    const refunded = j.refundedAmount ?? 0;
    const revision = j.priceRevisions[0] ?? null;
    return {
      priceRevision: revision
        ? {
            id: revision.id,
            previousPrice: revision.previousPrice,
            proposedPrice: revision.proposedPrice,
            reason: revision.reason,
            requestedByName: revision.requestedByName,
            createdAt: revision.createdAt.toISOString(),
          }
        : null,
      id: j.id,
      jobNumber: j.jobNumber,
      status: j.status,
      isFlexible: j.isFlexible,
      startTime: j.startTime.toISOString(),
      location: j.location,
      jobType: j.jobType,
      price: j.price,
      cancellationRequestedAt: j.cancellationRequestedAt?.toISOString() ?? null,
      rescheduleRequestedAt: j.rescheduleRequestedAt?.toISOString() ?? null,
      depositPaid: j.depositPaid,
      depositAmount: collected,
      depositRefundable: Math.max(0, collected - refunded),
      client: j.client
        ? {
            id: j.client.id,
            name: j.client.name,
            email: j.client.email,
            phone: j.client.phone,
          }
        : null,
      cleaners: j.cleaners,
    };
  });

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <RequestsPageClient jobs={serialized} />
    </div>
  );
}
