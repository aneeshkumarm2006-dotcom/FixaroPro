"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import {
  MAX_PROVIDER_HOURLY_RATE,
  getDefaultProviderHourlyRate,
} from "@/lib/provider-pay";

// Pay rates are money. Restricted to the two roles that already own the
// employee admin surface — OPS_MANAGER can run jobs but not set pay.
const ADMIN_ROLES = ["OWNER", "ADMIN"];

interface SetHourlyRateInput {
  employeeId: string;
  /** null clears the per-provider rate and falls back to the configured default. */
  hourlyRate: number | null;
  reason?: string;
}

/**
 * Admin sets a provider's hourly PAY rate (Fix #3e / #8d).
 *
 * This is the middle tier of the rate resolution used by every payout:
 *   Job.providerHourlyRate → User.hourlyRate (here) → policy default.
 * Per-JOB overrides remain a separate lever (Job.providerHourlyRate /
 * the payout editor); this does not touch them.
 *
 * Every change is audit-logged with old/new/actor/reason, like eligibility.
 */
export async function setEmployeeHourlyRate(input: SetHourlyRateInput) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Not authenticated" };

    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }

    if (typeof input.employeeId !== "string" || !input.employeeId.trim()) {
      return { success: false, error: "Missing employee" };
    }

    // Allow-list the shape: either null (clear) or a finite, in-range number.
    let nextRate: number | null = null;
    if (input.hourlyRate !== null && input.hourlyRate !== undefined) {
      const raw = input.hourlyRate;
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return { success: false, error: "Enter a valid hourly rate." };
      }
      if (raw < 0 || raw > MAX_PROVIDER_HOURLY_RATE) {
        return {
          success: false,
          error: `Hourly rate must be between $0 and $${MAX_PROVIDER_HOURLY_RATE}.`,
        };
      }
      nextRate = Math.round(raw * 100) / 100;
    }

    const employee = await db.user.findUnique({
      where: { id: input.employeeId },
      select: { id: true, role: true, hourlyRate: true },
    });
    if (!employee) return { success: false, error: "Provider not found" };
    if (employee.role === "CLIENT") {
      return { success: false, error: "Clients do not have a pay rate." };
    }

    // Idempotent: setting the same value again is a no-op, not a second audit row.
    if (employee.hourlyRate === nextRate) {
      return { success: true, hourlyRate: nextRate };
    }

    await db.user.update({
      where: { id: employee.id },
      data: { hourlyRate: nextRate },
    });

    await logAudit({
      entityType: "User",
      entityId: employee.id,
      action: "PROVIDER_HOURLY_RATE_CHANGED",
      field: "hourlyRate",
      oldValue: employee.hourlyRate == null ? "default" : String(employee.hourlyRate),
      newValue: nextRate == null ? "default" : String(nextRate),
      reason: input.reason?.trim() || null,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      description: `Provider hourly pay rate changed from ${
        employee.hourlyRate == null ? "the default" : `$${employee.hourlyRate}`
      } to ${nextRate == null ? "the default" : `$${nextRate}`}.`,
    });

    revalidatePath(`/employees/${employee.id}`);
    revalidatePath("/my-pay");
    return { success: true, hourlyRate: nextRate };
  } catch (error) {
    console.error("Error setting provider hourly rate:", error);
    return { success: false, error: "Failed to update hourly rate" };
  }
}

/** The rate currently in effect for a provider, for display in the admin UI. */
export async function getEmployeeHourlyRateInfo(employeeId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false as const, error: "Not authenticated" };
  const role = (session.user as { role?: string }).role;
  if (!role || !ADMIN_ROLES.includes(role)) {
    return { success: false as const, error: "Not authorized" };
  }

  const [employee, defaultRate] = await Promise.all([
    db.user.findUnique({ where: { id: employeeId }, select: { hourlyRate: true } }),
    getDefaultProviderHourlyRate(),
  ]);
  if (!employee) return { success: false as const, error: "Provider not found" };

  return {
    success: true as const,
    hourlyRate: employee.hourlyRate,
    defaultRate,
  };
}
