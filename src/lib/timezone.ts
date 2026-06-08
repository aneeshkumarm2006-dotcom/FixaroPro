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
