import { requireAdmin } from "@/lib/page-guards";
import { db } from "@/db";
import WashPayoutsPageClient from "./WashPayoutsPageClient";
import { isOverProjection } from "@/lib/wash";

export default async function WashPayoutsPage() {
  await requireAdmin();

  const [cleaners, payouts, flaggedJobs] = await Promise.all([
    db.user.findMany({
      where: { role: "EMPLOYEE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        ragCredits: true,
        padCredits: true,
      },
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

  const flagged = flaggedJobs.filter((j) =>
    isOverProjection(j.washActualRags, j.washProjectedRags)
  );

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <WashPayoutsPageClient
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
