"use server";

// Admin editor for the policy / pricing values (SOP §3, stage 8.1).
//
// SOP §2.3 requires every configurable rule to carry a label, default, help
// text, validation rule and audit log. The first four are declared once in
// src/lib/config/policy-registry.ts; this action supplies the fifth and enforces
// the validation SERVER-SIDE — the editor's `min`/`max` inputs are a courtesy,
// not the gate.

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import {
  POLICY_SETTINGS,
  policyDefByKey,
  validatePolicyValue,
  numFromSetting,
  LEGACY_PER_UNIT_KEY,
} from "@/lib/config/policy-registry";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

export interface PolicyUpdate {
  key: string;
  value: number;
}

/**
 * Save a batch of policy values.
 *
 * All-or-nothing: if ANY value fails its rule, nothing is written. A half-applied
 * pricing change (new labour rate, old package price) is a worse state to be in
 * than the one we started from, and the admin gets every error at once instead
 * of one per round-trip.
 */
export async function updatePolicySettings(updates: PolicyUpdate[]) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      return { success: false, error: "Nothing to save" };
    }

    const errors: string[] = [];
    const valid: { key: string; category: string; value: number; label: string }[] = [];

    for (const u of updates) {
      const def = policyDefByKey(u.key);
      if (!def) {
        errors.push(`Unknown setting "${u.key}".`);
        continue;
      }
      const problem = validatePolicyValue(def, u.value);
      if (problem) {
        errors.push(problem);
        continue;
      }
      valid.push({
        key: def.key,
        category: def.category,
        value: u.value,
        label: def.label,
      });
    }

    if (errors.length > 0) return { success: false, error: errors.join(" ") };

    const existing = await db.appSetting.findMany({
      where: { key: { in: valid.map((v) => v.key) } },
    });
    const before = new Map(existing.map((e) => [e.key, numFromSetting(e.value)]));

    await db.$transaction(
      valid.map((v) =>
        db.appSetting.upsert({
          where: { key: v.key },
          create: { key: v.key, category: v.category, value: v.value },
          update: { category: v.category, value: v.value },
        })
      )
    );

    // The legacy `pricing.perUnit` blob is what the Pricing settings tab reads
    // back when it renders. Mirror the two values that live in both places, or
    // that tab would show the old number and an admin saving it would quietly
    // revert this change (the D1.1 dual-write pattern).
    await mirrorLegacyPerUnit(valid);

    const changed = valid.filter((v) => before.get(v.key) !== v.value);
    for (const v of changed) {
      const old = before.get(v.key);
      await logAudit({
        entityType: "AppSetting",
        entityId: v.key,
        action: "POLICY_SETTING_UPDATED",
        description: `${v.label} changed from ${old ?? "default"} to ${v.value}.`,
        field: v.key,
        oldValue: old != null ? String(old) : null,
        newValue: String(v.value),
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
      });
    }

    revalidatePath("/service-catalog");
    revalidatePath("/settings");
    revalidatePath("/book");
    return { success: true, changed: changed.length };
  } catch (error) {
    console.error("updatePolicySettings error:", error);
    return { success: false, error: "Failed to save the settings" };
  }
}

/** Keep `pricing.perUnit.{hourlyRate,threeHourPackage}` in step with the
 *  canonical keys, so the Pricing settings tab never renders a stale number. */
async function mirrorLegacyPerUnit(
  valid: { key: string; value: number }[]
): Promise<void> {
  const mirrored = POLICY_SETTINGS.filter((d) => d.legacyPerUnitProp).map((d) => ({
    def: d,
    update: valid.find((v) => v.key === d.key),
  }));
  const touched = mirrored.filter((m) => m.update);
  if (touched.length === 0) return;

  const row = await db.appSetting.findUnique({ where: { key: LEGACY_PER_UNIT_KEY } });
  const blob =
    row?.value && typeof row.value === "object" && !Array.isArray(row.value)
      ? { ...(row.value as Record<string, unknown>) }
      : {};

  for (const m of touched) {
    blob[m.def.legacyPerUnitProp as string] = m.update!.value;
  }

  await db.appSetting.upsert({
    where: { key: LEGACY_PER_UNIT_KEY },
    create: { key: LEGACY_PER_UNIT_KEY, category: "pricing", value: blob as never },
    update: { value: blob as never },
  });
}

/** Reset every policy value to its Fixaro default. Audit-logged as one event. */
export async function resetPolicySettings() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }

    await db.$transaction(
      POLICY_SETTINGS.map((d) =>
        db.appSetting.upsert({
          where: { key: d.key },
          create: { key: d.key, category: d.category, value: d.default },
          update: { category: d.category, value: d.default },
        })
      )
    );
    await mirrorLegacyPerUnit(
      POLICY_SETTINGS.filter((d) => d.legacyPerUnitProp).map((d) => ({
        key: d.key,
        value: d.default,
      }))
    );

    await logAudit({
      entityType: "AppSetting",
      entityId: "policy",
      action: "POLICY_SETTINGS_RESET",
      description: `All ${POLICY_SETTINGS.length} policy/pricing values reset to Fixaro defaults.`,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidatePath("/service-catalog");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("resetPolicySettings error:", error);
    return { success: false, error: "Failed to reset the settings" };
  }
}
