// Equipment readiness: required tool checklist vs the handyman's equipment
// profile (SOP §8 "Compare required equipment against handyman equipment
// profile", §11.1 "Respect provider eligibility, job type, and equipment
// readiness rules").
//
// Server-only. This is the shared primitive behind BOTH:
//   • new-job notification targeting (6.1, src/lib/eligibility.ts)
//   • the provider-facing missing-equipment warning at claim / my-jobs (7.1)
//
// ── Why this is deliberately fail-open, and why it is TOOL-only ────────────
//
// Two different systems describe "equipment" today:
//
//   1. the per-service TOOL CHECKLIST — free-text strings ("Cordless drill",
//      "Stud finder") from ServiceEquipment.items, defaulting to
//      EQUIPMENT_BY_SERVICE. This is what the SOP means by required equipment.
//   2. the INVENTORY — Product rows with quantities, of which a provider holds
//      some via EmployeeProduct. This is the only machine-readable "equipment
//      profile" a provider has.
//
// (2) is the CLEANING-CONSUMABLES catalog inherited from the fork, not a tool
// profile. Comparing (1) against all of (2) is a category error, and it bites:
// the only two overlaps across the whole 84-item checklist are "Bucket" and
// "Gloves" — cleaning supplies that happen to share a noun with plumbing and
// gutter work. No handyman is ever issued those as EmployeeProduct rows, so
// every provider would read as "missing" them, and strict mode would have
// silently notified NOBODY about toilet repair, faucet repair, faucet
// installation, grout cleaning or gutter cleaning. Worse, it got *worse* the
// more ops stocked the catalog: adding a "Ladder" would have darkened every
// painting service.
//
// So readiness only ever looks at products an admin has explicitly categorised
// `TOOL`. That gives two rules, which the rest of this module exists to enforce:
//
//   A required item counts as MISSING only if it maps to a TOOL product AND the
//   provider holds none of it. An item with no matching TOOL product is
//   UNTRACKED and never counts against anyone, in any mode.
//
//   Opting a product in is therefore a deliberate admin act. With no TOOL
//   products — today's state — readiness is inert BY CONSTRUCTION: it cannot
//   exclude anyone, so it cannot cause a notification blackout.
//
// As ops categorise real tools and assign them to handymen, items graduate
// untracked → tracked and readiness sharpens with no code change. Note the
// belt-and-braces guard in getNotificationTargetsFor (eligibility.ts): even a
// mis-stocked catalog can never empty a job's notification list.

import { db } from "@/db";
import { getAllServiceChecklists, getRequiredEquipmentFor } from "@/lib/equipment-server";
import {
  DEFAULT_EQUIPMENT_READINESS_MODE,
  EQUIPMENT_READINESS_MODES,
  EQUIPMENT_READINESS_SETTING_KEY,
  type EquipmentReadinessMode,
} from "@/lib/equipment-readiness-constants";

export {
  DEFAULT_EQUIPMENT_READINESS_MODE,
  EQUIPMENT_READINESS_SETTING_CATEGORY,
  EQUIPMENT_READINESS_SETTING_KEY,
  type EquipmentReadinessMode,
} from "@/lib/equipment-readiness-constants";

function modeFromSetting(v: unknown): EquipmentReadinessMode | null {
  const raw =
    typeof v === "string"
      ? v
      : v && typeof v === "object"
      ? (v as { mode?: unknown }).mode
      : undefined;
  return typeof raw === "string" &&
    (EQUIPMENT_READINESS_MODES as readonly string[]).includes(raw)
    ? (raw as EquipmentReadinessMode)
    : null;
}

/** Admin-configured readiness mode, defaulting to D6.1's "warn". */
export async function getEquipmentReadinessMode(): Promise<EquipmentReadinessMode> {
  const row = await db.appSetting.findUnique({
    where: { key: EQUIPMENT_READINESS_SETTING_KEY },
    select: { value: true },
  });
  return modeFromSetting(row?.value) ?? DEFAULT_EQUIPMENT_READINESS_MODE;
}

export interface EquipmentReadiness {
  /** No item is positively known to be missing. Untracked items do not count. */
  ready: boolean;
  /** Required, matched to a TOOL product, and the provider holds none of it. */
  missing: string[];
  /** Required, but no TOOL product matches it — unknowable, never held against
   *  anyone. Today this is every item, because no product is categorised TOOL. */
  untracked: string[];
  /** Size of the service's checklist, for context in UI copy. */
  requiredCount: number;
}

/** A fresh "nothing known against them" result. A factory, not a shared
 *  singleton — callers must never be handed the same object by reference. */
function ready(requiredCount = 0): EquipmentReadiness {
  return { ready: true, missing: [], untracked: [], requiredCount };
}

/** Only TOOL products participate in readiness — see the header. */
const TOOL_CATEGORY = "TOOL" as const;

// ── Name matching ──────────────────────────────────────────────────────────
//
// The two sides are authored by different people at different times ("Drop
// cloths" on a checklist vs "Drop cloth" in the product catalog), so match on a
// small set of canonical keys rather than raw equality. Both sides go through
// the same function, and two names match when their key sets intersect.
//
// In these checklists "/" means "or" ("Cordless drill/driver", "Filler/spackle"),
// so each alternative is also a key in its own right.

function singularise(s: string): string {
  return s
    .split(" ")
    .map((w) => {
      if (w.length > 4 && /(sh|ch|x|s)es$/.test(w)) return w.slice(0, -2);
      if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
      return w;
    })
    .join(" ");
}

function keysFor(raw: string): string[] {
  const base = raw
    .toLowerCase()
    .replace(/[^a-z0-9/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return [];

  const keys = new Set<string>();
  for (const variant of [base, ...base.split("/")]) {
    const cleaned = variant.replace(/[/-]/g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    keys.add(cleaned);
    keys.add(singularise(cleaned));
  }
  return [...keys];
}

// ── Assessment ─────────────────────────────────────────────────────────────

/**
 * The TOOL half of the comparison, loaded once: canonical key → the products
 * that satisfy it. Empty when no product is categorised TOOL, which is the
 * inert-by-construction state described in the header.
 */
type ToolIndex = Map<string, Set<string>>;

async function loadToolIndex(): Promise<ToolIndex> {
  // TOOL only. Matching against the full catalog would compare a handyman's
  // drill against a mop bucket — see the header.
  const products = await db.product.findMany({
    where: { category: TOOL_CATEGORY },
    select: { id: true, name: true },
  });

  const index: ToolIndex = new Map();
  for (const product of products) {
    for (const key of keysFor(product.name)) {
      const set = index.get(key) ?? new Set<string>();
      set.add(product.id);
      index.set(key, set);
    }
  }
  return index;
}

/**
 * One checklist against one provider's holdings. The only place a "missing"
 * can be produced, so the two D6.1 rules are enforced here and nowhere else:
 * an empty tool index yields nothing missing, and an item no TOOL product
 * matches is untracked rather than missing.
 */
function assess(
  required: string[],
  holds: Set<string>,
  tools: ToolIndex
): EquipmentReadiness {
  if (required.length === 0) return ready();
  // No tool has been categorised yet → nothing is knowable → nobody is missing
  // anything. Bail before we can invent a single false "missing".
  if (tools.size === 0) return ready(required.length);

  const missing: string[] = [];
  const untracked: string[] = [];

  for (const item of required) {
    const satisfiedBy = new Set<string>();
    for (const key of keysFor(item)) {
      for (const id of tools.get(key) ?? []) satisfiedBy.add(id);
    }
    // Unknowable — forever out of the missing calculation.
    if (satisfiedBy.size === 0) untracked.push(item);
    else if (![...satisfiedBy].some((id) => holds.has(id))) missing.push(item);
  }

  return {
    ready: missing.length === 0,
    missing,
    untracked,
    requiredCount: required.length,
  };
}

/** productId sets each provider holds a non-zero quantity of. */
async function loadHoldings(
  employeeIds: string[]
): Promise<Map<string, Set<string>>> {
  const held = await db.employeeProduct.findMany({
    where: { employeeId: { in: employeeIds }, quantity: { gt: 0 } },
    select: { employeeId: true, productId: true },
  });

  const byEmployee = new Map<string, Set<string>>();
  for (const row of held) {
    const set = byEmployee.get(row.employeeId) ?? new Set<string>();
    set.add(row.productId);
    byEmployee.set(row.employeeId, set);
  }
  return byEmployee;
}

/**
 * Readiness for ONE service across MANY providers, in a fixed number of
 * queries. This is the notification-targeting shape (6.1).
 *
 * Providers with no EmployeeProduct rows simply hold nothing — they are still
 * "ready" for every untracked item, which is the whole point.
 */
export async function getEquipmentReadinessFor(
  serviceType: string | null | undefined,
  employeeIds: string[]
): Promise<Map<string, EquipmentReadiness>> {
  const result = new Map<string, EquipmentReadiness>();
  if (employeeIds.length === 0) return result;

  const required = await getRequiredEquipmentFor(serviceType);
  if (required.length === 0) {
    for (const id of employeeIds) result.set(id, ready());
    return result;
  }

  const [tools, holdings] = await Promise.all([
    loadToolIndex(),
    loadHoldings(employeeIds),
  ]);

  for (const employeeId of employeeIds) {
    result.set(
      employeeId,
      assess(required, holdings.get(employeeId) ?? new Set(), tools)
    );
  }
  return result;
}

/**
 * Readiness for MANY services against ONE provider, in a fixed number of
 * queries. This is the handyman-portal shape (7.1): My Jobs and Available Jobs
 * both list jobs of mixed service types for the signed-in provider, and must
 * not issue a query per row.
 *
 * Keyed by the serviceType string as passed in; jobs with no service type map
 * under "*" (the generic default checklist), matching getRequiredEquipmentFor.
 */
export async function getEquipmentReadinessByService(
  serviceTypes: Array<string | null | undefined>,
  employeeId: string
): Promise<Map<string, EquipmentReadiness>> {
  const result = new Map<string, EquipmentReadiness>();
  const unique = [...new Set(serviceTypes.map((t) => t ?? "*"))];
  if (unique.length === 0) return result;

  const [tools, holdings, checklists] = await Promise.all([
    loadToolIndex(),
    loadHoldings([employeeId]),
    Promise.all(
      unique.map(
        async (type) =>
          [type, await getRequiredEquipmentFor(type === "*" ? null : type)] as const
      )
    ),
  ]);

  const holds = holdings.get(employeeId) ?? new Set<string>();
  for (const [type, required] of checklists) {
    result.set(type, assess(required, holds, tools));
  }
  return result;
}

/** Readiness for a single provider on a single service. */
export async function getEquipmentReadiness(
  serviceType: string | null | undefined,
  employeeId: string
): Promise<EquipmentReadiness> {
  const map = await getEquipmentReadinessFor(serviceType, [employeeId]);
  return map.get(employeeId) ?? ready();
}

/**
 * One-line summary of what a provider is missing, for notification copy.
 * Returns null when there is nothing we can positively say is missing — callers
 * append this only when it is non-null, so "we don't know" never becomes noise.
 */
export function missingEquipmentSummary(
  readiness: EquipmentReadiness | undefined,
  max = 3
): string | null {
  if (!readiness || readiness.missing.length === 0) return null;
  const shown = readiness.missing.slice(0, max).join(", ");
  const rest = readiness.missing.length - max;
  return rest > 0 ? `${shown} +${rest} more` : shown;
}

export interface EquipmentTrackingCoverage {
  /** Distinct required items across every service checklist. */
  totalItems: number;
  /** How many of those map to a Product row, i.e. are actually checkable. */
  trackedItems: number;
}

/**
 * How much of the equipment checklist is machine-checkable right now.
 *
 * This is what makes the readiness mode an honest choice rather than a
 * superstition: with 0 tracked items, "strict" cannot exclude anybody, and the
 * admin UI says so out loud instead of implying a precision we do not have.
 */
export async function getEquipmentTrackingCoverage(): Promise<EquipmentTrackingCoverage> {
  const [checklists, products] = await Promise.all([
    getAllServiceChecklists(),
    db.product.findMany({
      where: { category: TOOL_CATEGORY },
      select: { name: true },
    }),
  ]);

  const productKeys = new Set<string>();
  for (const product of products) {
    for (const key of keysFor(product.name)) productKeys.add(key);
  }

  const items = new Set<string>();
  for (const checklist of checklists) {
    for (const item of checklist.items) items.add(item);
  }

  let trackedItems = 0;
  for (const item of items) {
    if (keysFor(item).some((key) => productKeys.has(key))) trackedItems++;
  }

  return { totalItems: items.size, trackedItems };
}
