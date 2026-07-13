import { describe, it, expect } from "vitest";
import { computeLateArrivalRatingCap } from "@/lib/policy";
import {
  resolvePolicy,
  validatePolicyValue,
  policyDefByKey,
  numFromSetting,
  DEFAULT_POLICY,
  POLICY_SETTINGS,
} from "@/lib/config/policy-registry";

// ── Cancellation-fee window (SOP §4/§10) ─────────────────────────────────────
// The window itself is a policy value; the "inside/outside 24h" decision lives
// at the call sites, but the DEFAULTS must match the SOP ($25 within 24h).
describe("cancellation policy defaults", () => {
  it("defaults to a $25 fee inside a 24-hour window", () => {
    expect(DEFAULT_POLICY.cancellationFee).toBe(25);
    expect(DEFAULT_POLICY.cancellationWindowHours).toBe(24);
  });

  it("defaults the labour rate to $79/hr and base deposit to $20", () => {
    expect(DEFAULT_POLICY.labourRate).toBe(79);
    expect(DEFAULT_POLICY.baseBookingDeposit).toBe(20);
    expect(DEFAULT_POLICY.threeHourPackage).toBe(209);
    expect(DEFAULT_POLICY.minBillableHours).toBe(2);
    expect(DEFAULT_POLICY.billingIncrementMinutes).toBe(15);
  });

  it("defaults the painting surplus to 1.35 (35%)", () => {
    expect(DEFAULT_POLICY.paintingSurplusRate).toBe(1.35);
  });
});

// ── Late-arrival rating cap (provider SOP) ───────────────────────────────────
describe("computeLateArrivalRatingCap", () => {
  it("applies no cap inside the grace window", () => {
    expect(computeLateArrivalRatingCap(0)).toBeNull();
    expect(computeLateArrivalRatingCap(9)).toBeNull();
  });
  it("caps at 4 stars at the grace boundary, dropping ½★ per 5 min", () => {
    expect(computeLateArrivalRatingCap(10)).toBe(4);
    expect(computeLateArrivalRatingCap(15)).toBe(3.5);
    expect(computeLateArrivalRatingCap(20)).toBe(3);
  });
  it("floors at 0.5 stars however late", () => {
    expect(computeLateArrivalRatingCap(600)).toBe(0.5);
  });
  it("treats a zero step as a single flat cap, not a divide-by-zero", () => {
    const cap = computeLateArrivalRatingCap(120, {
      latePenaltyGraceMin: 10,
      latePenaltyInitialCap: 4,
      latePenaltyStepMin: 0, // degenerate config must not crash / go infinite
      latePenaltyStepStars: 0.5,
    });
    expect(cap).toBe(4);
  });
});

// ── Policy resolution from AppSetting rows ───────────────────────────────────
describe("resolvePolicy", () => {
  it("returns the defaults when there are no rows", () => {
    expect(resolvePolicy([])).toEqual(DEFAULT_POLICY);
  });

  it("reads a canonical row over the default", () => {
    const p = resolvePolicy([{ key: "pricing.labourRate", value: 95 }]);
    expect(p.labourRate).toBe(95);
    expect(p.cancellationFee).toBe(25); // untouched keys keep defaults
  });

  it("accepts a {value} / {rate}-wrapped setting", () => {
    expect(resolvePolicy([{ key: "pricing.labourRate", value: { value: 88 } }]).labourRate).toBe(88);
    expect(resolvePolicy([{ key: "painting.surplusRate", value: { rate: 1.4 } }]).paintingSurplusRate).toBe(1.4);
  });

  it("IGNORES a row that fails its own validation rule, keeping the default", () => {
    // A corrupt/hand-edited row must never be able to zero the labour rate.
    const p = resolvePolicy([{ key: "pricing.labourRate", value: 0 }]); // min is 1
    expect(p.labourRate).toBe(79);
    const neg = resolvePolicy([{ key: "policy.cancellationFee", value: -100 }]);
    expect(neg.cancellationFee).toBe(25);
  });

  it("falls back to a legacy pricing.perUnit blob for the labour rate", () => {
    const p = resolvePolicy([{ key: "pricing.perUnit", value: { hourlyRate: 82 } }]);
    expect(p.labourRate).toBe(82); // canonical row absent → legacy prop used
  });

  it("prefers the canonical row over the legacy blob", () => {
    const p = resolvePolicy([
      { key: "pricing.labourRate", value: 100 },
      { key: "pricing.perUnit", value: { hourlyRate: 82 } },
    ]);
    expect(p.labourRate).toBe(100);
  });
});

describe("validatePolicyValue", () => {
  const rateDef = policyDefByKey("pricing.labourRate")!;
  const windowDef = policyDefByKey("policy.cancellationWindowHours")!;

  it("rejects non-numbers and out-of-range values", () => {
    expect(validatePolicyValue(rateDef, "79" as unknown)).toMatch(/must be a number/);
    expect(validatePolicyValue(rateDef, 0)).toMatch(/between/);
    expect(validatePolicyValue(rateDef, 99999)).toMatch(/between/);
  });
  it("accepts an in-range value", () => {
    expect(validatePolicyValue(rateDef, 79)).toBeNull();
  });
  it("rejects a fractional value for an integer field", () => {
    expect(validatePolicyValue(windowDef, 24.5)).toMatch(/whole number/);
    expect(validatePolicyValue(windowDef, 24)).toBeNull();
  });
});

describe("policy registry integrity", () => {
  it("every policy field has a default that passes its own validation", () => {
    for (const def of POLICY_SETTINGS) {
      expect(validatePolicyValue(def, def.default), `${def.key} default`).toBeNull();
    }
  });
  it("has unique AppSetting keys", () => {
    const keys = POLICY_SETTINGS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("numFromSetting coerces bare numbers and wrapped shapes", () => {
    expect(numFromSetting(5)).toBe(5);
    expect(numFromSetting({ value: 5 })).toBe(5);
    expect(numFromSetting({ rate: 1.35 })).toBe(1.35);
    expect(numFromSetting("nope")).toBeNull();
    expect(numFromSetting(NaN)).toBeNull();
  });
});
