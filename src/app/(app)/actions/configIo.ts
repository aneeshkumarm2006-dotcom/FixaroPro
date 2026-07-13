"use server";

// Config export / import per environment (SOP §3, stage 8.2).
//
// §3's acceptance criterion: "All settings and workflows in this document are
// represented in the database/config layer and can be exported/imported by
// environment."
//
// The flow is deliberately three steps, not one:
//   1. exportConfig()        — download the current environment's config as JSON
//   2. previewConfigImport() — validate + DRY-RUN DIFF; nothing is written
//   3. applyConfigImport()   — apply in a transaction, audit-logged
//
// Step 2 exists because importing config is a money-moving act: a bundle from
// staging can carry a different labour rate, materials deposits and cancellation
// fee. An admin must see exactly what will change before it changes.

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import {
  exportConfigBundle,
  validateConfigBundle,
  diffConfigBundle,
  applyConfigBundle,
  type ConfigBundle,
  type ConfigDiff,
} from "@/lib/config/config-io";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

type AdminGuard =
  | { ok: false; error: string }
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>> };

async function requireAdminSession(): Promise<AdminGuard> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Not authenticated" };
  const role = (session.user as { role?: string }).role;
  if (!role || !ADMIN_ROLES.includes(role)) {
    return { ok: false, error: "Not authorized" };
  }
  return { ok: true, session };
}

/** Serialize the whole config set to a JSON string the admin can download. */
export async function exportConfig(): Promise<
  { success: true; json: string; filename: string } | { success: false; error: string }
> {
  try {
    const guard = await requireAdminSession();
    if (!guard.ok) return { success: false, error: guard.error };
    const { session } = guard;

    const now = new Date();
    const bundle = await exportConfigBundle(session.user.email ?? null, now);

    await logAudit({
      entityType: "Config",
      entityId: "bundle",
      action: "CONFIG_EXPORTED",
      description: `Config exported: ${bundle.services.length} service(s), ${bundle.paintingBaselines.length} painting baseline(s), ${bundle.serviceEquipment.length} equipment checklist(s), ${bundle.notificationSettings.length} notification toggle(s), ${bundle.appSettings.length} setting(s).`,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    const stamp = now.toISOString().slice(0, 10);
    return {
      success: true,
      json: JSON.stringify(bundle, null, 2),
      filename: `fixaro-config-${stamp}.json`,
    };
  } catch (error) {
    console.error("exportConfig error:", error);
    return { success: false, error: "Failed to export the config" };
  }
}

export interface ImportPreview {
  success: true;
  diff: ConfigDiff;
  summary: {
    exportedAt: string;
    exportedBy: string | null;
    services: number;
    paintingBaselines: number;
    serviceEquipment: number;
    notificationSettings: number;
    appSettings: number;
  };
}

/**
 * Validate a candidate bundle and show what applying it WOULD do. Writes nothing.
 */
export async function previewConfigImport(
  json: string
): Promise<ImportPreview | { success: false; errors: string[] }> {
  try {
    const guard = await requireAdminSession();
    if (!guard.ok) return { success: false, errors: [guard.error] };

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { success: false, errors: ["That file is not valid JSON."] };
    }

    const { bundle, errors } = validateConfigBundle(parsed);
    if (!bundle) return { success: false, errors };

    const diff = await diffConfigBundle(bundle);

    return {
      success: true,
      diff,
      summary: {
        exportedAt: bundle.exportedAt,
        exportedBy: bundle.exportedBy,
        services: bundle.services.length,
        paintingBaselines: bundle.paintingBaselines.length,
        serviceEquipment: bundle.serviceEquipment.length,
        notificationSettings: bundle.notificationSettings.length,
        appSettings: bundle.appSettings.length,
      },
    };
  } catch (error) {
    console.error("previewConfigImport error:", error);
    return { success: false, errors: ["Failed to read the config file"] };
  }
}

/**
 * Apply a bundle.
 *
 * Re-validates and re-diffs from the raw JSON rather than trusting a bundle the
 * client hands back: the preview may be minutes old, the client is not a trusted
 * source of parsed config, and the DB may have moved underneath it. The diff
 * written to the audit log is the one that actually applied.
 */
export async function applyConfigImport(
  json: string
): Promise<
  | { success: true; diff: ConfigDiff }
  | { success: false; errors: string[] }
> {
  try {
    const guard = await requireAdminSession();
    if (!guard.ok) return { success: false, errors: [guard.error] };
    const { session } = guard;

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { success: false, errors: ["That file is not valid JSON."] };
    }

    const { bundle, errors } = validateConfigBundle(parsed);
    if (!bundle) return { success: false, errors };

    const diff = await applyConfigBundle(bundle as ConfigBundle);

    await logAudit({
      entityType: "Config",
      entityId: "bundle",
      action: "CONFIG_IMPORTED",
      description:
        `Config imported (exported ${bundle.exportedAt || "unknown"} by ${bundle.exportedBy ?? "unknown"}): ` +
        `${diff.created} created, ${diff.updated} updated, ${diff.deactivated} deactivated, ${diff.unchanged} unchanged.`,
      field: "config",
      newValue: JSON.stringify(
        diff.changes
          .filter((c) => c.kind !== "unchanged")
          .map((c) => `${c.section}/${c.id}: ${c.kind}${c.details.length ? ` — ${c.details.join("; ")}` : ""}`)
      ).slice(0, 8000),
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidatePath("/service-catalog");
    revalidatePath("/equipment-checklists");
    revalidatePath("/settings");
    revalidatePath("/book");
    revalidatePath("/quote");
    return { success: true, diff };
  } catch (error) {
    console.error("applyConfigImport error:", error);
    return { success: false, errors: ["Failed to apply the config"] };
  }
}
