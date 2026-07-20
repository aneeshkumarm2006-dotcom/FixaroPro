// Seed defaults for the config layer (SOP §3, stage 8).
//
// The TypeScript constants that USED to be the catalog — SERVICE_CATALOG and
// MATERIALS_PRICING in src/app/(book)/book/types.ts, PAINTING_SCOPES in
// src/lib/painting.ts, the numbers in src/lib/policy.ts — are still the source
// of the DEFAULTS. This module is the one place that reshapes them into a
// RuntimeConfig.
//
// It is used in exactly two situations:
//   1. seeding: the first admin visit copies these rows into the DB, after
//      which the DB is authoritative and edits stop touching source code;
//   2. fallback: while the tables are empty (fresh env, migration not yet
//      applied), getRuntimeConfig() serves this, so nothing 500s and nothing
//      silently reprices — an unseeded environment behaves exactly as it did
//      before Stage 8.
//
// CLIENT-SAFE: no database import. Also the default value of the client
// ServiceConfigProvider context, so a client component rendered outside a
// provider degrades to the seed catalog rather than crashing.

import {
  SERVICE_CATALOG,
  SERVICE_CATEGORIES,
  MATERIALS_PRICING,
  CUSTOMER_PART_DEFAULTS,
  SILICONE_PRICE_PER_ROOM,
  WEATHERPROOFING_FIXED_PRICE,
} from "@/app/(book)/book/types";
import { PAINTING_SCOPES } from "@/lib/painting";
import { DEFAULT_POLICY } from "./policy-registry";
import type {
  RuntimeConfig,
  ServiceConfigItem,
  PaintingScopeConfig,
  MaterialsType,
} from "./types";

/**
 * Fixed-price services, and how their fixed price is applied. Both numbers used
 * to be buried as literals inside booking-pricing.resolveBasePrice / getQuote.
 * Only `pricing: "fixed"` services need an entry.
 */
const FIXED_PRICE_DEFAULTS: Record<
  string,
  { fixedPrice: number; perUnit: boolean }
> = {
  // Silicone sealing bills per room; the booking UI reuses the `hours` field as
  // a room count for this service.
  SILICONE_SEALING: { fixedPrice: SILICONE_PRICE_PER_ROOM, perUnit: true },
  // Weatherproofing is a flat price (the midpoint of the $59–$90 range shown).
  WEATHERPROOFING: { fixedPrice: WEATHERPROOFING_FIXED_PRICE, perUnit: false },
};

/**
 * Customer-facing qualifiers on the materials line.
 *
 * D0.3: painting's $119 must read "Materials & equipment charge — $119 (paint
 * not included)". Fixaro never supplies or picks up paint (SOP §5/§6), and the
 * same is true of the small paint repair materials cost.
 */
const MATERIALS_NOTE_DEFAULTS: Record<string, string> = {
  PAINTING: "paint not included",
  SMALL_PAINT_REPAIR: "paint not included",
};

export const DEFAULT_SERVICES: ServiceConfigItem[] = SERVICE_CATALOG.map(
  (s, i) => {
    const materials = MATERIALS_PRICING[s.value] ?? null;
    const fixed = FIXED_PRICE_DEFAULTS[s.value] ?? null;
    return {
      value: s.value,
      label: s.label,
      category: s.category,
      pricing: s.pricing,
      priceNote: s.priceNote ?? null,
      // D0.2: every seeded service ships active, including Outdoor furniture
      // assembly. Retiring one is an admin toggle, not a deploy.
      active: true,
      sortOrder: i,
      fixedPrice: fixed?.fixedPrice ?? null,
      fixedPricePerUnit: fixed?.perUnit ?? false,
      materialsAmount: materials?.amount ?? null,
      materialsType: (materials?.type as MaterialsType | undefined) ?? null,
      materialsNote: MATERIALS_NOTE_DEFAULTS[s.value] ?? null,
      // Phase 2C — the customer-supplied replacement item. Seeded from the
      // catalog default so ops can retune it per service in the admin editor
      // rather than at the call site.
      requiresCustomerPart: CUSTOMER_PART_DEFAULTS[s.value] != null,
      customerPartNote: CUSTOMER_PART_DEFAULTS[s.value] ?? null,
    };
  }
);

export const DEFAULT_PAINTING_SCOPES: PaintingScopeConfig[] =
  PAINTING_SCOPES.map((s, i) => ({
    key: s.key,
    label: s.label,
    baselineMin: s.baselineMin,
    baselineMax: s.baselineMax,
    note: s.note ?? null,
    active: true,
    sortOrder: i,
  }));

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  services: DEFAULT_SERVICES,
  categories: [...SERVICE_CATEGORIES],
  paintingScopes: DEFAULT_PAINTING_SCOPES,
  policy: DEFAULT_POLICY,
  source: "defaults",
};
