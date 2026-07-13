"use server";

// Admin CRUD for the service catalog (SOP §3, stage 8.1).
//
// The catalog used to be a TypeScript array, so adding a service, repricing one
// or retiring one needed a developer and a deploy. These actions make it ops
// work. Every write is audit-logged (SOP §2.3 / §9: "high-impact changes are
// traceable") — a repricing changes what customers are charged.

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import {
  PRICING_TO_DB,
  MATERIALS_TO_DB,
  seedServiceConfig,
} from "@/lib/config/service-config";
import type { ServicePricingType, MaterialsType } from "@/lib/config/types";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

const PRICING_VALUES: ServicePricingType[] = ["hourly", "fixed", "quote"];
const MATERIALS_VALUES: MaterialsType[] = ["deposit", "cost", "charge"];

// A service `value` is a foreign key by convention: Job.jobType,
// ServiceEquipment.serviceType, EmployeeServiceEligibility.serviceType and
// KitTemplate/checklist rows all point at it as a bare string. Constrain it to
// the SCREAMING_SNAKE shape the existing rows use so nobody creates a service
// whose id can't round-trip through those tables.
const VALUE_RE = /^[A-Z][A-Z0-9_]{1,49}$/;

async function requireAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated" as const };
  const role = (session.user as { role?: string }).role;
  if (!role || !ADMIN_ROLES.includes(role)) {
    return { error: "Not authorized" as const };
  }
  return { session };
}

function revalidateConfigSurfaces() {
  // Everywhere the catalog is rendered or priced.
  revalidatePath("/service-catalog");
  revalidatePath("/equipment-checklists");
  revalidatePath("/book");
  revalidatePath("/quote");
  revalidatePath("/jobs");
}

export interface ServiceCatalogInput {
  value: string;
  label: string;
  category: string;
  pricing: ServicePricingType;
  priceNote?: string | null;
  active: boolean;
  sortOrder?: number;
  fixedPrice?: number | null;
  fixedPricePerUnit?: boolean;
  materialsAmount?: number | null;
  materialsType?: MaterialsType | null;
  materialsNote?: string | null;
}

/** Shared validation — the same rules the import path enforces (config-io.ts). */
function validate(input: ServiceCatalogInput): string | null {
  if (!VALUE_RE.test(input.value)) {
    return "Service code must be UPPER_SNAKE_CASE (letters, digits, underscores), 2–50 characters.";
  }
  if (!input.label.trim()) return "Label is required.";
  if (!input.category.trim()) return "Category is required.";
  if (!PRICING_VALUES.includes(input.pricing)) return "Invalid pricing model.";

  const fixed = input.fixedPrice ?? null;
  if (fixed != null && (fixed < 0 || fixed > 100000)) {
    return "Fixed price must be between $0 and $100,000.";
  }
  // A fixed-price service with no price bills $0 of labour, silently.
  if (input.pricing === "fixed" && (fixed == null || fixed <= 0)) {
    return "A fixed-price service needs a positive fixed price, or it will bill $0 of labour.";
  }

  const amount = input.materialsAmount ?? null;
  const type = input.materialsType ?? null;
  // > 0, not >= 0. A $0 materials record is never what anyone means: Stripe
  // rejects a $0 PaymentIntent, so a $0 "deposit" captures nothing while still
  // raising the "D" review indicator and making billing credit back money that
  // was never taken. "No materials charge" is expressed by leaving BOTH fields
  // empty (AC installation), not by setting the amount to zero.
  if (amount != null && (amount <= 0 || amount > 100000)) {
    return "Materials amount must be more than $0 (leave both fields empty if this service has no materials charge).";
  }
  if (type != null && !MATERIALS_VALUES.includes(type)) {
    return "Invalid materials type.";
  }
  // Half a materials record never works: an amount with no type is never
  // captured, a type with no amount captures nothing.
  if ((amount == null) !== (type == null)) {
    return "Set the materials amount and type together, or leave both empty (empty = this service has no materials charge, like AC installation).";
  }
  return null;
}

function describe(input: ServiceCatalogInput): string {
  const bits: string[] = [input.pricing];
  if (input.pricing === "fixed" && input.fixedPrice != null) {
    bits.push(`$${input.fixedPrice}${input.fixedPricePerUnit ? "/unit" : " flat"}`);
  }
  if (input.materialsAmount != null && input.materialsType) {
    bits.push(`materials $${input.materialsAmount} (${input.materialsType})`);
  }
  if (!input.active) bits.push("inactive");
  return bits.join(" · ");
}

/** Create or update one service. */
export async function saveServiceCatalogItem(input: ServiceCatalogInput) {
  try {
    const guard = await requireAdminSession();
    if ("error" in guard) return { success: false, error: guard.error };
    const { session } = guard;

    const problem = validate(input);
    if (problem) return { success: false, error: problem };

    const existing = await db.serviceCatalogItem.findUnique({
      where: { value: input.value },
    });

    const data = {
      label: input.label.trim(),
      category: input.category.trim(),
      pricing: PRICING_TO_DB[input.pricing],
      priceNote: input.priceNote?.trim() || null,
      active: input.active,
      sortOrder: input.sortOrder ?? existing?.sortOrder ?? 999,
      fixedPrice: input.fixedPrice ?? null,
      fixedPricePerUnit: input.fixedPricePerUnit ?? false,
      materialsAmount: input.materialsAmount ?? null,
      materialsType: input.materialsType
        ? MATERIALS_TO_DB[input.materialsType]
        : null,
      materialsNote: input.materialsNote?.trim() || null,
    };

    await db.serviceCatalogItem.upsert({
      where: { value: input.value },
      create: { value: input.value, ...data },
      update: data,
    });

    await logAudit({
      entityType: "ServiceCatalogItem",
      entityId: input.value,
      action: existing ? "SERVICE_UPDATED" : "SERVICE_CREATED",
      description: existing
        ? `Service ${input.label} (${input.value}) updated: ${describe(input)}.`
        : `Service ${input.label} (${input.value}) created: ${describe(input)}.`,
      field: "service",
      oldValue: existing
        ? JSON.stringify({
            label: existing.label,
            category: existing.category,
            pricing: existing.pricing,
            active: existing.active,
            fixedPrice: existing.fixedPrice,
            fixedPricePerUnit: existing.fixedPricePerUnit,
            materialsAmount: existing.materialsAmount,
            materialsType: existing.materialsType,
          })
        : null,
      newValue: JSON.stringify(data),
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidateConfigSurfaces();
    return { success: true };
  } catch (error) {
    console.error("saveServiceCatalogItem error:", error);
    return { success: false, error: "Failed to save the service" };
  }
}

/**
 * Retire / restore a service (D0.2). Deliberately a toggle and not a delete:
 * jobs, eligibility rows and equipment checklists all reference a service by its
 * `value` string, so deleting the row would orphan history and leave the
 * calendar rendering a raw enum code. Inactive services vanish from the booking
 * page, the quote form and new-job targeting, while everything already booked
 * keeps working.
 */
export async function setServiceActive(value: string, active: boolean) {
  try {
    const guard = await requireAdminSession();
    if ("error" in guard) return { success: false, error: guard.error };
    const { session } = guard;

    const existing = await db.serviceCatalogItem.findUnique({ where: { value } });
    if (!existing) return { success: false, error: "Unknown service" };
    if (existing.active === active) return { success: true };

    await db.serviceCatalogItem.update({ where: { value }, data: { active } });

    // Ops need to know whether retiring this strands work in flight.
    const openJobs = await db.job.count({
      where: {
        jobType: value,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    });

    await logAudit({
      entityType: "ServiceCatalogItem",
      entityId: value,
      action: active ? "SERVICE_ACTIVATED" : "SERVICE_DEACTIVATED",
      description: active
        ? `Service ${existing.label} (${value}) reactivated — bookable again.`
        : `Service ${existing.label} (${value}) retired — hidden from booking, the quote form and new-job targeting. ${openJobs} open job(s) on this service are unaffected.`,
      field: "active",
      oldValue: String(existing.active),
      newValue: String(active),
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidateConfigSurfaces();
    return { success: true, openJobs };
  } catch (error) {
    console.error("setServiceActive error:", error);
    return { success: false, error: "Failed to update the service" };
  }
}

/** Seed (or top up) the catalog tables from the TS defaults. Idempotent. */
export async function seedServiceCatalog() {
  try {
    const guard = await requireAdminSession();
    if ("error" in guard) return { success: false, error: guard.error };
    const { session } = guard;

    const result = await seedServiceConfig();

    await logAudit({
      entityType: "ServiceCatalogItem",
      entityId: "catalog",
      action: "CONFIG_SEEDED",
      description: `Config seeded from Fixaro defaults: ${result.servicesCreated} service(s), ${result.paintingCreated} painting baseline(s), ${result.policyCreated} policy value(s) created. Existing rows were left untouched.`,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidateConfigSurfaces();
    return { success: true, ...result };
  } catch (error) {
    console.error("seedServiceCatalog error:", error);
    return { success: false, error: "Failed to seed the catalog" };
  }
}
