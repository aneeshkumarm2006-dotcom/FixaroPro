/**
 * One-time backfill for provider service eligibility (SOP §8).
 *
 * After the provider-eligibility migration, providers only see jobs for services
 * they're admin-approved for. To avoid existing crew losing access on rollout,
 * this grants each field provider eligibility for every service type they have
 * actually worked (as lead or assigned cleaner). Admins can prune afterwards.
 *
 * This covers crew who pre-date the migration. Providers hired AFTER it get
 * their starting eligibility from onboarding instead — see
 * src/app/(app)/actions/seedOnboardingEligibility.ts (Fix #9f).
 *
 * Run once:  npx tsx prisma/seed-eligibility.ts
 * Idempotent — re-running only adds missing rows, and only audit-logs rows it
 * actually creates.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const providers = await db.user.findMany({
    where: { role: { in: ["EMPLOYEE", "FIELD_LEAD"] } },
    select: { id: true, name: true },
  });

  let granted = 0;
  for (const p of providers) {
    const jobs = await db.job.findMany({
      where: {
        jobType: { not: null },
        OR: [{ employeeId: p.id }, { cleaners: { some: { id: p.id } } }],
      },
      select: { jobType: true },
      distinct: ["jobType"],
    });
    const types = [...new Set(jobs.map((j) => j.jobType).filter(Boolean) as string[])];
    for (const serviceType of types) {
      const existing = await db.employeeServiceEligibility.findUnique({
        where: { employeeId_serviceType: { employeeId: p.id, serviceType } },
        select: { id: true },
      });
      if (existing) continue; // never overwrite an admin decision

      await db.employeeServiceEligibility.create({
        // isActive:true so getEligibleServiceTypes() picks these up.
        data: { employeeId: p.id, serviceType, isActive: true },
      });

      // Same audit shape as the admin matrix, so the override trail is
      // continuous even for rows this script created.
      await db.auditLog.create({
        data: {
          entityType: "EmployeeEligibility",
          entityId: p.id,
          action: "ELIGIBILITY_GRANTED",
          field: serviceType,
          oldValue: "none",
          newValue: "true",
          reason: "backfilled from job history",
          description: `Backfill granted ${serviceType} eligibility to provider ${p.id} based on completed job history.`,
        },
      });
      granted++;
    }
    if (types.length) {
      console.log(`${p.name}: ${types.length} service(s) — ${types.join(", ")}`);
    }
  }
  console.log(`\nBackfill complete. ${providers.length} providers processed, ${granted} new eligibility row(s) created and audit-logged.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
