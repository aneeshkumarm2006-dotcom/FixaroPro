"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

interface SetEligibilityInput {
  employeeId: string;
  serviceType: string;
  isActive: boolean;
  reason?: string;
}

// Admin grants or revokes a provider's eligibility for a service (SOP §8/§9).
// Every change is recorded in the audit log (old/new/actor/timestamp/reason).
export async function setEmployeeServiceEligibility(input: SetEligibilityInput) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, error: "Not authorized" };
    }
    if (!input.employeeId || !input.serviceType) {
      return { success: false, error: "Missing employee or service" };
    }

    const existing = await db.employeeServiceEligibility.findUnique({
      where: {
        employeeId_serviceType: {
          employeeId: input.employeeId,
          serviceType: input.serviceType,
        },
      },
      select: { isActive: true },
    });
    const oldValue = existing ? String(existing.isActive) : "none";

    await db.employeeServiceEligibility.upsert({
      where: {
        employeeId_serviceType: {
          employeeId: input.employeeId,
          serviceType: input.serviceType,
        },
      },
      create: {
        employeeId: input.employeeId,
        serviceType: input.serviceType,
        isActive: input.isActive,
        approvedBy: session.user.id,
      },
      update: {
        isActive: input.isActive,
        approvedBy: session.user.id,
        approvedAt: new Date(),
      },
    });

    await logAudit({
      entityType: "EmployeeEligibility",
      entityId: input.employeeId,
      action: input.isActive ? "ELIGIBILITY_GRANTED" : "ELIGIBILITY_REVOKED",
      field: input.serviceType,
      oldValue,
      newValue: String(input.isActive),
      reason: input.reason ?? null,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      description: `${input.isActive ? "Granted" : "Revoked"} ${input.serviceType} eligibility for provider ${input.employeeId}.`,
    });

    revalidatePath(`/employees/${input.employeeId}`);
    return { success: true };
  } catch (error) {
    console.error("Error setting eligibility:", error);
    return { success: false, error: "Failed to update eligibility" };
  }
}
