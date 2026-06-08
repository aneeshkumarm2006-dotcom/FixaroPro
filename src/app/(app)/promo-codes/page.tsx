import { requireAdmin } from "@/lib/page-guards";
import { db } from "@/db";
import PromoTabsWrapper from "./PromoTabsWrapper";

export default async function PromoCodesPage() {
  await requireAdmin();

  const [codes, cards] = await Promise.all([
    db.promoCode.findMany({ orderBy: { createdAt: "desc" } }),
    db.giftCard.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <PromoTabsWrapper
        codes={codes.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description,
          discountType: c.discountType,
          discountValue: c.discountValue,
          maxUses: c.maxUses,
          usesCount: c.usesCount,
          expiresAt: c.expiresAt?.toISOString() ?? null,
          isActive: c.isActive,
          createdAt: c.createdAt.toISOString(),
        }))}
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
