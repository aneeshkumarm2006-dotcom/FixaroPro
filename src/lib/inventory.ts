import { db } from "@/db";

// Returns the id of the default inventory location (the oldest active one),
// creating a "Main Storage" location if none exist yet. Admin stock edits sync
// into this location so the per-location stock cleaners pick from stays in sync
// with the global Product.stockLevel managed on the Inventory page.
export async function ensureDefaultLocationId(): Promise<string> {
  const existing = await db.inventoryLocation.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.inventoryLocation.create({
    data: { name: "Main Storage" },
    select: { id: true },
  });
  return created.id;
}

// Applies a stock delta to a product at the default location. Quantity is
// floored at 0. A positive delta seeds/raises stock; a negative delta lowers it.
export async function syncDefaultLocationStock(
  productId: string,
  delta: number
): Promise<void> {
  if (!delta) return;

  const locationId = await ensureDefaultLocationId();
  const existing = await db.inventoryLocationStock.findUnique({
    where: { locationId_productId: { locationId, productId } },
    select: { quantity: true },
  });

  const newQty = Math.max(0, (existing?.quantity ?? 0) + delta);
  await db.inventoryLocationStock.upsert({
    where: { locationId_productId: { locationId, productId } },
    create: { locationId, productId, quantity: newQty },
    update: { quantity: newQty },
  });
}
