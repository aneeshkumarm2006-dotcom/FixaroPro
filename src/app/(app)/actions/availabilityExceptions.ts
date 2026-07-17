"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  DATE_KEY_RE,
  dateKeyToStoredDate,
  dateKeyFromStoredDate,
} from "@/lib/availability-exceptions";
import type {
  AvailabilityExceptionDTO,
  AvailabilityEmployeeDTO,
} from "./availabilityExceptions.types";

// One-off blocked dates (time off) on top of the recurring weekly availability.
// EmployeeAvailability is unique per (employee, weekday), so it can never say
// "this specific Monday is off" — vacation / appointment / sick days live here
// instead and always win over the recurring rule.

const MAX_REASON = 200;
/** Sanity window: never block a decade out or years in the past. */
const MAX_PAST_DAYS = 365;
const MAX_FUTURE_DAYS = 730;

/** How far back blocked dates are listed (older ones are history, not useful). */
const EXCEPTION_LOOKBACK_DAYS = 60;
const EXCEPTION_LIMIT = 400;

/**
 * A Pro may only manage their OWN blocked dates. OWNER/ADMIN may manage
 * anyone's. Fails closed. Mirrors exactly how `setAvailability` gates the
 * recurring weekly rules, so the authz model is identical across the tab.
 */
async function authorizeFor(
  employeeId?: string
): Promise<
  { ok: true; employeeId: string } | { ok: false; error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Not authenticated" };

  const role = (session.user as { role?: string }).role;
  const isAdmin = role === "OWNER" || role === "ADMIN";
  const targetId = employeeId || session.user.id;

  if (!isAdmin && targetId !== session.user.id) {
    return { ok: false, error: "Not authorized" };
  }
  return { ok: true, employeeId: targetId };
}

function revalidate(employeeId: string) {
  revalidatePath("/settings");
  revalidatePath("/availability");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/calendar");
  revalidatePath("/jobs/new");
  revalidatePath("/available-jobs");
}

/**
 * Blocked dates for a provider: their own, or (admin/owner) anyone's. Read-only
 * companion to `getAvailability` — kept separate so `getAvailability`'s shape
 * (consumed by the calendar overlay) never changes.
 */
export async function listAvailabilityExceptions(
  employeeId?: string
): Promise<
  | { success: true; exceptions: AvailabilityExceptionDTO[] }
  | { success: false; error: string }
> {
  try {
    const gate = await authorizeFor(employeeId);
    if (!gate.ok) return { success: false, error: gate.error };

    const since = new Date(
      Date.now() - EXCEPTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    );

    const rows = await db.availabilityException.findMany({
      where: { employeeId: gate.employeeId, date: { gte: since } },
      orderBy: { date: "asc" },
      take: EXCEPTION_LIMIT,
    });

    return {
      success: true,
      exceptions: rows.map((e) => ({
        id: e.id,
        employeeId: e.employeeId,
        date: dateKeyFromStoredDate(e.date),
        reason: e.reason,
      })),
    };
  } catch (error) {
    // Never log `reason` (free text — may contain PII); the error object only.
    console.error("Error loading blocked dates:", error);
    return { success: false, error: "Failed to load blocked dates" };
  }
}

/**
 * Block a single date for a provider. Idempotent: re-blocking the same date
 * just refreshes the reason (the row is unique per employee+date), so a double
 * submit or a stale client can never trip the unique constraint.
 */
export async function addAvailabilityException(input: {
  employeeId?: string;
  /** "YYYY-MM-DD" */
  date: string;
  reason?: string | null;
}): Promise<
  | { success: true; exception: AvailabilityExceptionDTO }
  | { success: false; error: string }
> {
  try {
    const gate = await authorizeFor(input?.employeeId);
    if (!gate.ok) return { success: false, error: gate.error };

    if (typeof input?.date !== "string" || !DATE_KEY_RE.test(input.date)) {
      return { success: false, error: "Pick a valid date" };
    }
    const stored = dateKeyToStoredDate(input.date);
    if (!stored) return { success: false, error: "Pick a valid date" };

    const now = Date.now();
    if (stored.getTime() < now - MAX_PAST_DAYS * 86_400_000) {
      return { success: false, error: "That date is too far in the past" };
    }
    if (stored.getTime() > now + MAX_FUTURE_DAYS * 86_400_000) {
      return { success: false, error: "That date is too far in the future" };
    }

    const raw = typeof input.reason === "string" ? input.reason.trim() : "";
    if (raw.length > MAX_REASON) {
      return {
        success: false,
        error: `Reason must be ${MAX_REASON} characters or fewer`,
      };
    }
    const reason = raw || null;

    // The target must be a real user (never resurrect a non-existent account).
    const employee = await db.user.findUnique({
      where: { id: gate.employeeId },
      select: { id: true },
    });
    if (!employee) return { success: false, error: "Provider not found" };

    const row = await db.availabilityException.upsert({
      where: {
        employeeId_date: { employeeId: gate.employeeId, date: stored },
      },
      update: { reason },
      create: { employeeId: gate.employeeId, date: stored, reason },
    });

    revalidate(gate.employeeId);

    return {
      success: true,
      exception: {
        id: row.id,
        employeeId: row.employeeId,
        date: input.date,
        reason: row.reason,
      },
    };
  } catch (error) {
    console.error("Error blocking date:", error);
    return { success: false, error: "Failed to block that date" };
  }
}

/**
 * Unblock a date by id. Authorized against the ROW's owner, not the caller's
 * claim — otherwise a Pro could delete another provider's exception by guessing
 * an id (IDOR). Fails closed.
 */
export async function removeAvailabilityException(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (typeof id !== "string" || !id) {
      return { success: false, error: "Invalid request" };
    }

    // Look the row up first, then authorize against ITS employeeId.
    const row = await db.availabilityException.findUnique({
      where: { id },
      select: { id: true, employeeId: true },
    });
    if (!row) return { success: false, error: "Not found" };

    const gate = await authorizeFor(row.employeeId);
    if (!gate.ok) return { success: false, error: gate.error };

    await db.availabilityException.delete({ where: { id: row.id } });
    revalidate(row.employeeId);
    return { success: true };
  } catch (error) {
    console.error("Error unblocking date:", error);
    return { success: false, error: "Failed to unblock that date" };
  }
}

/**
 * Providers an OWNER/ADMIN may manage availability for. Returns an empty list
 * for everyone else (the tab then simply edits the caller's own schedule), so
 * this never leaks the roster to a Pro.
 */
export async function listAvailabilityEmployees(): Promise<
  AvailabilityEmployeeDTO[]
> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role !== "OWNER" && role !== "ADMIN") return [];

    return await db.user.findMany({
      where: { role: { in: ["EMPLOYEE", "FIELD_LEAD"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } catch (error) {
    console.error("Error loading availability providers:", error);
    return [];
  }
}
