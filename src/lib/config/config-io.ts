// Config export / import (SOP §3, stage 8.2) — SERVER ONLY.
//
// §3 phase 1's acceptance criterion is that "all settings and workflows in this
// document are represented in the database/config layer and can be exported/
// imported by environment". This module is that: a JSON bundle of the whole
// config set, a VALIDATED import with a dry-run diff before anything is written,
// and an audit-logged apply.
//
// WHAT IS IN THE BUNDLE (and why)
//   services            ServiceCatalogItem   §3 "services, materials/equipment
//                                            charges, deposits" — the pricing
//                                            model, fixed price, materials
//                                            amount + type all live on the row.
//   paintingBaselines   PaintingBaseline     §3 "painting bids, final offers" —
//                                            the internal §7 cost baselines the
//                                            quote range and final offer derive
//                                            from.
//   serviceEquipment    ServiceEquipment     §3 "equipment checklists". Only the
//                                            services an admin has customised
//                                            have a row; absence = the default.
//   notificationSettings NotificationSetting §3 "notifications" — the per-event,
//                                            per-channel toggles (D0.5).
//   appSettings         AppSetting           §3 "refunds, cancellation fees" and
//                                            every other policy value, plus tax
//                                            rates, add-ons, readiness mode.
//
// WHAT IS DELIBERATELY NOT IN IT
//   • EmployeeServiceEligibility — §3 lists "provider eligibility" among the
//     things that need a config TABLE, and it has one. But the ROWS are
//     per-employee data keyed by user id: user ids differ across environments,
//     so importing them would either fail or silently grant the wrong person
//     work. Eligibility is granted per environment through the admin UI.
//   • Jobs, bids, offers, refunds, audit rows — operational records, not config.
//   • Secrets. Nothing here is or references a key/token (§12 security).

import { db } from "@/db";
import {
  POLICY_SETTINGS,
  policyDefByKey,
  validatePolicyValue,
} from "./policy-registry";
import { PRICING_TO_DB, MATERIALS_TO_DB } from "./service-config";
import type {
  ServiceConfigItem,
  PaintingScopeConfig,
  ServicePricingType,
  MaterialsType,
} from "./types";

/** Bump when the bundle shape changes incompatibly. Import refuses a newer one. */
export const CONFIG_BUNDLE_VERSION = 1;

export interface ServiceEquipmentEntry {
  serviceType: string;
  items: string[];
}

export interface NotificationSettingEntry {
  recipient: string;
  key: string;
  channel: string;
  enabled: boolean;
}

export interface AppSettingEntry {
  key: string;
  category: string;
  value: unknown;
}

export interface ConfigBundle {
  version: number;
  exportedAt: string;
  exportedBy: string | null;
  services: ServiceConfigItem[];
  paintingBaselines: PaintingScopeConfig[];
  serviceEquipment: ServiceEquipmentEntry[];
  notificationSettings: NotificationSettingEntry[];
  appSettings: AppSettingEntry[];
}

// ── Export ─────────────────────────────────────────────────────────────────

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

/**
 * AppSetting keys that are PER-USER data, not environment config, and must never
 * leave the environment they were written in.
 *
 * `updateNotificationPrefs` stores one row per staff user at
 * `notifications.prefs.<userId>`. Those rows are keyed by an internal user id
 * that means nothing in another environment — exporting them leaks user ids, and
 * importing them creates orphan rows or, on a prod→staging→prod round trip,
 * overwrites real users' notification preferences with stale ones. Same reasoning
 * as excluding EmployeeServiceEligibility (see the header).
 */
const PER_USER_SETTING_PREFIXES = ["notifications.prefs."];

function isEnvironmentConfigKey(key: string): boolean {
  return !PER_USER_SETTING_PREFIXES.some((p) => key.startsWith(p));
}

export async function exportConfigBundle(
  exportedBy: string | null,
  now: Date
): Promise<ConfigBundle> {
  const [services, painting, equipment, notifications, allSettings] =
    await Promise.all([
      db.serviceCatalogItem.findMany({ orderBy: { sortOrder: "asc" } }),
      db.paintingBaseline.findMany({ orderBy: { sortOrder: "asc" } }),
      db.serviceEquipment.findMany({ orderBy: { serviceType: "asc" } }),
      db.notificationSetting.findMany({
        orderBy: [{ recipient: "asc" }, { sortOrder: "asc" }],
      }),
      db.appSetting.findMany({ orderBy: { key: "asc" } }),
    ]);

  const settings = allSettings.filter((s) => isEnvironmentConfigKey(s.key));

  return {
    version: CONFIG_BUNDLE_VERSION,
    exportedAt: now.toISOString(),
    exportedBy,
    services: services.map((s) => ({
      value: s.value,
      label: s.label,
      category: s.category,
      pricing: PRICING_FROM_DB[s.pricing] ?? "hourly",
      priceNote: s.priceNote,
      active: s.active,
      sortOrder: s.sortOrder,
      fixedPrice: s.fixedPrice,
      fixedPricePerUnit: s.fixedPricePerUnit,
      materialsAmount: s.materialsAmount,
      materialsType: s.materialsType
        ? (MATERIALS_FROM_DB[s.materialsType] ?? null)
        : null,
      materialsNote: s.materialsNote,
    })),
    paintingBaselines: painting.map((p) => ({
      key: p.key,
      label: p.label,
      baselineMin: p.baselineMin,
      baselineMax: p.baselineMax,
      note: p.note,
      active: p.active,
      sortOrder: p.sortOrder,
    })),
    serviceEquipment: equipment.map((e) => ({
      serviceType: e.serviceType,
      items: e.items,
    })),
    notificationSettings: notifications.map((n) => ({
      recipient: n.recipient,
      key: n.key,
      channel: n.channel,
      enabled: n.enabled,
    })),
    appSettings: settings.map((s) => ({
      key: s.key,
      category: s.category,
      value: s.value,
    })),
  };
}

// ── Validation ─────────────────────────────────────────────────────────────

const PRICING_VALUES: ServicePricingType[] = ["hourly", "fixed", "quote"];
const MATERIALS_VALUES: MaterialsType[] = ["deposit", "cost", "charge"];

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Validate a candidate bundle. Returns the parsed bundle plus every problem
 * found — we do NOT stop at the first error, because an admin fixing a
 * hand-edited file wants the whole list, not one round-trip per typo.
 *
 * Every money field is range-checked here, and policy values are checked against
 * their registry rule, so an import can never write a negative labour rate or a
 * materials type the billing code doesn't understand.
 */
export function validateConfigBundle(raw: unknown): {
  bundle: ConfigBundle | null;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isObj(raw)) return { bundle: null, errors: ["File is not a JSON object."] };

  const version = raw.version;
  if (typeof version !== "number") {
    errors.push("Missing `version` — this does not look like a Fixaro config export.");
  } else if (version > CONFIG_BUNDLE_VERSION) {
    errors.push(
      `Bundle version ${version} is newer than this deployment understands (${CONFIG_BUNDLE_VERSION}). Upgrade before importing.`
    );
  }

  // ── services ──
  const services: ServiceConfigItem[] = [];
  const rawServices = raw.services;
  if (!Array.isArray(rawServices)) {
    errors.push("`services` must be an array.");
  } else if (rawServices.length === 0) {
    // A bundle with NO services is refused outright, and this is load-bearing.
    // Apply deactivates anything absent from the bundle — and an empty `notIn`
    // list matches EVERY row in Postgres, so an empty bundle would retire the
    // entire catalog of the target environment: no bookable services, an empty
    // booking page, an empty quote form. That bundle is trivially easy to
    // produce — exporting from an environment whose tables were never seeded
    // (a fresh staging box) yields exactly this. Treat it as corrupt, not as
    // "retire everything".
    errors.push(
      "`services` is empty. A config bundle must contain at least one service — importing this would retire every service in this environment. If you exported this from a fresh environment, seed its catalog first."
    );
  } else {
    const seen = new Set<string>();
    rawServices.forEach((r, i) => {
      const at = `services[${i}]`;
      if (!isObj(r)) return void errors.push(`${at} is not an object.`);

      const value = r.value;
      if (typeof value !== "string" || !value.trim()) {
        return void errors.push(`${at}.value is required.`);
      }
      if (seen.has(value)) {
        return void errors.push(`${at}.value "${value}" is duplicated.`);
      }
      seen.add(value);

      const label = typeof r.label === "string" ? r.label.trim() : "";
      const category = typeof r.category === "string" ? r.category.trim() : "";
      if (!label) errors.push(`${at}.label is required.`);
      if (!category) errors.push(`${at}.category is required.`);

      const pricing = r.pricing as ServicePricingType;
      if (!PRICING_VALUES.includes(pricing)) {
        errors.push(
          `${at}.pricing must be one of ${PRICING_VALUES.join(" | ")} (got ${JSON.stringify(r.pricing)}).`
        );
      }

      const fixedPrice = numOrNull(r.fixedPrice);
      if (fixedPrice != null && (fixedPrice < 0 || fixedPrice > 100000)) {
        errors.push(`${at}.fixedPrice must be between 0 and 100000.`);
      }
      // A fixed-price service with no price would silently bill $0 for labour.
      if (pricing === "fixed" && (fixedPrice == null || fixedPrice <= 0)) {
        errors.push(
          `${at} is pricing="fixed" but has no positive fixedPrice — it would bill $0 of labour.`
        );
      }

      const materialsAmount = numOrNull(r.materialsAmount);
      const materialsType = (r.materialsType ?? null) as MaterialsType | null;
      // > 0: a $0 materials record captures nothing at Stripe yet still credits
      // back at billing time. "No materials charge" = both fields null.
      if (materialsAmount != null && (materialsAmount <= 0 || materialsAmount > 100000)) {
        errors.push(
          `${at}.materialsAmount must be more than 0 (use null for both materialsAmount and materialsType if the service has no materials charge).`
        );
      }
      if (materialsType != null && !MATERIALS_VALUES.includes(materialsType)) {
        errors.push(
          `${at}.materialsType must be one of ${MATERIALS_VALUES.join(" | ")} or null.`
        );
      }
      // Half a materials record is worse than none: an amount with no type would
      // never be captured, and a type with no amount would capture nothing.
      if ((materialsAmount == null) !== (materialsType == null)) {
        errors.push(
          `${at}: materialsAmount and materialsType must be set together, or both be null (null = the service has no materials charge, like AC installation).`
        );
      }

      services.push({
        value,
        label,
        category,
        pricing: PRICING_VALUES.includes(pricing) ? pricing : "hourly",
        priceNote: strOrNull(r.priceNote),
        active: r.active !== false,
        sortOrder: typeof r.sortOrder === "number" ? r.sortOrder : i,
        fixedPrice,
        fixedPricePerUnit: r.fixedPricePerUnit === true,
        materialsAmount,
        materialsType: MATERIALS_VALUES.includes(materialsType as MaterialsType)
          ? materialsType
          : null,
        materialsNote: strOrNull(r.materialsNote),
      });
    });
  }

  // ── painting baselines ──
  const paintingBaselines: PaintingScopeConfig[] = [];
  const rawPainting = raw.paintingBaselines;
  if (!Array.isArray(rawPainting)) {
    errors.push("`paintingBaselines` must be an array.");
  } else {
    const seen = new Set<string>();
    rawPainting.forEach((r, i) => {
      const at = `paintingBaselines[${i}]`;
      if (!isObj(r)) return void errors.push(`${at} is not an object.`);
      const key = r.key;
      if (typeof key !== "string" || !key.trim()) {
        return void errors.push(`${at}.key is required.`);
      }
      if (seen.has(key)) return void errors.push(`${at}.key "${key}" is duplicated.`);
      seen.add(key);

      const min = numOrNull(r.baselineMin);
      const max = numOrNull(r.baselineMax);
      if (min == null || min < 0) errors.push(`${at}.baselineMin must be >= 0.`);
      if (max == null || max < 0) errors.push(`${at}.baselineMax must be >= 0.`);
      if (min != null && max != null && max < min) {
        errors.push(`${at}.baselineMax (${max}) is below baselineMin (${min}).`);
      }

      paintingBaselines.push({
        key,
        label: typeof r.label === "string" ? r.label : key,
        baselineMin: min ?? 0,
        baselineMax: max ?? 0,
        note: strOrNull(r.note),
        active: r.active !== false,
        sortOrder: typeof r.sortOrder === "number" ? r.sortOrder : i,
      });
    });
  }

  // ── equipment checklists ──
  const serviceEquipment: ServiceEquipmentEntry[] = [];
  const rawEquip = raw.serviceEquipment;
  if (rawEquip !== undefined && !Array.isArray(rawEquip)) {
    errors.push("`serviceEquipment` must be an array.");
  } else if (Array.isArray(rawEquip)) {
    rawEquip.forEach((r, i) => {
      const at = `serviceEquipment[${i}]`;
      if (!isObj(r)) return void errors.push(`${at} is not an object.`);
      const serviceType = r.serviceType;
      if (typeof serviceType !== "string" || !serviceType.trim()) {
        return void errors.push(`${at}.serviceType is required.`);
      }
      if (!Array.isArray(r.items) || r.items.some((x) => typeof x !== "string")) {
        return void errors.push(`${at}.items must be an array of strings.`);
      }
      serviceEquipment.push({ serviceType, items: r.items as string[] });
    });
  }

  // ── notification toggles ──
  const notificationSettings: NotificationSettingEntry[] = [];
  const rawNotif = raw.notificationSettings;
  if (rawNotif !== undefined && !Array.isArray(rawNotif)) {
    errors.push("`notificationSettings` must be an array.");
  } else if (Array.isArray(rawNotif)) {
    rawNotif.forEach((r, i) => {
      const at = `notificationSettings[${i}]`;
      if (!isObj(r)) return void errors.push(`${at} is not an object.`);
      const { recipient, key, channel, enabled } = r;
      if (typeof recipient !== "string" || typeof key !== "string" || typeof channel !== "string") {
        return void errors.push(`${at} needs string recipient, key and channel.`);
      }
      if (typeof enabled !== "boolean") {
        return void errors.push(`${at}.enabled must be true or false.`);
      }
      notificationSettings.push({ recipient, key, channel, enabled });
    });
  }

  // ── app settings (incl. every policy value) ──
  const appSettings: AppSettingEntry[] = [];
  const rawSettings = raw.appSettings;
  if (rawSettings !== undefined && !Array.isArray(rawSettings)) {
    errors.push("`appSettings` must be an array.");
  } else if (Array.isArray(rawSettings)) {
    const seen = new Set<string>();
    rawSettings.forEach((r, i) => {
      const at = `appSettings[${i}]`;
      if (!isObj(r)) return void errors.push(`${at} is not an object.`);
      const key = r.key;
      const category = r.category;
      if (typeof key !== "string" || !key.trim()) {
        return void errors.push(`${at}.key is required.`);
      }
      if (seen.has(key)) return void errors.push(`${at}.key "${key}" is duplicated.`);
      seen.add(key);
      if (typeof category !== "string" || !category.trim()) {
        return void errors.push(`${at}.category is required.`);
      }
      // Per-user rows are dropped, not imported — they are keyed by a user id
      // from another environment. Export already omits them; a hand-edited bundle
      // must not be able to smuggle them back in and clobber real users' prefs.
      if (!isEnvironmentConfigKey(key)) return;
      // A policy key must satisfy its own registry rule — the same check the
      // admin editor enforces. An import is not a back door around validation.
      const def = policyDefByKey(key);
      if (def) {
        const problem = validatePolicyValue(def, r.value);
        if (problem) errors.push(`${at}: ${problem}`);
      }
      appSettings.push({ key, category, value: r.value });
    });
  }

  if (errors.length > 0) return { bundle: null, errors };

  return {
    bundle: {
      version: typeof version === "number" ? version : CONFIG_BUNDLE_VERSION,
      exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
      exportedBy: strOrNull(raw.exportedBy),
      services,
      paintingBaselines,
      serviceEquipment,
      notificationSettings,
      appSettings,
    },
    errors: [],
  };
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

// ── Diff (dry run) ─────────────────────────────────────────────────────────

export type ChangeKind = "create" | "update" | "deactivate" | "unchanged";

export interface ConfigChange {
  section: "Services" | "Painting baselines" | "Equipment checklists" | "Notifications" | "Settings";
  id: string;
  kind: ChangeKind;
  /** Human-readable field-level detail, e.g. `materialsAmount: 49 → 59`. */
  details: string[];
}

export interface ConfigDiff {
  changes: ConfigChange[];
  created: number;
  updated: number;
  deactivated: number;
  unchanged: number;
}

function diffFields<T extends Record<string, unknown>>(
  before: T | undefined,
  after: T,
  fields: (keyof T)[]
): string[] {
  if (!before) return [];
  const out: string[] = [];
  for (const f of fields) {
    const a = before[f];
    const b = after[f];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out.push(`${String(f)}: ${fmt(a)} → ${fmt(b)}`);
    }
  }
  return out;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v || "—";
  return JSON.stringify(v);
}

/**
 * What applying this bundle would change. Runs against the LIVE tables and is
 * shown to the admin before anything is written (8.2's "dry-run diff before
 * apply").
 *
 * Import is a MERGE, never a wipe. A service that exists here but not in the
 * bundle is DEACTIVATED, not deleted — deleting it would orphan every job,
 * eligibility row and equipment checklist that points at it by `value`.
 * Deactivation is the reversible form of the same intent (D0.2), and the diff
 * says so out loud.
 */
export async function diffConfigBundle(bundle: ConfigBundle): Promise<ConfigDiff> {
  const [services, painting, equipment, notifications, settings] =
    await Promise.all([
      db.serviceCatalogItem.findMany(),
      db.paintingBaseline.findMany(),
      db.serviceEquipment.findMany(),
      db.notificationSetting.findMany(),
      db.appSetting.findMany(),
    ]);

  const changes: ConfigChange[] = [];

  // Services
  const svcByValue = new Map(
    services.map((s) => [
      s.value,
      {
        label: s.label,
        category: s.category,
        pricing: PRICING_FROM_DB[s.pricing] ?? "hourly",
        priceNote: s.priceNote,
        active: s.active,
        sortOrder: s.sortOrder,
        fixedPrice: s.fixedPrice,
        fixedPricePerUnit: s.fixedPricePerUnit,
        materialsAmount: s.materialsAmount,
        materialsType: s.materialsType ? MATERIALS_FROM_DB[s.materialsType] : null,
        materialsNote: s.materialsNote,
      } as Record<string, unknown>,
    ])
  );
  const bundleServiceValues = new Set(bundle.services.map((s) => s.value));

  for (const s of bundle.services) {
    const before = svcByValue.get(s.value);
    const after = { ...s } as unknown as Record<string, unknown>;
    delete after.value;
    if (!before) {
      changes.push({
        section: "Services",
        id: s.value,
        kind: "create",
        details: [`${s.label} · ${s.category} · ${s.pricing}`],
      });
      continue;
    }
    const details = diffFields(before, after, Object.keys(after));
    changes.push({
      section: "Services",
      id: s.value,
      kind: details.length ? "update" : "unchanged",
      details,
    });
  }
  for (const s of services) {
    if (!bundleServiceValues.has(s.value) && s.active) {
      changes.push({
        section: "Services",
        id: s.value,
        kind: "deactivate",
        details: [
          "Not present in the bundle — will be deactivated, not deleted (jobs, eligibility rows and checklists reference it).",
        ],
      });
    }
  }

  // Painting baselines
  const paintByKey = new Map(
    painting.map((p) => [
      p.key,
      {
        label: p.label,
        baselineMin: p.baselineMin,
        baselineMax: p.baselineMax,
        note: p.note,
        active: p.active,
        sortOrder: p.sortOrder,
      } as Record<string, unknown>,
    ])
  );
  const bundlePaintKeys = new Set(bundle.paintingBaselines.map((p) => p.key));
  for (const p of bundle.paintingBaselines) {
    const before = paintByKey.get(p.key);
    const after = { ...p } as unknown as Record<string, unknown>;
    delete after.key;
    if (!before) {
      changes.push({
        section: "Painting baselines",
        id: p.key,
        kind: "create",
        details: [`${p.label} · $${p.baselineMin}–$${p.baselineMax}`],
      });
      continue;
    }
    const details = diffFields(before, after, Object.keys(after));
    changes.push({
      section: "Painting baselines",
      id: p.key,
      kind: details.length ? "update" : "unchanged",
      details,
    });
  }
  for (const p of painting) {
    if (!bundlePaintKeys.has(p.key) && p.active) {
      changes.push({
        section: "Painting baselines",
        id: p.key,
        kind: "deactivate",
        details: ["Not present in the bundle — will be deactivated, not deleted."],
      });
    }
  }

  // Equipment checklists
  const equipByType = new Map(equipment.map((e) => [e.serviceType, e.items]));
  for (const e of bundle.serviceEquipment) {
    const before = equipByType.get(e.serviceType);
    if (!before) {
      changes.push({
        section: "Equipment checklists",
        id: e.serviceType,
        kind: "create",
        details: [`${e.items.length} item(s)`],
      });
      continue;
    }
    const same = JSON.stringify(before) === JSON.stringify(e.items);
    changes.push({
      section: "Equipment checklists",
      id: e.serviceType,
      kind: same ? "unchanged" : "update",
      details: same ? [] : [`${before.length} item(s) → ${e.items.length} item(s)`],
    });
  }

  // Notification toggles — matched on the natural key the catalog uses.
  const notifByKey = new Map(
    notifications.map((n) => [`${n.recipient}|${n.key}|${n.channel}`, n.enabled])
  );
  for (const n of bundle.notificationSettings) {
    const id = `${n.recipient}|${n.key}|${n.channel}`;
    const before = notifByKey.get(id);
    if (before === undefined) {
      // The catalog is code-declared (src/lib/notifications/catalog.ts). A toggle
      // for an event this deployment doesn't have is skipped, not invented —
      // creating it would put a row in the table that no dispatcher ever reads.
      changes.push({
        section: "Notifications",
        id,
        kind: "unchanged",
        details: ["No such notification in this deployment's catalog — skipped."],
      });
      continue;
    }
    changes.push({
      section: "Notifications",
      id,
      kind: before === n.enabled ? "unchanged" : "update",
      details: before === n.enabled ? [] : [`enabled: ${before} → ${n.enabled}`],
    });
  }

  // App settings (incl. policy)
  const setByKey = new Map(settings.map((s) => [s.key, s.value]));
  for (const s of bundle.appSettings) {
    const before = setByKey.get(s.key);
    const def = policyDefByKey(s.key);
    const name = def ? def.label : s.key;
    if (before === undefined) {
      changes.push({
        section: "Settings",
        id: s.key,
        kind: "create",
        details: [`${name} = ${fmt(s.value)}`],
      });
      continue;
    }
    const same = JSON.stringify(before) === JSON.stringify(s.value);
    changes.push({
      section: "Settings",
      id: s.key,
      kind: same ? "unchanged" : "update",
      details: same ? [] : [`${name}: ${fmt(before)} → ${fmt(s.value)}`],
    });
  }

  return {
    changes,
    created: changes.filter((c) => c.kind === "create").length,
    updated: changes.filter((c) => c.kind === "update").length,
    deactivated: changes.filter((c) => c.kind === "deactivate").length,
    unchanged: changes.filter((c) => c.kind === "unchanged").length,
  };
}

// ── Apply ──────────────────────────────────────────────────────────────────

/**
 * Write the bundle. Wrapped in a transaction: a config set that half-applied —
 * new prices with the old materials types, say — is worse than one that did not
 * apply at all.
 *
 * The caller (importConfig action) validates first, and audit-logs the result.
 */
export async function applyConfigBundle(bundle: ConfigBundle): Promise<ConfigDiff> {
  const diff = await diffConfigBundle(bundle);

  await db.$transaction(
    async (tx) => {
    for (const s of bundle.services) {
      const data = {
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
      };
      await tx.serviceCatalogItem.upsert({
        where: { value: s.value },
        create: { value: s.value, ...data },
        update: data,
      });
    }

    // Merge semantics: absent ⇒ deactivate, never delete (see diffConfigBundle).
    // The length guard is defence in depth: `notIn: []` matches EVERY row, so an
    // empty list here would retire the whole catalog. validateConfigBundle already
    // rejects an empty bundle — this makes the catastrophic case structurally
    // unreachable rather than merely validated against.
    const keepServices = bundle.services.map((s) => s.value);
    if (keepServices.length > 0) {
      await tx.serviceCatalogItem.updateMany({
        where: { value: { notIn: keepServices }, active: true },
        data: { active: false },
      });
    }

    for (const p of bundle.paintingBaselines) {
      const data = {
        label: p.label,
        baselineMin: p.baselineMin,
        baselineMax: p.baselineMax,
        note: p.note,
        active: p.active,
        sortOrder: p.sortOrder,
      };
      await tx.paintingBaseline.upsert({
        where: { key: p.key },
        create: { key: p.key, ...data },
        update: data,
      });
    }
    const keepPainting = bundle.paintingBaselines.map((p) => p.key);
    if (keepPainting.length > 0) {
      await tx.paintingBaseline.updateMany({
        where: { key: { notIn: keepPainting }, active: true },
        data: { active: false },
      });
    }

    for (const e of bundle.serviceEquipment) {
      await tx.serviceEquipment.upsert({
        where: { serviceType: e.serviceType },
        create: { serviceType: e.serviceType, items: e.items },
        update: { items: e.items },
      });
    }

    // Toggles only. The notification CATALOG (which events exist, and on which
    // channels) is code-declared, so we never create a row for an event this
    // deployment doesn't know about — see diffConfigBundle.
    //
    // Batched into two statements, NOT one per entry. The catalog declares ~200
    // events, so the per-entry loop this replaces issued ~200 sequential
    // round-trips inside an interactive transaction whose default timeout is 5s
    // — the import would have died with an opaque P2028 on any hosted database.
    const enabledKeys = bundle.notificationSettings.filter((n) => n.enabled);
    const disabledKeys = bundle.notificationSettings.filter((n) => !n.enabled);
    for (const [group, enabled] of [
      [enabledKeys, true],
      [disabledKeys, false],
    ] as const) {
      if (group.length === 0) continue;
      await tx.notificationSetting.updateMany({
        where: {
          OR: group.map((n) => ({
            recipient: n.recipient as never,
            key: n.key,
            channel: n.channel as never,
          })),
        },
        data: { enabled },
      });
    }

    for (const s of bundle.appSettings) {
      await tx.appSetting.upsert({
        where: { key: s.key },
        create: { key: s.key, category: s.category, value: s.value as never },
        update: { category: s.category, value: s.value as never },
      });
    }
    },
    // ~50 service upserts + painting + checklists + settings is well past the 5s
    // interactive-transaction default on a hosted DB. A config import that half-
    // applies is worse than one that fails, so give it room rather than shrinking
    // the transaction.
    { timeout: 60_000, maxWait: 10_000 }
  );

  return diff;
}

/** Policy keys, for the export/import UI's "what's in here" summary. */
export const POLICY_KEYS = POLICY_SETTINGS.map((d) => d.key);
