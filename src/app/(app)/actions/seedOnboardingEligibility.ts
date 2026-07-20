"use server";

// Fix #9f — eligibility starts from hiring/onboarding, admin reviews/overrides.
//
// The JobApplication model captures name/email/phone/position/experience/
// coverLetter/resumeUrl. `position` is a ROLE ("Cleaner / Technician", "Field
// Lead", "Operations", …), not a service list, and experience/coverLetter are
// free prose. So there is NO trustworthy per-service signal in an application.
//
// Rather than change the schema or — worse — keyword-match a cover letter into
// work authorisations (a security control derived from free text the APPLICANT
// controls is not a control at all), this seeds from an admin-configured
// "starter" set held in AppSetting["onboarding.starterServices"], validated
// against the live service catalog.
//
// Every seeded row is audit-logged with the same shape as the admin matrix, so
// the override trail is continuous: seed → admin review → admin override.
// Seeding NEVER touches an eligibility row that already exists, so it can never
// silently re-grant something an admin revoked.

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { getRuntimeConfig } from "@/lib/config/service-config";
import { activeServices } from "@/lib/config/types";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

/** AppSetting key holding the admin-configured starter service set. */
const STARTER_KEY = "onboarding.starterServices";

/** Not exported: a "use server" module may only export async functions. */
interface SeedOnboardingEligibilityResult {
  success: boolean;
  error?: string;
  /** Service types newly granted by this call. */
  seeded: string[];
  /** Service types skipped because a row already existed (admin decision wins). */
  skipped: string[];
  /**
   * Always true. A starter set is a DEFAULT, not evidence that this person can
   * do the work — an admin must confirm the matrix either way. The UI surfaces
   * this so a hire never quietly ends up with unreviewed work authorisations.
   */
  needsReview: boolean;
  reviewReason: string;
}

/**
 * Read the configured starter set and narrow it to services that actually exist
 * and are active in the catalog. Allow-list only: an unknown or retired value in
 * the setting is dropped, never granted.
 */
async function resolveStarterServices(): Promise<string[]> {
  let raw: unknown;
  try {
    const row = await db.appSetting.findUnique({ where: { key: STARTER_KEY } });
    raw = row?.value;
  } catch (err) {
    // Fail closed: a settings read failure must not invent eligibility.
    console.error("[onboarding-eligibility] starter set read failed", err);
    return [];
  }
  if (!raw) return [];

  // Accept both {services: string[]} and a bare string[].
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && Array.isArray((raw as { services?: unknown }).services)
      ? (raw as { services: unknown[] }).services
      : [];

  const requested = new Set(
    list.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
  );
  if (requested.size === 0) return [];

  const cfg = await getRuntimeConfig();
  const allowed = new Set(activeServices(cfg).map((s) => s.value));
  const resolved = [...requested].filter((v) => allowed.has(v));

  const dropped = [...requested].filter((v) => !allowed.has(v));
  if (dropped.length) {
    console.warn(
      `[onboarding-eligibility] ${STARTER_KEY} lists ${dropped.length} unknown/retired service(s); ignored: ${dropped.join(", ")}`
    );
  }
  return resolved;
}

/**
 * Seed a freshly hired provider's service eligibility from onboarding.
 *
 * Admin-only. Idempotent — re-running adds nothing and re-logs nothing, because
 * existing rows are skipped rather than overwritten.
 */
export async function seedOnboardingEligibility(input: {
  employeeId: string;
  applicationId?: string;
}): Promise<SeedOnboardingEligibilityResult> {
  const empty = { seeded: [] as string[], skipped: [] as string[] };

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { success: false, error: "Not authenticated", ...empty, needsReview: true, reviewReason: "" };
    }
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized", ...empty, needsReview: true, reviewReason: "" };
    }

    const employeeId = input.employeeId?.trim();
    if (!employeeId) {
      return { success: false, error: "Missing employee", ...empty, needsReview: true, reviewReason: "" };
    }

    // The target must exist and must be a field provider. Never seed work
    // authorisations onto an admin/customer account.
    const employee = await db.user.findUnique({
      where: { id: employeeId },
      select: { id: true, role: true },
    });
    if (!employee || (employee.role !== "EMPLOYEE" && employee.role !== "FIELD_LEAD")) {
      return { success: false, error: "Not a provider account", ...empty, needsReview: true, reviewReason: "" };
    }

    const starter = await resolveStarterServices();

    if (starter.length === 0) {
      const reviewReason =
        `No starter services are configured (AppSetting "${STARTER_KEY}"), so this provider was hired with ` +
        `NO service eligibility and will see no claimable jobs. Set their approved services on the ` +
        `employee's Eligibility tab.`;
      await logAudit({
        entityType: "EmployeeEligibility",
        entityId: employeeId,
        action: "ELIGIBILITY_REVIEW_REQUIRED",
        oldValue: "none",
        newValue: "none",
        reason: "seeded from onboarding",
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        description:
          `Hired provider ${employeeId} with zero seeded eligibility — no starter service set configured.` +
          (input.applicationId ? ` Application ${input.applicationId}.` : ""),
      });
      revalidatePath(`/employees/${employeeId}`);
      return { success: true, ...empty, needsReview: true, reviewReason };
    }

    const existing = await db.employeeServiceEligibility.findMany({
      where: { employeeId, serviceType: { in: starter } },
      select: { serviceType: true },
    });
    const already = new Set(existing.map((r) => r.serviceType));

    const seeded: string[] = [];
    const skipped: string[] = [...already];

    for (const serviceType of starter) {
      if (already.has(serviceType)) continue;
      try {
        // create (not upsert): if a row appeared concurrently, the unique
        // constraint makes this a no-op skip rather than an overwrite.
        await db.employeeServiceEligibility.create({
          data: {
            employeeId,
            serviceType,
            // Consistent with getEligibleServiceTypes(), which reads isActive rows.
            isActive: true,
            approvedBy: session.user.id,
          },
        });
      } catch {
        skipped.push(serviceType);
        continue;
      }

      seeded.push(serviceType);
      await logAudit({
        entityType: "EmployeeEligibility",
        entityId: employeeId,
        action: "ELIGIBILITY_GRANTED",
        field: serviceType,
        oldValue: "none",
        newValue: "true",
        reason: "seeded from onboarding",
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        description:
          `Seeded ${serviceType} eligibility for provider ${employeeId} from the onboarding starter set.` +
          (input.applicationId ? ` Application ${input.applicationId}.` : ""),
      });
    }

    revalidatePath(`/employees/${employeeId}`);
    return {
      success: true,
      seeded,
      skipped,
      needsReview: true,
      reviewReason:
        `Seeded ${seeded.length} starter service(s) from onboarding. The application captured no per-service ` +
        `skills, so these are defaults — confirm or override them on the employee's Eligibility tab.`,
    };
  } catch (err) {
    console.error("seedOnboardingEligibility", err);
    return {
      success: false,
      error: "Failed to seed eligibility",
      ...empty,
      needsReview: true,
      reviewReason: "",
    };
  }
}
