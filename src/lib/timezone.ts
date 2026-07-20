export const BUSINESS_TZ: string =
  process.env.NEXT_PUBLIC_BUSINESS_TZ || "America/Toronto";

export function fmtTime(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: BUSINESS_TZ,
    ...opts,
  });
}

export function fmtDate(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    timeZone: BUSINESS_TZ,
    ...opts,
  });
}

export function fmtDateTime(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    timeZone: BUSINESS_TZ,
    ...opts,
  });
}

// ── Write-side parsing (business timezone → UTC instant) ───────────────────
//
// `new Date("2026-07-20T09:00")` parses in the SERVER's timezone. On a UTC host
// that turns a 9:00 AM Toronto selection into 09:00Z = 5:00 AM Toronto — the job
// lands four/five hours early on every board, email and invoice. Every write path
// that turns a picker's "YYYY-MM-DD" + "HH:mm" into a Date must go through
// `parseBusinessDateTime` so the stored instant means what the admin picked,
// regardless of where the process runs.

/** "YYYY-MM-DD" */
export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** "HH:mm" or "HH:mm:ss", 24-hour. */
export const TIME_KEY_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

/**
 * Offset of `tz` from UTC, in milliseconds, AT a given instant (so it is
 * DST-correct rather than a fixed guess). Positive east of Greenwich.
 */
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - instant.getTime();
}

/**
 * A wall-clock date + time IN the business timezone → the UTC instant it names.
 *
 * @param dateKey "YYYY-MM-DD" as produced by the date pickers
 * @param time    "HH:mm" (or "HH:mm:ss") 24-hour, as produced by the time pickers
 * @param tz      defaults to BUSINESS_TZ
 * @returns the Date, or null when either input is malformed or not a real
 *          calendar date (allow-list validation for the write path — callers
 *          must treat null as "reject", never as "use now").
 *
 * DST edges: an AMBIGUOUS local time (the repeated hour on fall-back) resolves
 * to the FIRST/earlier occurrence; a NONEXISTENT one (the skipped hour on
 * spring-forward, e.g. 02:30) resolves to the equivalent real instant one hour
 * earlier. Neither is reachable from the current slot grid.
 */
export function parseBusinessDateTime(
  dateKey: string | null | undefined,
  time: string | null | undefined,
  tz: string = BUSINESS_TZ
): Date | null {
  if (!dateKey || !time) return null;
  if (!DATE_KEY_RE.test(dateKey) || !TIME_KEY_RE.test(time)) return null;

  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);

  // Reject impossible dates (2026-02-31) that Date.UTC would silently roll over.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.toISOString().slice(0, 10) !== dateKey) return null;

  const naive = Date.UTC(y, m - 1, d, hh, mm, ss || 0);
  // First pass uses the offset at the naive instant; the second pass corrects
  // the case where the naive guess sat on the other side of a DST transition.
  let utc = naive - tzOffsetMs(new Date(naive), tz);
  utc = naive - tzOffsetMs(new Date(utc), tz);
  return new Date(utc);
}

/**
 * Date-only storage for a business-timezone calendar date (Job.jobDate).
 *
 * `new Date("2026-07-20")` is midnight UTC, which renders as 2026-07-19 in
 * Toronto — the job shows up a day early. Convention: midnight UTC OF the
 * business-tz calendar date, read back with `businessDateKey` / `.slice(0,10)`.
 * Mirrors `dateKeyToStoredDate` in src/lib/availability-exceptions.ts (kept
 * separate only to avoid an import cycle — that module imports BUSINESS_TZ
 * from here). Returns null for a malformed or impossible date.
 */
export function businessDateOnly(dateKey: string | null | undefined): Date | null {
  if (!dateKey || !DATE_KEY_RE.test(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.toISOString().slice(0, 10) !== dateKey) return null;
  return dt;
}

/**
 * Format an instant as a `datetime-local` input value ("YYYY-MM-DDTHH:mm") in
 * BUSINESS_TZ rather than the viewer's timezone.
 *
 * Why: a `datetime-local` input is timezone-naive. Building its value from
 * `getHours()` renders the instant in whatever timezone the ADMIN's browser is
 * in, while the rest of the page shows Toronto time — so an ops user outside
 * Toronto would see one time in the page and a different one in the edit box,
 * and "correcting" a clock would silently shift it. Pair this with
 * `parseBusinessDateTime` on the way back so the round-trip is closed.
 */
export function toBusinessDateTimeInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // en-CA yields 24h with "24" for midnight in some engines; normalise to "00".
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** Split a `datetime-local` value and parse it as BUSINESS_TZ wall-clock. */
export function parseBusinessDateTimeInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [dateKey, time] = value.split("T");
  return parseBusinessDateTime(dateKey, time?.slice(0, 5));
}
