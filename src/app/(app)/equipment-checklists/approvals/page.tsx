import { requireAdmin } from "@/lib/page-guards";
import EquipmentApprovalsClient from "./EquipmentApprovalsClient";

// Fix #7 (7e) — ops queue of pre-job equipment & materials plans awaiting a
// decision. Sits beside /equipment-checklists, which defines the per-service
// checklist those plans are prefilled from.
//
// requireAdmin() keeps CLIENT/EMPLOYEE out of the page entirely; the queue
// loader and every decision action re-check the role server-side, and the
// write actions narrow further to OWNER/ADMIN/OPS_MANAGER (a FIELD_LEAD reads
// this queue but cannot approve spend).
export default async function EquipmentApprovalsPage() {
  await requireAdmin();
  return <EquipmentApprovalsClient />;
}
