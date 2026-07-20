// Runtime config — shared types and PURE resolution helpers (SOP §3, stage 8).
//
// CLIENT-SAFE: no database import. The same helpers serve
//   • server code, via getRuntimeConfig()          (src/lib/config/service-config.ts)
//   • client components, via useRuntimeConfig()    (src/lib/config/ServiceConfigProvider.tsx)
//   • the import dry-run diff, against a candidate bundle it has not applied yet
//
// so a price can never be resolved one way on the booking page and another way
// in the billing math.

import type { PolicyConfig } from "./policy-registry";

export type ServicePricingType = "hourly" | "fixed" | "quote";
export type MaterialsType = "deposit" | "cost" | "charge";

export interface ServiceConfigItem {
  value: string;
  label: string;
  category: string;
  pricing: ServicePricingType;
  priceNote: string | null;
  active: boolean;
  sortOrder: number;
  /** pricing="fixed" only. */
  fixedPrice: number | null;
  /** true → fixedPrice × booked units (Silicone sealing bills per room). */
  fixedPricePerUnit: boolean;
  /** null = the service has NO materials amount (AC installation), not zero. */
  materialsAmount: number | null;
  materialsType: MaterialsType | null;
  /** Customer-facing qualifier on the materials line ("paint not included"). */
  materialsNote: string | null;
  /**
   * Phase 2C — this service needs a MAJOR REPLACEMENT ITEM the customer buys and
   * has on site (the lock, the faucet, the toilet, the panels). Independent of
   * `materialsAmount`/`customerRequestsMaterials`, which is about the
   * consumables and equipment FIXARO can supply for a surcharge. A job can have
   * both.
   *
   * OPTIONAL on the type (not on the DB column, which is NOT NULL with a false
   * default) because the config import/export bundle in config-io.ts predates
   * this field and builds ServiceConfigItem literals without it. Absent is read
   * as "no customer part", which is the safe reading: we never invent a
   * requirement the catalog didn't state.
   */
  requiresCustomerPart?: boolean;
  /** The noun phrase, e.g. "the replacement lock". Null when the flag is off. */
  customerPartNote?: string | null;
}

export interface PaintingScopeConfig {
  key: string;
  label: string;
  /** INTERNAL cost baseline, PRE-surplus (SOP §7). Never a post-surplus figure. */
  baselineMin: number;
  baselineMax: number;
  note: string | null;
  active: boolean;
  sortOrder: number;
}

export interface RuntimeConfig {
  services: ServiceConfigItem[];
  /** Distinct categories, in service sort order. Drives the grouped selects. */
  categories: string[];
  paintingScopes: PaintingScopeConfig[];
  policy: PolicyConfig;
  /**
   * "db"       — the catalog tables are seeded and authoritative.
   * "defaults" — the tables are empty (unmigrated / unseeded env); the TS seed
   *              constants are in force. Surfaced in the admin UI so an ops user
   *              is never editing a catalog that isn't the one being served.
   */
  source: "db" | "defaults";
}

// ── Service lookups ────────────────────────────────────────────────────────

export function findService(
  cfg: RuntimeConfig,
  serviceType: string | null | undefined
): ServiceConfigItem | null {
  if (!serviceType) return null;
  return cfg.services.find((s) => s.value === serviceType) ?? null;
}

/**
 * Services a customer may book / a provider may be made eligible for. Retired
 * services (D0.2's `active` flag) are hidden from every FORWARD-LOOKING surface
 * but still resolve for lookups, so an in-flight job on a retired service keeps
 * its label, price model and materials rules.
 */
export function activeServices(cfg: RuntimeConfig): ServiceConfigItem[] {
  return cfg.services.filter((s) => s.active);
}

export function activeCategories(cfg: RuntimeConfig): string[] {
  const seen = new Set(activeServices(cfg).map((s) => s.category));
  return cfg.categories.filter((c) => seen.has(c));
}

/** Human label for a job type. Falls back to the raw value, never blank. */
export function serviceLabel(
  cfg: RuntimeConfig,
  serviceType: string | null | undefined
): string {
  if (!serviceType) return "";
  return findService(cfg, serviceType)?.label ?? serviceType;
}

/**
 * The catalog pricing model for a job's service type (D0.7). An unknown service
 * falls back to "fixed" so the stored job.price is used verbatim rather than
 * being recomputed from a clock record it may not have.
 */
export function pricingModelFor(
  cfg: RuntimeConfig,
  serviceType: string | null | undefined
): ServicePricingType {
  return findService(cfg, serviceType)?.pricing ?? "fixed";
}

export interface MaterialsPricing {
  amount: number;
  type: MaterialsType;
  note: string | null;
}

/**
 * Materials/equipment pricing for a service, or null when it has none.
 * A service with a NULL amount or NULL type has none — AC installation carries
 * no automatic materials charge (SOP §5) and must not fall back to a default.
 */
export function materialsFor(
  cfg: RuntimeConfig,
  serviceType: string | null | undefined
): MaterialsPricing | null {
  const svc = findService(cfg, serviceType);
  if (!svc || svc.materialsAmount == null || svc.materialsType == null) return null;
  return {
    amount: svc.materialsAmount,
    type: svc.materialsType,
    note: svc.materialsNote,
  };
}

export interface CustomerPartRequirement {
  /** Noun phrase for "you'll need to have ___ on site". */
  note: string;
}

/**
 * The customer-supplied replacement item this service needs, or null.
 *
 * Falls back to a generic noun phrase when an admin flips the flag on without
 * writing a note, so the customer is never shown "have  on site". Fails CLOSED
 * in the sense that matters here: an unknown service returns null, so we never
 * invent a requirement for a service the catalog doesn't describe.
 */
export function customerPartOf(
  svc: ServiceConfigItem | null | undefined
): CustomerPartRequirement | null {
  if (!svc || !svc.requiresCustomerPart) return null;
  return { note: svc.customerPartNote?.trim() || "the replacement item" };
}

export function customerPartFor(
  cfg: RuntimeConfig,
  serviceType: string | null | undefined
): CustomerPartRequirement | null {
  return customerPartOf(findService(cfg, serviceType));
}

/** Types whose amount is captured on the customer's card at booking time. */
export function isUpfrontMaterials(type: string | null | undefined): boolean {
  return type === "deposit" || type === "charge";
}

/** Only true deposits get the "D" review indicator and apply/refund controls. */
export function isRefundableDeposit(type: string | null | undefined): boolean {
  return type === "deposit";
}

/** Customer-facing label for the materials line (D0.1/D0.3). */
export function materialsLineLabel(m: MaterialsPricing): string {
  const noun =
    m.type === "deposit"
      ? "Materials & equipment deposit"
      : m.type === "charge"
        ? "Materials & equipment charge"
        : "Materials & equipment cost";
  const amount = `$${m.amount % 1 === 0 ? m.amount.toFixed(0) : m.amount.toFixed(2)}`;
  return m.note ? `${noun} — ${amount} (${m.note})` : `${noun} — ${amount}`;
}

// ── Pricing math ───────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Hours → labour price. The 3-hour package is a flat discounted price, applied
 * at BOTH booking (estimate) and final billing (billable clocked hours) so a job
 * clocked to exactly 3h still gets the package and the booked-vs-final figures
 * stay comparable (D0.7).
 */
export function computeHourlyPrice(
  hours: number,
  rate: number,
  threeHourPackagePrice: number
): number {
  if (hours === 3) return threeHourPackagePrice;
  return round2(hours * rate);
}

/**
 * The booked LABOUR component for a service, from the config alone.
 *
 *   hourly → hours (floored at the booking minimum) × rate, package-aware
 *   fixed  → the service's fixedPrice, × units when fixedPricePerUnit
 *            (Silicone sealing reuses the hours field as a room count)
 *   quote  → 0; the real number arrives from the bid/quote flow
 *
 * Before Stage 8 this switched on hardcoded service names — `SILICONE_SEALING`
 * → `hours * 209` and `WEATHERPROOFING` → `74.5` — while the Pricing settings
 * tab happily saved `siliconePerRoom` / `weatherproofingMin` / `weatherproofingMax`
 * values that NOTHING read. Repricing either service in the admin UI silently
 * did nothing. Both now come from the service record.
 */
export function resolveBasePrice(
  cfg: RuntimeConfig,
  hours: number,
  serviceType: string | null | undefined
): number {
  const svc = findService(cfg, serviceType);
  const model = svc?.pricing ?? "hourly";

  if (model === "quote") return 0;

  if (model === "fixed") {
    const unit = svc?.fixedPrice ?? 0;
    return svc?.fixedPricePerUnit ? round2(Math.max(1, hours) * unit) : round2(unit);
  }

  const billed = Math.max(cfg.policy.minBookingHours, hours);
  return computeHourlyPrice(
    billed,
    cfg.policy.labourRate,
    cfg.policy.threeHourPackage
  );
}

// ── Painting (SOP §6/§7) ───────────────────────────────────────────────────

export function findPaintingScope(
  cfg: RuntimeConfig,
  key: string | null | undefined
): PaintingScopeConfig | null {
  if (!key) return null;
  return cfg.paintingScopes.find((s) => s.key === key) ?? null;
}

export function activePaintingScopes(cfg: RuntimeConfig): PaintingScopeConfig[] {
  return cfg.paintingScopes.filter((s) => s.active);
}

/** Immediate customer-facing quote range = internal baseline × surplus rate. */
export function paintingQuoteRange(
  cfg: RuntimeConfig,
  key: string | null | undefined
): { min: number; max: number } | null {
  const scope = findPaintingScope(cfg, key);
  if (!scope) return null;
  const rate = cfg.policy.paintingSurplusRate;
  return {
    min: round2(scope.baselineMin * rate),
    max: round2(scope.baselineMax * rate),
  };
}

/**
 * Authoritative final amount sent to the client = accepted bid × surplus.
 *
 * `surplusRate` is passed explicitly by callers because a painting job STORES
 * the rate it was booked under (Job.paintingSurplusRate): changing the policy
 * value must not silently reprice a job that is already mid-bid.
 */
export function paintingFinalAmount(
  acceptedBid: number,
  surplusRate: number
): number {
  return round2(acceptedBid * surplusRate);
}
