// Shared test fixtures for the money-math unit tests (SOP §12 QA — Stage 9.1).
//
// Everything here is built from the SAME seed defaults the app falls back to
// when the config tables are empty (DEFAULT_RUNTIME_CONFIG), so the numbers the
// tests assert against are the numbers a fresh, unseeded environment actually
// serves — not a parallel set of magic constants.

import { DEFAULT_RUNTIME_CONFIG } from "@/lib/config/defaults";
import type { RuntimeConfig } from "@/lib/config/types";
import type { BillingConfig, JobBillingLike } from "@/lib/billing";

/** The default runtime config (seed constants), for tests that price/bill. */
export const CFG: RuntimeConfig = DEFAULT_RUNTIME_CONFIG;

/**
 * Build a BillingConfig from a RuntimeConfig — the exact field mapping
 * getBillingConfig() performs, minus the async DB read. Kept in lockstep with
 * src/lib/billing.ts::getBillingConfig so tests bill against real policy values.
 */
export function billingConfigFrom(cfg: RuntimeConfig = CFG): BillingConfig {
  return {
    labourRate: cfg.policy.labourRate,
    incrementMinutes: cfg.policy.billingIncrementMinutes,
    minBillableHours: cfg.policy.minBillableHours,
    threeHourPackagePrice: cfg.policy.threeHourPackage,
    cancellationFee: cfg.policy.cancellationFee,
    baseBookingDeposit: cfg.policy.baseBookingDeposit,
    config: cfg,
  };
}

/** Default BillingConfig (labour $79, 15-min increment, 2h min, $209 package,
 *  $25 cancellation, $20 base deposit — the seed defaults). */
export const BILLING: BillingConfig = billingConfigFrom();

/** A UTC clock pair `hours` apart, for deterministic billable-hour tests. */
export function clock(hours: number): { clockInTime: Date; clockOutTime: Date } {
  const clockInTime = new Date("2026-07-13T09:00:00.000Z");
  const clockOutTime = new Date(clockInTime.getTime() + hours * 3600_000);
  return { clockInTime, clockOutTime };
}

/**
 * A JobBillingLike with sensible, overridable defaults. Defaults describe a
 * fully-clocked hourly job with a captured base deposit and no materials.
 */
export function job(over: Partial<JobBillingLike> = {}): JobBillingLike {
  const base: JobBillingLike = {
    jobType: "TV_MOUNTING", // hourly service in the catalog
    price: null,
    discountAmount: null,
    subtotalAmount: 0,
    gstAmount: 0,
    qstAmount: 0,
    basePriceAmount: null,
    bookedSubtotalAmount: null,
    clockInTime: null,
    clockOutTime: null,
    depositPaid: false,
    materialsAmount: null,
    materialsType: null,
    materialsAppliedAmount: null,
    materialsRefundedAt: null,
    cancellationFeeChargedAt: null,
    refundedAmount: 0,
  };
  return { ...base, ...over };
}
