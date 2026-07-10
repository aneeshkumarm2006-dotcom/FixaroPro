import { requireAdmin } from "@/lib/page-guards";
import { getAllServiceChecklists } from "@/lib/equipment-server";
import { SERVICE_CATEGORIES } from "@/app/(book)/book/types";
import EquipmentChecklistsClient from "./EquipmentChecklistsClient";

// Admin-editable equipment/products checklist per service (SOP §4/§8).
// The list drives BOTH the customer's booking-page checklist and the handyman's
// required-equipment panel, so it is admin-only and every edit is audit-logged.
export default async function EquipmentChecklistsPage() {
  await requireAdmin();
  const checklists = await getAllServiceChecklists();

  return (
    <EquipmentChecklistsClient
      checklists={checklists}
      categories={[...SERVICE_CATEGORIES]}
    />
  );
}
