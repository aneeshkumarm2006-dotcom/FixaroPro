/**
 * Provider pay math — the single source of truth for "what does the crew earn
 * on this job?" (Fix #3 / #8).
 *
 * Provider pay is HOURLY: `resolved hourly rate × clocked hours`, plus the
 * provider's share of the tip. It is NOT derived from what the customer paid.
 *
 * This replaces the legacy formula
 *   `job.employeePay × job.payRateMultiplier × user.payMultiplier + tips`
 * which paid a flat per-job figure scaled by two multipliers and ignored the
 * clock entirely. `payRateMultiplier` / `payMultiplier` still exist on the
 * schema (nothing is dropped) but MUST NOT be read by the pay path any more.
 *
 * Rate resolution order, highest priority first:
 *   1. `Job.providerHourlyRate`  — per-job override set by ops
 *   2. `User.hourlyRate`         — the provider's own negotiated rate
 *   3. `policy.providerHourlyRate` (AppSetting `pay.providerHourlyRate`)
 *
 * NB the configured default is the PROVIDER PAY rate, not `pricing.labourRate`
 * ($79) — that is what the CLIENT is billed per hour and must never be used as
 * crew pay.
 */

import { getRuntimeConfig } from "@/lib/config/service-config";

/** Sanity ceiling. A rate above this is treated as corrupt data and ignored in
 *  favour of the next candidate, so one bad row can't mint a payout. */
export const MAX_PROVIDER_HOURLY_RATE = 1000;

/** Nothing on earth is a legitimate 200-hour single job; clamp so a broken
 *  clock record (or a hand-edited timestamp) can't create a runaway payout. */
export const MAX_JOB_CLOCK_HOURS = 24;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isUsableRate(v: number | null | undefined): v is number {
  return (
    typeof v === "number" &&
    Number.isFinite(v) &&
    v >= 0 &&
    v <= MAX_PROVIDER_HOURLY_RATE
  );
}

/** The configured fallback pay rate (admin-editable in Service Catalog → Policy). */
export async function getDefaultProviderHourlyRate(): Promise<number> {
  const cfg = await getRuntimeConfig();
  const rate = cfg.policy.providerHourlyRate;
  return isUsableRate(rate) ? rate : 0;
}

/**
 * Resolve the hourly rate to pay for one provider on one job.
 * Fails CLOSED on nonsense input: an unusable value at any level falls through
 * to the next candidate rather than being trusted, and the final fallback is 0
 * (an under-payment an admin can correct) rather than an arbitrary number.
 */
export function resolveProviderHourlyRate(input: {
  jobRate?: number | null;
  providerRate?: number | null;
  defaultRate: number;
}): number {
  if (isUsableRate(input.jobRate)) return input.jobRate;
  if (isUsableRate(input.providerRate)) return input.providerRate;
  if (isUsableRate(input.defaultRate)) return input.defaultRate;
  return 0;
}

/** Clocked duration in hours, clamped to [0, MAX_JOB_CLOCK_HOURS]. Returns 0
 *  when the clock record is incomplete — an unclocked job earns no hourly pay
 *  until ops corrects the record (adjustClockTimes then moves the money). */
export function clockedHours(
  clockIn: Date | string | null | undefined,
  clockOut: Date | string | null | undefined
): number {
  if (!clockIn || !clockOut) return 0;
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const hours = (end - start) / 3_600_000;
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.min(hours, MAX_JOB_CLOCK_HOURS);
}

/**
 * Split a job's clocked hours across everyone who worked it.
 *
 * This preserves the pre-existing split semantics: a job carries ONE clock
 * record (job.clockInTime/clockOutTime), and that duration was — and still is —
 * divided evenly across participants, so a 4h two-person job credits 2h each.
 * The change is what happens next: each person's hours are now multiplied by
 * THEIR OWN resolved rate instead of a shared flat pay figure being multiplied
 * by two multipliers.
 */
export function perPersonHours(totalHours: number, participants: number): number {
  if (participants <= 0) return 0;
  return totalHours / participants;
}

/** Even tip split across the lead + assigned crew, as before. */
export function perPersonTip(totalTip: number, participants: number): number {
  if (participants <= 0 || !Number.isFinite(totalTip) || totalTip <= 0) return 0;
  return totalTip / participants;
}

export interface ProviderJobPay {
  hourlyRate: number;
  hours: number;
  hourlyPay: number;
  tipShare: number;
  total: number;
}

/** rate × hours (+ tip share). The one formula. */
export function computeProviderJobPay(input: {
  hourlyRate: number;
  hours: number;
  tipShare?: number;
}): ProviderJobPay {
  const hourlyRate = isUsableRate(input.hourlyRate) ? input.hourlyRate : 0;
  const hours =
    Number.isFinite(input.hours) && input.hours > 0
      ? Math.min(input.hours, MAX_JOB_CLOCK_HOURS)
      : 0;
  const tipShare =
    Number.isFinite(input.tipShare ?? 0) && (input.tipShare ?? 0) > 0
      ? (input.tipShare as number)
      : 0;
  const hourlyPay = round2(hourlyRate * hours);
  return {
    hourlyRate,
    hours,
    hourlyPay,
    tipShare: round2(tipShare),
    total: round2(hourlyPay + tipShare),
  };
}
