"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

type State = {
  message: string;
  error: string;
};

export async function updateEmployee(
  employeeId: string,
  prevState: State,
  formData: FormData
): Promise<State> {
  const session = await auth.api.getSession({ headers: await headers() });
  const actorRole = (session?.user as { role?: string } | undefined)?.role;
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") {
    return { message: "", error: "Not authorized." };
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const role = formData.get("role") as string;

  // Validate required fields
  if (!name || !email || !role) {
    return {
      message: "",
      error: "Please fill in all required fields.",
    };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      message: "",
      error: "Please enter a valid email address.",
    };
  }

  try {
    // Check if email already exists (excluding current user)
    const existingUser = await db.user.findFirst({
      where: {
        email,
        NOT: {
          id: employeeId,
        },
      },
    });

    if (existingUser) {
      return {
        message: "",
        error: "An employee with this email already exists.",
      };
    }

    // Snapshot the prior role so a permission change is auditable.
    const before = await db.user.findUnique({
      where: { id: employeeId },
      select: { role: true },
    });

    // Update the user
    await db.user.update({
      where: { id: employeeId },
      data: {
        name,
        email,
        phone: phone || null,
        role: role as "OWNER" | "ADMIN" | "EMPLOYEE",
      },
    });

    // Audit a ROLE/permission change (SOP §9/§12 — permission changes are
    // high-impact). Only fired when the role actually changed, with old→new.
    if (before && before.role !== role) {
      logAudit({
        entityType: "User",
        entityId: employeeId,
        action: "USER_ROLE_CHANGED",
        field: "role",
        oldValue: before.role ?? null,
        newValue: role,
        actorId: session!.user.id,
        actorEmail: session!.user.email ?? null,
        description: `Role for ${name} changed ${before.role} → ${role}.`,
      });
    }

    revalidatePath("/employees");
    return {
      message: "Employee updated successfully!",
      error: "",
    };
  } catch (error) {
    console.error("Error updating employee:", error);
    return {
      message: "",
      error: "Failed to update employee. Please try again.",
    };
  }
}

