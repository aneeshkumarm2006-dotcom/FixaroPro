"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

const TIERS: Array<{ min: number; multiplier: number; label: string }> = [
  { min: 5.0, multiplier: 1.25, label: "Elite" },
  { min: 4.7, multiplier: 1.18, label: "Top" },
  { min: 4.5, multiplier: 1.13, label: "Excellent" },
  { min: 4.0, multiplier: 1.0, label: "Standard" },
  { min: 0, multiplier: 0.9, label: "Probation" },
];

export function multiplierForRating(avg: number): {
  multiplier: number;
  label: string;
} {
  for (const t of TIERS) {
    if (avg >= t.min) return { multiplier: t.multiplier, label: t.label };
  }
  return { multiplier: 0.9, label: "Probation" };
}

interface RecalculateInput {
  employeeId?: string;
}

export async function recalculateMultiplier(input: RecalculateInput = {}) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { success: false, error: "Not authenticated" };
    }

    const role = (session.user as { role?: string }).role;
    const isAdmin = role === "OWNER" || role === "ADMIN";
    const targetEmployeeId = input.employeeId || session.user.id;

    if (!isAdmin && targetEmployeeId !== session.user.id) {
      return { success: false, error: "Not authorized" };
    }

    const employee = await db.user.findUnique({
      where: { id: targetEmployeeId },
    });
    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const ratings = await db.employeeRating.findMany({
      where: {
        employeeId: targetEmployeeId,
        createdAt: { gte: since },
      },
      select: { rating: true },
    });

    if (ratings.length === 0) {
      return {
        success: true,
        averageRating: null,
        oldMultiplier: employee.payMultiplier,
        newMultiplier: employee.payMultiplier,
        tierLabel: null,
        changed: false,
        ratingCount: 0,
      };
    }

    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const avg = sum / ratings.length;
    const { multiplier, label } = multiplierForRating(avg);

    const oldMultiplier = employee.payMultiplier;
    const changed = Math.abs(oldMultiplier - multiplier) > 0.001;

    if (changed) {
      await db.user.update({
        where: { id: targetEmployeeId },
        data: { payMultiplier: multiplier },
      });

      await db.alert.create({
        data: {
          type: "GENERAL",
          severity: "INFO",
          title: "Pay multiplier updated",
          message: `${employee.name}'s pay multiplier moved from ${oldMultiplier.toFixed(2)}x to ${multiplier.toFixed(2)}x (${label} tier, 30-day avg ${avg.toFixed(2)})`,
          relatedId: targetEmployeeId,
          relatedType: "User",
        },
      });

      revalidatePath("/settings");
      revalidatePath(`/employees/${targetEmployeeId}`);
    }

    return {
      success: true,
      averageRating: avg,
      oldMultiplier,
      newMultiplier: multiplier,
      tierLabel: label,
      changed,
      ratingCount: ratings.length,
    };
  } catch (error) {
    console.error("Error recalculating multiplier:", error);
    return { success: false, error: "Failed to recalculate multiplier" };
  }
}
