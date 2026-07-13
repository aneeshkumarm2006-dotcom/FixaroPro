import { requireAdmin } from "@/lib/page-guards";
import { db } from "@/db";
import {
  getRuntimeConfig,
  ensureServiceConfigSeeded,
} from "@/lib/config/service-config";
import { POLICY_SETTINGS } from "@/lib/config/policy-registry";
import ServiceCatalogClient from "./ServiceCatalogClient";

// Service catalog, materials pricing, painting baselines and policy values —
// the config layer SOP §3 phase 1 requires ("Create configuration objects/tables
// for services, materials/equipment charges, deposits, provider eligibility,
// equipment checklists, painting bids, final offers, notifications, refunds,
// cancellation fees, and audit metadata"), with the export/import that its
// acceptance criterion demands.
//
// Admin-only, and every write is audit-logged: repricing a service changes what
// customers are charged.
export default async function ServiceCatalogPage() {
  await requireAdmin();

  // Same bootstrap as the notification catalog: seed from the TS defaults on
  // first visit so the admin lands on a populated, editable catalog rather than
  // an empty table. Idempotent, and never throws.
  await ensureServiceConfigSeeded();

  const [config, jobCounts] = await Promise.all([
    getRuntimeConfig(),
    // How many OPEN jobs sit on each service — so retiring one tells the admin
    // what it strands rather than making them guess.
    db.job.groupBy({
      by: ["jobType"],
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, jobType: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const openJobsByService: Record<string, number> = {};
  for (const row of jobCounts) {
    if (row.jobType) openJobsByService[row.jobType] = row._count._all;
  }

  return (
    <ServiceCatalogClient
      config={config}
      policyDefs={[...POLICY_SETTINGS]}
      openJobsByService={openJobsByService}
    />
  );
}
