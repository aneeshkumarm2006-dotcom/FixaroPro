"use server";

import { getRequiredEquipmentFor } from "@/lib/equipment-server";

// Public read: the booking page shows the customer the equipment/products
// generally required for the selected service (SOP §4, "Show checklist after
// service selection and before checkout"). Honours the admin's override.
//
// Unauthenticated by design — this is the same information printed on the public
// booking page, and it exposes no customer, provider or financial data.
export async function getServiceChecklist(serviceType: string): Promise<string[]> {
  if (!serviceType) return [];
  return getRequiredEquipmentFor(serviceType);
}
