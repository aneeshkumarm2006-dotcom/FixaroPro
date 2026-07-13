import { requireAdmin } from "@/lib/page-guards";
import { getAllServiceChecklists } from "@/lib/equipment-server";
import {
  getEquipmentReadinessMode,
  getEquipmentTrackingCoverage,
} from "@/lib/equipment-readiness";
import { getRuntimeConfig } from "@/lib/config/service-config";
import EquipmentChecklistsClient from "./EquipmentChecklistsClient";

// Admin-editable equipment/products checklist per service (SOP §4/§8).
// The list drives BOTH the customer's booking-page checklist and the handyman's
// required-equipment panel, so it is admin-only and every edit is audit-logged.
//
// It also drives equipment readiness (SOP §11.1) — who gets notified about a new
// job, and what the handyman is warned about at claim time. The readiness mode
// lives here too, next to the data it acts on.
export default async function EquipmentChecklistsPage() {
  await requireAdmin();
  const [checklists, readinessMode, coverage, config] = await Promise.all([
    getAllServiceChecklists(),
    getEquipmentReadinessMode(),
    getEquipmentTrackingCoverage(),
    getRuntimeConfig(),
  ]);

  return (
    <EquipmentChecklistsClient
      checklists={checklists}
      // Categories from the live catalog, so a service an admin adds gets a
      // checklist row here rather than being silently unlisted.
      categories={config.categories}
      readinessMode={readinessMode}
      coverage={coverage}
    />
  );
}
