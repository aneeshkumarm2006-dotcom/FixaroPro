import { db } from "@/db";
import { requireCleaner } from "@/lib/page-guards";
import MyInventoryClient from "./MyInventoryClient";

export default async function MyInventoryPage() {
  const session = await requireCleaner();
  const userId = session.user.id;

  const [employeeProducts, inventoryRequests, inventoryLocations] =
    await Promise.all([
      db.employeeProduct.findMany({
        where: { employeeId: userId },
        include: {
          product: {
            include: {
              inventoryRule: true,
            },
          },
        },
        orderBy: {
          product: { name: "asc" },
        },
      }),
      db.inventoryRequest.findMany({
        where: { employeeId: userId },
        include: { product: true, kitTemplate: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.inventoryLocation.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const items = employeeProducts.map((ep) => {
    const refillThreshold = ep.product.inventoryRule?.refillThreshold ?? 0;
    const usagePerJob = ep.product.inventoryRule?.usagePerJob ?? 0;
    const isOutOfStock = ep.quantity <= 0;
    const isLow = !isOutOfStock && ep.quantity <= refillThreshold;
    return {
      id: ep.id,
      productId: ep.productId,
      productName: ep.product.name,
      productDescription: ep.product.description,
      unit: ep.product.unit,
      quantity: ep.quantity,
      refillThreshold,
      usagePerJob,
      assignedAt: ep.assignedAt.toISOString(),
      updatedAt: ep.updatedAt.toISOString(),
      isLow,
      isOutOfStock,
    };
  });

  const requests = inventoryRequests.map((r) => ({
    id: r.id,
    productName: r.product?.name ?? null,
    kitName: r.kitTemplate?.name ?? null,
    quantity: r.quantity,
    status: r.status,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <MyInventoryClient
        items={items}
        requests={requests}
        locations={inventoryLocations.map((l) => ({
          id: l.id,
          name: l.name,
          address: l.address,
        }))}
      />
    </div>
  );
}
