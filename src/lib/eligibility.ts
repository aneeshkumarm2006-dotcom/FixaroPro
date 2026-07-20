// Provider service eligibility helpers (SOP §8). Eligibility is admin-controlled
// and read-only to providers. Ineligible jobs must be filtered out server-side,
// never just hidden in the UI.
//
// Rows enter the matrix from three places, all writing isActive rows that the
// reads below honour, and all audit-logged:
//   1. hiring/onboarding  — actions/seedOnboardingEligibility.ts (Fix #9f), the
//                           STARTING point for a newly hired provider;
//   2. admin override     — actions/setEmployeeServiceEligibility.ts, authoritative;
//   3. one-time backfill  — prisma/seed-eligibility.ts, for pre-migration crew.
// (1) and (3) never overwrite an existing row, so (2) always wins.

import { db } from "@/db";
import {
  getEquipmentReadinessFor,
  getEquipmentReadinessMode,
  type EquipmentReadiness,
} from "@/lib/equipment-readiness";

/** Active service types a provider is approved to claim/bid on. */
export async function getEligibleServiceTypes(
  employeeId: string
): Promise<string[]> {
  const rows = await db.employeeServiceEligibility.findMany({
    where: { employeeId, isActive: true },
    select: { serviceType: true },
  });
  return rows.map((r) => r.serviceType);
}

/** Is this provider approved for a given service type? */
export async function isEligibleFor(
  employeeId: string,
  serviceType: string | null | undefined
): Promise<boolean> {
  if (!serviceType) return false;
  const row = await db.employeeServiceEligibility.findUnique({
    where: { employeeId_serviceType: { employeeId, serviceType } },
    select: { isActive: true },
  });
  return !!row?.isActive;
}

/** Provider ids approved (and active) for a given service type. */
export async function getEligibleProviderIdsFor(
  serviceType: string
): Promise<string[]> {
  const rows = await db.employeeServiceEligibility.findMany({
    where: { serviceType, isActive: true },
    select: { employeeId: true },
  });
  return rows.map((r) => r.employeeId);
}

/** A provider to notify about a new job, with what they may be missing for it. */
export interface NotificationTarget {
  employeeId: string;
  readiness: EquipmentReadiness;
}

/**
 * Who gets told about a new job of this service type (SOP §11.1: "Respect
 * provider eligibility, job type, and equipment readiness rules").
 *
 * Three filters, in order:
 *   1. service eligibility — the admin-approved provider matrix (§8);
 *   2. role — field providers only, so admins never receive claim/bid pings;
 *   3. equipment readiness — per the admin's mode (see equipment-readiness.ts).
 *
 * "strict" mode drops providers we can positively prove are short a tracked
 * item. The default "warn" mode drops nobody and instead hands the caller each
 * target's readiness to put in the notification copy — the D6.1 "notify anyway,
 * warn on claim" position. Untracked items never exclude anyone in any mode.
 */
export async function getNotificationTargetsFor(
  serviceType: string
): Promise<NotificationTarget[]> {
  const approvedIds = await getEligibleProviderIdsFor(serviceType);
  if (approvedIds.length === 0) return [];

  const providers = await db.user.findMany({
    where: { id: { in: approvedIds }, role: { in: ["EMPLOYEE", "FIELD_LEAD"] } },
    select: { id: true },
  });
  const providerIds = providers.map((p) => p.id);
  if (providerIds.length === 0) return [];

  const mode = await getEquipmentReadinessMode();
  const clear = (): EquipmentReadiness => ({
    ready: true,
    missing: [],
    untracked: [],
    requiredCount: 0,
  });

  if (mode === "off") {
    return providerIds.map((employeeId) => ({ employeeId, readiness: clear() }));
  }

  const readiness = await getEquipmentReadinessFor(serviceType, providerIds);
  const targets = providerIds.map((employeeId) => ({
    employeeId,
    readiness: readiness.get(employeeId) ?? clear(),
  }));

  if (mode !== "strict") return targets;

  // Belt and braces: equipment readiness must never be able to silence a job
  // entirely. If strict would exclude EVERY eligible provider, that is a
  // misconfigured product catalog, not a genuinely unstaffable job — and the
  // failure mode (a booking nobody is ever told about, with no error anywhere)
  // is far worse than notifying someone who has to top up their kit. Fall back
  // to notifying everyone, loudly.
  const equipped = targets.filter((t) => t.readiness.ready);
  if (equipped.length === 0) {
    console.warn(
      `[eligibility] strict equipment readiness excluded all ${targets.length} eligible provider(s) for ${serviceType}; ` +
        `notifying them anyway. Check the TOOL products and handyman kit assignments.`
    );
    return targets;
  }
  return equipped;
}
