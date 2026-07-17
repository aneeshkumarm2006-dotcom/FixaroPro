// One-off blocked dates ("time off") that layer on top of a provider's
// recurring weekly availability. A blocked date always wins: the Pro is
// UNAVAILABLE for that whole calendar day regardless of their weekly schedule.
//
// PURE module — no Prisma client, no `db`, no `next/headers` — so it can be
// imported by server actions and, if ever needed, client components. All DB
// reads/writes live in the server actions that import this.
//
// STORAGE CONVENTION for AvailabilityException.date: midnight UTC of the
// business-timezone calendar date (e.g. 2026-07-13T00:00:00.000Z). Date-only,
// DST-proof, and round-trips through these helpers exactly. Every writer must
// go through `dateKeyToStoredDate` so `@@unique([employeeId, date])` actually
// de-duplicates.

import { BUSINESS_TZ } from "@/lib/timezone";

/** "YYYY-MM-DD" */
export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Inverse of `dateKeyToStoredDate`: stored Date → "YYYY-MM-DD". */
export function dateKeyFromStoredDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * "YYYY-MM-DD" → midnight-UTC Date for storage. Returns null for anything that
 * is not a real calendar date (e.g. 2026-02-31, which JS would silently roll
 * over into March). Allow-list validation for the write path.
 */
export function dateKeyToStoredDate(dateKey: string): Date | null {
  if (!DATE_KEY_RE.test(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Rejects impossible dates that Date.UTC would have rolled over.
  if (dateKeyFromStoredDate(dt) !== dateKey) return null;
  return dt;
}

/** Normalize any stored/serialized exception date back to "YYYY-MM-DD". */
export function exceptionDateKey(date: string | Date): string {
  if (typeof date === "string") {
    return DATE_KEY_RE.test(date) ? date : date.slice(0, 10);
  }
  return dateKeyFromStoredDate(date);
}

/**
 * Business-timezone calendar date ("YYYY-MM-DD") for an instant — the key we
 * compare a job's start against when deciding whether it lands on a blocked
 * date. Uses the SAME timezone the blocked date was stored in, so a job at
 * 11pm local doesn't leak onto the next UTC day.
 */
export function businessDateKey(instant: Date): string {
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
