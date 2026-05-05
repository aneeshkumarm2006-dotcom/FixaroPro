import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import MyRagWashClient from "./MyRagWashClient";

export default async function MyRagWashPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const userId = session.user.id;

  const ragWashes = await db.ragWash.findMany({
    where: { employeeId: userId },
    orderBy: { washDate: "desc" },
  });

  const totalRags = ragWashes.reduce((sum, w) => sum + w.ragCount, 0);
  const totalWashes = ragWashes.length;
  const lastWashDate = ragWashes[0]?.washDate.toISOString() || null;

  const washes = ragWashes.map((w) => ({
    id: w.id,
    washDate: w.washDate.toISOString(),
    ragCount: w.ragCount,
    notes: w.notes,
  }));

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <MyRagWashClient
        employeeId={userId}
        washes={washes}
        totalRags={totalRags}
        totalWashes={totalWashes}
        lastWashDate={lastWashDate}
      />
    </div>
  );
}
