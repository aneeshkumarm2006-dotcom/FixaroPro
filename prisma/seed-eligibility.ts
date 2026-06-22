/**
 * One-time backfill for provider service eligibility (SOP §8).
 *
 * After the provider-eligibility migration, providers only see jobs for services
 * they're admin-approved for. To avoid existing crew losing access on rollout,
 * this grants each field provider eligibility for every service type they have
 * actually worked (as lead or assigned cleaner). Admins can prune afterwards.
 *
 * Run once:  npx tsx prisma/seed-eligibility.ts
 * Idempotent — re-running only adds missing rows.
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
      const res = await db.employeeServiceEligibility.upsert({
        where: { employeeId_serviceType: { employeeId: p.id, serviceType } },
        create: { employeeId: p.id, serviceType, isActive: true },
        update: {},
      });
      if (res) granted++;
    }
    if (types.length) {
      console.log(`${p.name}: ${types.length} service(s) — ${types.join(", ")}`);
    }
  }
  console.log(`\nBackfill complete. ${providers.length} providers processed, ${granted} eligibility rows ensured.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
