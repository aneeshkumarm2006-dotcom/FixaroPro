// Runtime config loader (SOP §3, stage 8) — SERVER ONLY.
//
// The single place server code reads the service catalog, materials pricing,
// painting baselines and policy values from. Everything downstream — booking
// price, clocked billing, equipment checklists, provider targeting, the quote
// form, admin job cards — resolves through the RuntimeConfig this returns, so
// an admin edit lands everywhere at once and nothing carries a second copy.
//
// FALLBACK CONTRACT. If the catalog tables are empty (fresh environment, or the
// migration is applied but nothing seeded yet) this serves DEFAULT_RUNTIME_CONFIG
// — the same TS constants that were the catalog before Stage 8. That makes the
// rollout inert: an unseeded environment prices, targets and bills exactly as it
// did before, and `source: "defaults"` is surfaced in the admin UI so ops are
// never editing a catalog that isn't the one being served.

import { cache } from "react";
import { db } from "@/db";
import {
  DEFAULT_RUNTIME_CONFIG,
  DEFAULT_SERVICES,
  DEFAULT_PAINTING_SCOPES,
} from "./defaults";
import { resolvePolicy, POLICY_SETTINGS } from "./policy-registry";
import type {
  RuntimeConfig,
  ServiceConfigItem,
  PaintingScopeConfig,
  ServicePricingType,
  MaterialsType,
} from "./types";

// Prisma enum ⇄ config string. The DB spells them upper-case; every consumer,
// every export bundle and the legacy TS constants spell them lower-case.
const PRICING_FROM_DB: Record<string, ServicePricingType> = {
  HOURLY: "hourly",
  FIXED: "fixed",
  QUOTE: "quote",
};
const MATERIALS_FROM_DB: Record<string, MaterialsType> = {
  DEPOSIT: "deposit",
  COST: "cost",
  CHARGE: "charge",
};

export const PRICING_TO_DB: Record<ServicePricingType, "HOURLY" | "FIXED" | "QUOTE"> = {
  hourly: "HOURLY",
  fixed: "FIXED",
  quote: "QUOTE",
};
export const MATERIALS_TO_DB: Record<MaterialsType, "DEPOSIT" | "COST" | "CHARGE"> = {
  deposit: "DEPOSIT",
  cost: "COST",
  charge: "CHARGE",
};

interface ServiceRow {
  value: string;
  label: string;
  category: string;
  pricing: string;
  priceNote: string | null;
  active: boolean;
  sortOrder: number;
  fixedPrice: number | null;
  fixedPricePerUnit: boolean;
  materialsAmount: number | null;
  materialsType: string | null;
  materialsNote: string | null;
}

function serviceFromRow(r: ServiceRow): ServiceConfigItem {
  return {
    value: r.value,
    label: r.label,
    category: r.category,
    pricing: PRICING_FROM_DB[r.pricing] ?? "hourly",
    priceNote: r.priceNote,
    active: r.active,
    sortOrder: r.sortOrder,
    fixedPrice: r.fixedPrice,
    fixedPricePerUnit: r.fixedPricePerUnit,
    materialsAmount: r.materialsAmount,
    materialsType: r.materialsType
      ? (MATERIALS_FROM_DB[r.materialsType] ?? null)
      : null,
    materialsNote: r.materialsNote,
  };
}

/** Categories in service sort order, de-duplicated. */
function categoriesOf(services: ServiceConfigItem[]): string[] {
  const out: string[] = [];
  for (const s of services) if (!out.includes(s.category)) out.push(s.category);
  return out;
}

/**
 * The live config. Wrapped in React `cache()` so a single render/action pass
 * hits the DB once no matter how many consumers ask — the tables are tiny and
 * per-request freshness means an admin's save is visible on the very next
 * request, with no cache to invalidate and no window where the booking page and
 * the billing math disagree.
 */
export const getRuntimeConfig = cache(async (): Promise<RuntimeConfig> => {
  try {
    const [serviceRows, paintingRows, settingRows] = await Promise.all([
      db.serviceCatalogItem.findMany({
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
      db.paintingBaseline.findMany({
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
      db.appSetting.findMany(),
    ]);

    // Policy always resolves — an empty AppSetting table just means "defaults".
    const policy = resolvePolicy(settingRows);

    const seeded = serviceRows.length > 0;
    const services: ServiceConfigItem[] = seeded
      ? serviceRows.map(serviceFromRow)
      : DEFAULT_SERVICES;

    const paintingScopes: PaintingScopeConfig[] =
      paintingRows.length > 0
        ? paintingRows.map((r) => ({
            key: r.key,
            label: r.label,
            baselineMin: r.baselineMin,
            baselineMax: r.baselineMax,
            note: r.note,
            active: r.active,
            sortOrder: r.sortOrder,
          }))
        : DEFAULT_PAINTING_SCOPES;

    return {
      services,
      categories: categoriesOf(services),
      paintingScopes,
      policy,
      source: seeded ? "db" : "defaults",
    };
  } catch (err) {
    // A config read must never take down booking or billing. Falling back to the
    // seed constants reproduces exactly the pre-Stage-8 behaviour.
    console.error("[config] failed to load runtime config, using seed defaults", err);
    return DEFAULT_RUNTIME_CONFIG;
  }
});

/**
 * Serialize for the client boundary. RuntimeConfig is already plain JSON (no
 * Dates, no Decimals), so this is an identity pass with an explicit name — it
 * documents where the config crosses into a client component.
 */
export function serializeConfig(cfg: RuntimeConfig): RuntimeConfig {
  return cfg;
}

// ── Seeding ────────────────────────────────────────────────────────────────

export interface SeedResult {
  servicesCreated: number;
  paintingCreated: number;
  policyCreated: number;
}

/**
 * Copy the TS seed defaults into the config tables. Idempotent and ADDITIVE:
 * it only creates rows that do not exist, so re-running never clobbers an
 * admin's edits — including a service they deliberately deactivated or repriced.
 *
 * A service the admin DELETED will be recreated by a re-seed. That is deliberate:
 * deleting a seeded service is not how you retire one (D0.2 — you deactivate it,
 * which a re-seed preserves), and silently resurrecting is safer than a seeder
 * that has to remember tombstones.
 */
export async function seedServiceConfig(): Promise<SeedResult> {
  const [existingServices, existingPainting, existingSettings] = await Promise.all([
    db.serviceCatalogItem.findMany({ select: { value: true } }),
    db.paintingBaseline.findMany({ select: { key: true } }),
    db.appSetting.findMany({ select: { key: true } }),
  ]);

  const haveService = new Set(existingServices.map((s) => s.value));
  const havePainting = new Set(existingPainting.map((p) => p.key));
  const haveSetting = new Set(existingSettings.map((s) => s.key));

  const newServices = DEFAULT_SERVICES.filter((s) => !haveService.has(s.value));
  const newPainting = DEFAULT_PAINTING_SCOPES.filter((p) => !havePainting.has(p.key));
  const newPolicy = POLICY_SETTINGS.filter((d) => !haveSetting.has(d.key));

  if (newServices.length > 0) {
    await db.serviceCatalogItem.createMany({
      data: newServices.map((s) => ({
        value: s.value,
        label: s.label,
        category: s.category,
        pricing: PRICING_TO_DB[s.pricing],
        priceNote: s.priceNote,
        active: s.active,
        sortOrder: s.sortOrder,
        fixedPrice: s.fixedPrice,
        fixedPricePerUnit: s.fixedPricePerUnit,
        materialsAmount: s.materialsAmount,
        materialsType: s.materialsType ? MATERIALS_TO_DB[s.materialsType] : null,
        materialsNote: s.materialsNote,
      })),
      skipDuplicates: true,
    });
  }

  if (newPainting.length > 0) {
    await db.paintingBaseline.createMany({
      data: newPainting.map((p) => ({
        key: p.key,
        label: p.label,
        baselineMin: p.baselineMin,
        baselineMax: p.baselineMax,
        note: p.note,
        active: p.active,
        sortOrder: p.sortOrder,
      })),
      skipDuplicates: true,
    });
  }

  // Policy rows are materialised so the admin editor and the export bundle show
  // real, editable values rather than implicit defaults. resolvePolicy() would
  // return the same numbers either way.
  if (newPolicy.length > 0) {
    await db.appSetting.createMany({
      data: newPolicy.map((d) => ({
        key: d.key,
        category: d.category,
        value: d.default,
      })),
      skipDuplicates: true,
    });
  }

  return {
    servicesCreated: newServices.length,
    paintingCreated: newPainting.length,
    policyCreated: newPolicy.length,
  };
}

/**
 * Seed on first admin visit, mirroring how the notification catalog bootstraps
 * itself (settings/page.tsx). Never throws into the page: a seeding failure must
 * degrade to the TS defaults, not a 500 on the admin's dashboard.
 */
export async function ensureServiceConfigSeeded(): Promise<void> {
  try {
    const count = await db.serviceCatalogItem.count();
    if (count === 0) await seedServiceConfig();
  } catch (err) {
    console.error("[config] service catalog seeding failed", err);
  }
}
