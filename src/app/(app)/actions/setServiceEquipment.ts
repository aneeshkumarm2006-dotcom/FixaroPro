"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { getRequiredEquipment } from "@/lib/equipment";
import { SERVICE_CATALOG } from "@/app/(book)/book/types";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

interface Input {
  serviceType: string;
  /** Full replacement list. Empty array = this service needs no equipment. */
  items: string[];
}

// Admin edits the equipment/products checklist for one service (SOP §4/§8:
// "Checklist templates must be admin-editable by service").
//
// Writes an override row; the seeded default in equipment.ts is used whenever no
// row exists. High-impact enough to audit: the list drives the customer's
// booking-page checklist AND the handyman's missing-equipment warning.
export async function setServiceEquipment(input: Input) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }

    if (!SERVICE_CATALOG.some((s) => s.value === input.serviceType)) {
      return { success: false, error: "Unknown service type" };
    }

    // Trim, drop blanks, de-duplicate while preserving order.
    const items = Array.from(
      new Set(input.items.map((i) => i.trim()).filter(Boolean))
    );

    const existing = await db.serviceEquipment.findUnique({
      where: { serviceType: input.serviceType },
      select: { items: true },
    });
    const oldItems = existing?.items ?? getRequiredEquipment(input.serviceType);

    await db.serviceEquipment.upsert({
      where: { serviceType: input.serviceType },
      create: { serviceType: input.serviceType, items, updatedById: session.user.id },
      update: { items, updatedById: session.user.id },
    });

    await logAudit({
      entityType: "ServiceEquipment",
      entityId: input.serviceType,
      action: "EQUIPMENT_CHECKLIST_UPDATED",
      description: `Equipment checklist updated for ${input.serviceType} (${oldItems.length} → ${items.length} items).`,
      field: "items",
      oldValue: oldItems.join(", "),
      newValue: items.join(", "),
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidatePath("/equipment-checklists");
    return { success: true, items };
  } catch (error) {
    console.error("setServiceEquipment error:", error);
    return { success: false, error: "Failed to save the checklist" };
  }
}

// Revert a service back to its seeded default by deleting the override row.
export async function resetServiceEquipment(serviceType: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }

    const existing = await db.serviceEquipment.findUnique({
      where: { serviceType },
      select: { items: true },
    });
    if (!existing) return { success: true, items: getRequiredEquipment(serviceType) };

    await db.serviceEquipment.delete({ where: { serviceType } });

    await logAudit({
      entityType: "ServiceEquipment",
      entityId: serviceType,
      action: "EQUIPMENT_CHECKLIST_RESET",
      description: `Equipment checklist for ${serviceType} reset to the Fixaro default.`,
      field: "items",
      oldValue: existing.items.join(", "),
      newValue: getRequiredEquipment(serviceType).join(", "),
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidatePath("/equipment-checklists");
    return { success: true, items: getRequiredEquipment(serviceType) };
  } catch (error) {
    console.error("resetServiceEquipment error:", error);
    return { success: false, error: "Failed to reset the checklist" };
  }
}
