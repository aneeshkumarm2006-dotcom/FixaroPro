import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { isOverProjection } from "@/lib/wash";
import RagWashTabsWrapper from "./RagWashTabsWrapper";

export default async function RagWashPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const userRole = (session.user as any).role;
  if (userRole !== "OWNER" && userRole !== "ADMIN") {
    redirect("/dashboard");
  }

  // ── Rag wash data ──────────────────────────────────────────────────────────
  const [employees, ragWashStats, cleaners, payouts, flaggedJobsRaw] =
    await Promise.all([
      db.user.findMany({
        orderBy: { name: "asc" },
        include: {
          ragWashes: { orderBy: { washDate: "desc" }, take: 1 },
          _count: { select: { ragWashes: true } },
        },
      }),
      db.ragWash.groupBy({
        by: ["employeeId"],
        _sum: { ragCount: true },
        _count: true,
      }),
      db.user.findMany({
        where: { role: "EMPLOYEE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, ragCredits: true, padCredits: true },
      }),
      db.washPayout.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { employee: { select: { id: true, name: true } } },
      }),
      db.job.findMany({
        where: {
          status: "COMPLETED",
          washCreditsAwarded: true,
          washActualRags: { not: null },
          washReviewOverrideAt: null,
        },
        orderBy: { clockOutTime: "desc" },
        take: 50,
        select: {
          id: true,
          jobNumber: true,
          clientName: true,
          clockOutTime: true,
          washProjectedRags: true,
          washCappedRags: true,
          washActualRags: true,
          employee: { select: { id: true, name: true } },
        },
      }),
    ]);

  const statsMap = new Map(
    ragWashStats.map((s) => [
      s.employeeId,
      { totalRags: s._sum.ragCount || 0, totalWashes: s._count },
    ])
  );

  const employeeData = employees.map((emp) => {
    const stats = statsMap.get(emp.id);
    const lastWash = emp.ragWashes[0];
    return {
      id: emp.id,
      name: emp.name,
      email: emp.email,
      role: emp.role,
      totalWashes: stats?.totalWashes || 0,
      totalRags: stats?.totalRags || 0,
      lastWashDate: lastWash?.washDate.toISOString() || null,
      lastWashRagCount: lastWash?.ragCount || 0,
    };
  });

  const flagged = flaggedJobsRaw.filter((j) =>
    isOverProjection(j.washActualRags, j.washProjectedRags)
  );

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <RagWashTabsWrapper
        employees={employeeData}
        cleaners={cleaners.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          ragCredits: c.ragCredits,
          padCredits: c.padCredits,
        }))}
        payouts={payouts.map((p) => ({
          id: p.id,
          employeeId: p.employee.id,
          employeeName: p.employee.name,
          amount: p.amount,
          ragCreditsUsed: p.ragCreditsUsed,
          padCreditsUsed: p.padCreditsUsed,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        }))}
        flaggedJobs={flagged.map((j) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          clientName: j.clientName,
          clockOutTime: j.clockOutTime?.toISOString() ?? null,
          projectedRags: j.washProjectedRags,
          actualRags: j.washActualRags,
          employeeName: j.employee?.name ?? "—",
        }))}
      />
    </div>
  );
}
