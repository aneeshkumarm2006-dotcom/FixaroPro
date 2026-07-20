/**
 * Crew-facing pay breakdown (Fix #3d).
 *
 * This payload is rendered to PROVIDERS. It deliberately carries NO client
 * pricing — no base price, no add-on prices, no discount/parking line, no
 * client total. What the customer paid is not the crew's business, and leaking
 * it is what this fix removes.
 *
 * Provider pay is hourly: hourlyRate × hours (+ tip share).
 */
export type PayBreakdown = {
  jobId: string;
  clientName: string;
  /** Resolved hourly PAY rate: job override → provider rate → configured default. */
  hourlyRate: number;
  /** Where that rate came from, so a job-specific rate is visible as such. */
  hourlyRateSource: "JOB_OVERRIDE" | "PROVIDER_RATE" | "DEFAULT";
  /** This provider's share of the job's clocked hours. */
  hours: number;
  /** Total clocked hours on the job, before the team split. */
  totalJobHours: number;
  /** True when the job has no complete clock record yet (hours are still 0). */
  clockIncomplete: boolean;
  /** hourlyRate × hours. */
  hourlyPay: number;
  totalTip: number;
  teamSize: number;
  tipShare: number;
  /** hourlyPay + tipShare. */
  totalEmployeePay: number;
  isLead: boolean;
};
