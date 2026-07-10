// Server-side equipment checklist resolution (SOP §4/§8).
//
// The authoritative list for a service is:
//   1. the admin's ServiceEquipment row, if one exists
//   2. otherwise the seeded default in equipment.ts
//
// Kept separate from equipment.ts because that module is imported by client
// components (the booking page) and must not pull in the database client.

import { db } from "@/db";
import { EQUIPMENT_BY_SERVICE, getRequiredEquipment } from "@/lib/equipment";
import { SERVICE_CATALOG } from "@/app/(book)/book/types";

/** Admin-overridden checklist for one service, else the seeded default. */
export async function getRequiredEquipmentFor(
  serviceType?: string | null
): Promise<string[]> {
  if (!serviceType) return EQUIPMENT_BY_SERVICE["*"];
  const row = await db.serviceEquipment.findUnique({
    where: { serviceType },
    select: { items: true },
  });
  // An empty override is meaningful: the admin says this service needs nothing.
  if (row) return row.items;
  return getRequiredEquipment(serviceType);
}

export interface ServiceChecklist {
  serviceType: string;
  label: string;
  category: string;
  items: string[];
  /** true when an admin has customised this service away from the default. */
  customised: boolean;
}

/** Every service in the catalog with its effective checklist, for the admin UI. */
export async function getAllServiceChecklists(): Promise<ServiceChecklist[]> {
  const rows = await db.serviceEquipment.findMany({
    select: { serviceType: true, items: true },
  });
  const overrides = new Map(rows.map((r) => [r.serviceType, r.items]));

  return SERVICE_CATALOG.map((s) => {
    const override = overrides.get(s.value);
    return {
      serviceType: s.value,
      label: s.label,
      category: s.category,
      items: override ?? getRequiredEquipment(s.value),
      customised: override != null,
    };
  });
}
