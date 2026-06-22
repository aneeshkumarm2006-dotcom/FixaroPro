// Provider service eligibility helpers (SOP §8). Eligibility is admin-controlled
// and read-only to providers. Ineligible jobs must be filtered out server-side,
// never just hidden in the UI.

import { db } from "@/db";

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
