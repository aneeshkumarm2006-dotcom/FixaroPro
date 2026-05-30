import { requireAdmin } from "@/lib/page-guards";
import { db } from "@/db";
import KitsAdminClient from "./KitsAdminClient";

export default async function KitsPage() {
  await requireAdmin();

  const [cleaners, products] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ["EMPLOYEE", "FIELD_LEAD"] } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        assignedProducts: {
          orderBy: { product: { name: "asc" } },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unit: true,
                stockLevel: true,
                category: true,
              },
            },
          },
        },
      },
    }),
    db.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        unit: true,
        stockLevel: true,
        category: true,
      },
    }),
  ]);

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <KitsAdminClient
        cleaners={cleaners.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email ?? "",
          kit: c.assignedProducts.map((ep) => ({
            employeeProductId: ep.id,
            productId: ep.product.id,
            productName: ep.product.name,
            unit: ep.product.unit,
            category: ep.product.category,
            quantity: ep.quantity,
            masterStock: ep.product.stockLevel,
          })),
        }))}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          stockLevel: p.stockLevel,
          category: p.category,
        }))}
      />
    </div>
  );
}
