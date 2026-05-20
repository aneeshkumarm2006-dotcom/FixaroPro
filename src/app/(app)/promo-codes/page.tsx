import { requireAdmin } from "@/lib/page-guards";
import { db } from "@/db";
import PromoCodesClient from "./PromoCodesClient";

export default async function PromoCodesPage() {
  await requireAdmin();

  const codes = await db.promoCode.findMany({
    orderBy: { createdAt: "desc" },
  });

  const serialized = codes.map((c) => ({
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
  }));

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <PromoCodesClient codes={serialized} />
    </div>
  );
}
