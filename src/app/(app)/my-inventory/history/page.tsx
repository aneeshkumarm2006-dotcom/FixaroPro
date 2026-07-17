import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getCheckoutHistory } from "../../actions/getCheckoutHistory";
import HistoryClient from "./HistoryClient";

type SearchParams = Promise<{
  start?: string;
  end?: string;
}>;

export default async function CheckoutHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const result = await getCheckoutHistory({
    startDate: params.start,
    endDate: params.end,
  });

  // The signed-in Pro's OWN kit stock movements (scoped to their session id —
  // never a client-supplied id, so no IDOR surface). Shows pickups, admin
  // adjustments, damage/loss reports, and job usage as "prev → new".
  const changeRows = await db.inventoryChange.findMany({
    where: { employeeId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: { select: { name: true, unit: true } } },
  });

  const changes = changeRows.map((c) => ({
    id: c.id,
    productName: c.product?.name ?? "Item",
    quantityChange: c.quantityChange,
    newQuantity: c.newQuantity,
    unit: c.unit ?? c.product?.unit ?? "",
    reason: c.reason,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <HistoryClient
        checkouts={result.success ? result.checkouts : []}
        error={result.success ? null : result.error}
        initialStart={params.start ?? ""}
        initialEnd={params.end ?? ""}
        changes={changes}
      />
    </div>
  );
}
