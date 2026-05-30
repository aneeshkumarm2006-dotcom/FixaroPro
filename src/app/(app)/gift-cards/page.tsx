import { requireAdmin } from "@/lib/page-guards";
import { db } from "@/db";
import GiftCardsAdminClient from "./GiftCardsAdminClient";

export default async function GiftCardsAdminPage() {
  await requireAdmin();

  const cards = await db.giftCard.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <GiftCardsAdminClient
        cards={cards.map((c) => ({
          id: c.id,
          code: c.code,
          amount: c.amount,
          status: c.status,
          purchaserName: c.purchaserName,
          purchaserEmail: c.purchaserEmail,
          recipientName: c.recipientName,
          recipientEmail: c.recipientEmail,
          personalMessage: c.personalMessage,
          coverKey: c.coverKey,
          scheduledDeliveryDate: c.scheduledDeliveryDate?.toISOString() ?? null,
          deliveredAt: c.deliveredAt?.toISOString() ?? null,
          redeemedAt: c.redeemedAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
