import { describe, it, expect } from "vitest";
import {
  clockedHours,
  computeProviderJobPay,
  perPersonHours,
  perPersonTip,
  resolveProviderHourlyRate,
  MAX_JOB_CLOCK_HOURS,
  MAX_PROVIDER_HOURLY_RATE,
} from "@/lib/provider-pay";
import { DEFAULT_POLICY } from "@/lib/config/policy-registry";

const h = (iso: string) => new Date(iso);

// ── Rate resolution (Fix #3 / #8) ───────────────────────────────────────────
describe("resolveProviderHourlyRate", () => {
  it("prefers the per-job override, then the provider rate, then the default", () => {
    expect(
      resolveProviderHourlyRate({ jobRate: 40, providerRate: 30, defaultRate: 25 })
    ).toBe(40);
    expect(
      resolveProviderHourlyRate({ jobRate: null, providerRate: 30, defaultRate: 25 })
    ).toBe(30);
    expect(
      resolveProviderHourlyRate({ jobRate: null, providerRate: null, defaultRate: 25 })
    ).toBe(25);
  });

  it("treats 0 as a deliberate rate, not a missing one", () => {
    expect(
      resolveProviderHourlyRate({ jobRate: 0, providerRate: 30, defaultRate: 25 })
    ).toBe(0);
  });

  it("ignores corrupt values and falls through rather than trusting them", () => {
    expect(
      resolveProviderHourlyRate({ jobRate: -5, providerRate: 30, defaultRate: 25 })
    ).toBe(30);
    expect(
      resolveProviderHourlyRate({ jobRate: NaN, providerRate: 30, defaultRate: 25 })
    ).toBe(30);
    expect(
      resolveProviderHourlyRate({
        jobRate: MAX_PROVIDER_HOURLY_RATE + 1,
        providerRate: null,
        defaultRate: 25,
      })
    ).toBe(25);
    // Nothing usable anywhere ⇒ 0 (an under-payment ops can correct), never junk.
    expect(
      resolveProviderHourlyRate({ jobRate: NaN, providerRate: -1, defaultRate: NaN })
    ).toBe(0);
  });
});

// ── Clocked hours ───────────────────────────────────────────────────────────
describe("clockedHours", () => {
  it("measures the clock record in hours", () => {
    expect(
      clockedHours(h("2026-07-20T09:00:00Z"), h("2026-07-20T12:30:00Z"))
    ).toBe(3.5);
  });

  it("returns 0 for an incomplete or inverted clock record", () => {
    expect(clockedHours(null, h("2026-07-20T12:00:00Z"))).toBe(0);
    expect(clockedHours(h("2026-07-20T12:00:00Z"), null)).toBe(0);
    expect(
      clockedHours(h("2026-07-20T12:00:00Z"), h("2026-07-20T09:00:00Z"))
    ).toBe(0);
  });

  it("clamps a runaway clock so one bad record can't mint a payout", () => {
    expect(
      clockedHours(h("2026-07-01T00:00:00Z"), h("2026-07-31T00:00:00Z"))
    ).toBe(MAX_JOB_CLOCK_HOURS);
  });
});

// ── The formula ─────────────────────────────────────────────────────────────
describe("computeProviderJobPay", () => {
  it("pays rate × hours, with tips added on top", () => {
    const pay = computeProviderJobPay({ hourlyRate: 32, hours: 3.5, tipShare: 10 });
    expect(pay.hourlyPay).toBe(112);
    expect(pay.total).toBe(122);
  });

  it("pays nothing for hours when the clock never closed", () => {
    const pay = computeProviderJobPay({ hourlyRate: 32, hours: 0, tipShare: 0 });
    expect(pay.total).toBe(0);
  });

  it("rounds to cents", () => {
    const pay = computeProviderJobPay({ hourlyRate: 33.33, hours: 1.337 });
    expect(pay.hourlyPay).toBe(44.56);
  });

  it("ignores negative tips and negative hours", () => {
    expect(
      computeProviderJobPay({ hourlyRate: 30, hours: -2, tipShare: -5 }).total
    ).toBe(0);
  });
});

// ── Multi-provider split (semantics preserved from the legacy payout code) ──
describe("team split", () => {
  it("splits the job's clocked hours and tips evenly across participants", () => {
    expect(perPersonHours(4, 2)).toBe(2);
    expect(perPersonTip(30, 3)).toBe(10);
  });

  it("pays each participant at their OWN rate for their share of hours", () => {
    const hoursEach = perPersonHours(clockedHours(h("2026-07-20T08:00:00Z"), h("2026-07-20T12:00:00Z")), 2);
    const lead = computeProviderJobPay({ hourlyRate: 40, hours: hoursEach });
    const helper = computeProviderJobPay({ hourlyRate: 22, hours: hoursEach });
    expect(hoursEach).toBe(2);
    expect(lead.total).toBe(80);
    expect(helper.total).toBe(44);
  });

  it("degrades to zero rather than dividing by zero with no participants", () => {
    expect(perPersonHours(4, 0)).toBe(0);
    expect(perPersonTip(30, 0)).toBe(0);
  });
});

// ── Config default ──────────────────────────────────────────────────────────
describe("provider pay policy default", () => {
  it("has its own default, independent of the CLIENT labour rate", () => {
    expect(DEFAULT_POLICY.providerHourlyRate).toBe(25);
    expect(DEFAULT_POLICY.labourRate).toBe(79);
    expect(DEFAULT_POLICY.providerHourlyRate).not.toBe(DEFAULT_POLICY.labourRate);
  });
});
