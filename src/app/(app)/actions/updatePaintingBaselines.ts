"use server";

// Admin editor for the §7 internal painting cost baselines (SOP §3, stage 8.1).
//
// These are the PRE-surplus company cost baselines. The customer-facing quote
// range is baseline × the `painting.surplusRate` policy value, so an edit here
// moves what every prospective painting customer is quoted — audit-logged.

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

const KEY_RE = /^[a-z][a-z0-9_]{1,49}$/;

export interface PaintingBaselineInput {
  key: string;
  label: string;
  baselineMin: number;
  baselineMax: number;
  note?: string | null;
  active: boolean;
  sortOrder?: number;
}

async function requireAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated" as const };
  const role = (session.user as { role?: string }).role;
  if (!role || !ADMIN_ROLES.includes(role)) {
    return { error: "Not authorized" as const };
  }
  return { session };
}

function validate(input: PaintingBaselineInput): string | null {
  if (!KEY_RE.test(input.key)) {
    return "Scope key must be lower_snake_case (letters, digits, underscores), 2–50 characters.";
  }
  if (!input.label.trim()) return "Label is required.";
  if (!Number.isFinite(input.baselineMin) || input.baselineMin < 0) {
    return "Baseline minimum must be $0 or more.";
  }
  if (!Number.isFinite(input.baselineMax) || input.baselineMax < 0) {
    return "Baseline maximum must be $0 or more.";
  }
  if (input.baselineMax < input.baselineMin) {
    return "Baseline maximum cannot be below the minimum.";
  }
  if (input.baselineMax > 100000) return "Baseline maximum is implausibly large.";
  return null;
}

export async function savePaintingBaseline(input: PaintingBaselineInput) {
  try {
    const guard = await requireAdminSession();
    if ("error" in guard) return { success: false, error: guard.error };
    const { session } = guard;

    const problem = validate(input);
    if (problem) return { success: false, error: problem };

    const existing = await db.paintingBaseline.findUnique({
      where: { key: input.key },
    });

    const data = {
      label: input.label.trim(),
      baselineMin: input.baselineMin,
      baselineMax: input.baselineMax,
      note: input.note?.trim() || null,
      active: input.active,
      sortOrder: input.sortOrder ?? existing?.sortOrder ?? 999,
    };

    await db.paintingBaseline.upsert({
      where: { key: input.key },
      create: { key: input.key, ...data },
      update: data,
    });

    await logAudit({
      entityType: "PaintingBaseline",
      entityId: input.key,
      action: existing ? "PAINTING_BASELINE_UPDATED" : "PAINTING_BASELINE_CREATED",
      description: `Painting baseline "${data.label}" ${existing ? "updated" : "created"}: internal cost $${data.baselineMin}–$${data.baselineMax}${data.active ? "" : " (inactive)"}.`,
      field: "baseline",
      oldValue: existing
        ? `$${existing.baselineMin}–$${existing.baselineMax}${existing.active ? "" : " (inactive)"}`
        : null,
      newValue: `$${data.baselineMin}–$${data.baselineMax}${data.active ? "" : " (inactive)"}`,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidatePath("/service-catalog");
    revalidatePath("/book");
    return { success: true };
  } catch (error) {
    console.error("savePaintingBaseline error:", error);
    return { success: false, error: "Failed to save the baseline" };
  }
}

/**
 * Retire / restore a scope. A toggle rather than a delete: painting jobs store
 * their scope key (`Job.paintingScope`), and deleting the row would leave the
 * admin bid page and the customer's own booking unable to name the scope they
 * were quoted on.
 */
export async function setPaintingBaselineActive(key: string, active: boolean) {
  try {
    const guard = await requireAdminSession();
    if ("error" in guard) return { success: false, error: guard.error };
    const { session } = guard;

    const existing = await db.paintingBaseline.findUnique({ where: { key } });
    if (!existing) return { success: false, error: "Unknown scope" };
    if (existing.active === active) return { success: true };

    await db.paintingBaseline.update({ where: { key }, data: { active } });

    await logAudit({
      entityType: "PaintingBaseline",
      entityId: key,
      action: active ? "PAINTING_BASELINE_ACTIVATED" : "PAINTING_BASELINE_DEACTIVATED",
      description: `Painting scope "${existing.label}" ${active ? "restored to" : "removed from"} the customer quote form. Existing painting jobs on this scope are unaffected.`,
      field: "active",
      oldValue: String(existing.active),
      newValue: String(active),
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidatePath("/service-catalog");
    revalidatePath("/book");
    return { success: true };
  } catch (error) {
    console.error("setPaintingBaselineActive error:", error);
    return { success: false, error: "Failed to update the scope" };
  }
}
