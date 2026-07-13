"use client";

import { useMemo, useState, useTransition } from "react";
import { bulkChargeJobs } from "../actions/bulkChargeJobs";

interface RowBilling {
  pricingModel: "hourly" | "fixed" | "quote";
  hoursWorked: number | null;
  billableHours: number | null;
  labourRate: number;
  labourFromClock: number | null;
  materialsAmount: number;
  materialsType: string | null;
  materialsRefunded: boolean;
  depositCollected: number;
  cancellationFee: number;
  discount: number;
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
  bookedTotal: number;
  refunded: number;
  amountDueNow: number;
  clockMissing: boolean;
  baseMissing: boolean;
}

interface BulkJob {
  id: string;
  jobNumber: number;
  clientName: string;
  jobType: string | null;
  completedAt: string | null;
  hasCardOnFile: boolean;
  giftCardBalance: number;
  clockInAt: string | null;
  clockOutAt: string | null;
  billing: RowBilling;
  grossAmount: number;
  depositCredit: number;
  // Amount chargeJob will actually collect (card + gift card credit).
  amountDue: number;
}

interface Props {
  jobs: BulkJob[];
}

type BatchResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  totalCharged: number;
  results: Array<{
    jobId: string;
    jobNumber: number;
    clientName: string;
    success: boolean;
    amount?: number;
    error?: string;
  }>;
};

function fmtAmount(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function centsEqual(a: number, b: number) {
  return Math.round(a * 100) === Math.round(b * 100);
}

/** Can chargeJob actually settle this row? Mirrors its guards: gross must be
 * positive, and a saved card is only required if the deposit + gift card
 * credit don't already cover the balance. */
function chargeability(j: BulkJob) {
  if (j.grossAmount <= 0) return { ok: false, reason: "Invalid amount" };
  // SOP §10 (guard 1.5) — an hourly job can't be priced without a clock-out.
  if (j.billing.pricingModel === "hourly" && j.billing.clockMissing) {
    return { ok: false, reason: "Clock out required" };
  }
  const afterGiftCard = Math.max(
    0,
    j.amountDue - Math.min(j.giftCardBalance, j.amountDue)
  );
  if (afterGiftCard > 0 && !j.hasCardOnFile) {
    return { ok: false, reason: "No card on file" };
  }
  return { ok: true as const, reason: null };
}

export default function BulkChargeClient({ jobs }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<BatchResult | null>(null);
  const [pending, startTransition] = useTransition();

  const chargeable = useMemo(
    () => jobs.filter((j) => chargeability(j).ok),
    [jobs]
  );
  // Select-all covers every chargeable row. Hourly jobs with no clock-out are
  // already excluded (chargeability blocks them); fixed/quote jobs need no clock.
  const selectAllPool = chargeable;
  const allSelected =
    selectAllPool.length > 0 &&
    selectAllPool.every((j) => selected.has(j.id)) &&
    selected.size === selectAllPool.length;
  const selectedTotal = useMemo(
    () =>
      jobs
        .filter((j) => selected.has(j.id))
        .reduce((sum, j) => sum + j.amountDue, 0),
    [jobs, selected]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectAllPool.map((j) => j.id)));
  }

  function runBatch() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const result = await bulkChargeJobs(Array.from(selected));
      if (result.success) {
        setBatch({
          attempted: result.attempted ?? 0,
          succeeded: result.succeeded ?? 0,
          failed: result.failed ?? 0,
          totalCharged: result.totalCharged ?? 0,
          results: result.results ?? [],
        });
        setSelected(new Set());
      } else {
        alert(result.error ?? "Bulk charge failed");
      }
    });
  }

  return (
    <div className="cl-page-wrap">
      <div className="cl-page-head">
        <div>
          <h1 className="cl-page-title">Bulk charge</h1>
          <p className="cl-page-sub">
            All completed jobs that are unpaid and have a card on file. Review
            each job&apos;s itemized breakdown (SOP §10.3), select the rows you
            want to bill and run them in one batch.
          </p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div
          style={{
            marginTop: 16,
            padding: 32,
            textAlign: "center",
            border: "1px solid var(--primary-10)",
            borderRadius: 14,
            background: "#fff",
            fontSize: 14,
            color: "var(--primary-60)",
          }}>
          Nothing to charge. All completed jobs are either paid or marked as cash.
        </div>
      ) : (
        <>
          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}>
            <div
              style={{
                fontSize: 13,
                color: "var(--primary-70)",
                fontWeight: 600,
              }}>
              {selected.size} selected · {fmtAmount(selectedTotal)} total
            </div>
            <button
              type="button"
              disabled={selected.size === 0 || pending}
              onClick={runBatch}
              style={{
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 700,
                background:
                  selected.size === 0 || pending
                    ? "var(--primary-20)"
                    : "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor:
                  selected.size === 0 || pending ? "default" : "pointer",
              }}>
              {pending
                ? "Charging…"
                : `Charge ${selected.size} job${selected.size === 1 ? "" : "s"} · ${fmtAmount(selectedTotal)}`}
            </button>
            <div style={{ fontSize: 12, color: "var(--primary-50)" }}>
              Select-all skips jobs with missing clock data.
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              background: "#fff",
              border: "1px solid var(--primary-10)",
              borderRadius: 14,
              overflow: "hidden",
            }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    background: "var(--primary-5)",
                    textAlign: "left",
                  }}>
                  <th style={th}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all eligible"
                    />
                  </th>
                  <th style={th}>Job</th>
                  <th style={th}>Client</th>
                  <th style={th}>Service</th>
                  <th style={th}>Completed</th>
                  <th style={th}>Hours</th>
                  <th style={{ ...th, textAlign: "right" }}>Amount due</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const eligibility = chargeability(j);
                  const disabled = !eligibility.ok;
                  // Only hourly jobs need a clock record to be priced.
                  const missingClock =
                    j.billing.pricingModel === "hourly" && j.billing.clockMissing;
                  const reviewMismatch = !centsEqual(
                    j.billing.amountDueNow,
                    j.amountDue
                  );
                  const isOpen = expanded.has(j.id);
                  return (
                    <BulkRow
                      key={j.id}
                      job={j}
                      disabled={disabled}
                      disabledReason={eligibility.reason}
                      missingClock={missingClock}
                      reviewMismatch={reviewMismatch}
                      isOpen={isOpen}
                      isSelected={selected.has(j.id)}
                      onToggle={() => toggle(j.id)}
                      onToggleExpanded={() => toggleExpanded(j.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {batch && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: "#fff",
            border: "1px solid var(--primary-10)",
            borderRadius: 14,
          }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Batch complete
          </h3>
          <p style={{ marginTop: 6, fontSize: 13, color: "var(--primary-70)" }}>
            Charged {fmtAmount(batch.totalCharged)} across {batch.succeeded} of{" "}
            {batch.attempted} jobs.{" "}
            {batch.failed > 0 && (
              <span style={{ color: "#dc2626", fontWeight: 600 }}>
                {batch.failed} failed.
              </span>
            )}
          </p>
          <ul style={{ marginTop: 12, fontSize: 13, paddingLeft: 18 }}>
            {batch.results.map((r) => (
              <li key={r.jobId} style={{ marginBottom: 4 }}>
                #{r.jobNumber} — {r.clientName}:{" "}
                {r.success ? (
                  <span style={{ color: "var(--primary)" }}>
                    Charged {fmtAmount(r.amount ?? 0)}
                  </span>
                ) : (
                  <span style={{ color: "#dc2626" }}>{r.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BulkRow({
  job: j,
  disabled,
  disabledReason,
  missingClock,
  reviewMismatch,
  isOpen,
  isSelected,
  onToggle,
  onToggleExpanded,
}: {
  job: BulkJob;
  disabled: boolean;
  disabledReason: string | null;
  missingClock: boolean;
  reviewMismatch: boolean;
  isOpen: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onToggleExpanded: () => void;
}) {
  const giftCardApplied = Math.min(j.giftCardBalance, j.amountDue);
  return (
    <>
      <tr
        style={{
          borderTop: "1px solid var(--primary-10)",
          opacity: disabled ? 0.55 : 1,
        }}>
        <td style={td}>
          <input
            type="checkbox"
            disabled={disabled}
            checked={isSelected}
            onChange={onToggle}
          />
        </td>
        <td style={td}>#{j.jobNumber}</td>
        <td style={td}>{j.clientName}</td>
        <td style={{ ...td, fontSize: 12, color: "var(--primary-60)" }}>
          {j.jobType ?? "—"}
        </td>
        <td style={{ ...td, fontSize: 12, color: "var(--primary-60)" }}>
          {fmtDate(j.completedAt)}
        </td>
        <td style={{ ...td, fontSize: 12 }}>
          {missingClock ? (
            <span style={warnBadge}>No clock record</span>
          ) : j.billing.pricingModel !== "hourly" ? (
            <span style={{ color: "var(--primary-50)" }}>—</span>
          ) : (
            <span style={{ color: "var(--primary-60)" }}>
              {j.billing.hoursWorked}h
            </span>
          )}
        </td>
        <td
          style={{
            ...td,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
          }}>
          {fmtAmount(j.amountDue)}
          {reviewMismatch ? (
            <span style={{ ...warnBadge, marginLeft: 6 }} title={`SOP review figure is ${fmtAmount(j.billing.amountDueNow)} — expand to compare`}>
              Review
            </span>
          ) : null}
        </td>
        <td style={{ ...td, fontSize: 11, color: "var(--primary-50)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            {disabledReason ? <span>{disabledReason}</span> : null}
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Hide" : "Review"} breakdown for job #${j.jobNumber}`}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 700,
                background: isOpen ? "var(--primary)" : "transparent",
                color: isOpen ? "#fff" : "var(--primary-70)",
                border: "1px solid var(--primary-20)",
                borderRadius: 6,
                cursor: "pointer",
              }}>
              {isOpen ? "Hide" : "Review"}
            </button>
          </div>
        </td>
      </tr>
      {isOpen ? (
        <tr style={{ borderTop: "1px solid var(--primary-10)" }}>
          <td colSpan={8} style={{ padding: "14px 18px", background: "var(--primary-5)" }}>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ minWidth: 220 }}>
                <div style={detailHeading}>Time on site</div>
                <DetailRow label="Clock in" value={fmtDateTime(j.clockInAt)} />
                <DetailRow label="Clock out" value={fmtDateTime(j.clockOutAt)} />
                <DetailRow
                  label="Hours worked"
                  value={
                    j.billing.hoursWorked != null
                      ? `${j.billing.hoursWorked}h`
                      : "—"
                  }
                />
                {missingClock ? (
                  <p style={warnNote}>
                    Missing clock-in/out. Fix the clock record on the job page
                    before charging so labour can be verified.
                  </p>
                ) : null}
              </div>

              <div style={{ minWidth: 300, flex: "0 1 380px" }}>
                <div style={detailHeading}>Charge review (SOP §10)</div>
                {j.billing.pricingModel === "hourly" ? (
                  j.billing.labourFromClock != null &&
                  j.billing.billableHours != null &&
                  !j.billing.baseMissing ? (
                    <DetailRow
                      label={
                        Math.round(j.billing.labourFromClock * 100) ===
                        Math.round(j.billing.billableHours * j.billing.labourRate * 100)
                          ? `Billable labour (${j.billing.billableHours}h × $${j.billing.labourRate}/hr)`
                          : `Billable labour (${j.billing.billableHours}h · flat package)`
                      }
                      value={fmtAmount(j.billing.labourFromClock)}
                    />
                  ) : (
                    <DetailRow label="Billable labour (no clock record)" value="—" />
                  )
                ) : null}
                {j.billing.baseMissing && !missingClock ? (
                  <p style={warnNote}>
                    Booked before hourly billing — no base price on file, so the
                    booked total is used. Verify before charging.
                  </p>
                ) : null}
                {j.billing.materialsAmount > 0 ? (
                  <DetailRow
                    label={
                      j.billing.materialsType === "deposit"
                        ? "Materials deposit"
                        : "Materials & equipment"
                    }
                    value={fmtAmount(j.billing.materialsAmount)}
                  />
                ) : null}
                <DetailRow label="Subtotal" value={fmtAmount(j.billing.subtotal)} />
                {j.billing.discount > 0 ? (
                  <DetailRow label="Discount" value={`−${fmtAmount(j.billing.discount)}`} />
                ) : null}
                <DetailRow label="GST" value={fmtAmount(j.billing.gst)} />
                <DetailRow label="QST" value={fmtAmount(j.billing.qst)} />
                {j.billing.cancellationFee > 0 ? (
                  <DetailRow label="Cancellation fee" value={fmtAmount(j.billing.cancellationFee)} />
                ) : null}
                {j.depositCredit > 0 ? (
                  <DetailRow
                    label={
                      j.billing.materialsType === "deposit" &&
                      !centsEqual(j.depositCredit, j.billing.depositCollected)
                        ? `Deposit credit applied (of ${fmtAmount(j.billing.depositCollected)} collected)`
                        : "Deposit credit applied"
                    }
                    value={`−${fmtAmount(j.depositCredit)}`}
                  />
                ) : null}
                {j.billing.refunded > 0 ? (
                  <DetailRow
                    label={
                      j.billing.materialsRefunded
                        ? "Deposit balance refunded"
                        : "Refunded"
                    }
                    value={`−${fmtAmount(j.billing.refunded)}`}
                  />
                ) : null}
                <DetailRow label="Total" value={fmtAmount(j.billing.total)} />
                {j.billing.pricingModel === "hourly" &&
                !centsEqual(j.billing.bookedTotal, j.billing.total) ? (
                  <DetailRow label="Booked estimate" value={fmtAmount(j.billing.bookedTotal)} />
                ) : null}
                <DetailRow label="Amount due now" value={fmtAmount(j.amountDue)} strong />
                {giftCardApplied > 0 ? (
                  <p style={infoNote}>
                    {fmtAmount(giftCardApplied)} gift card credit will be
                    applied automatically; the card is charged the remaining{" "}
                    {fmtAmount(j.amountDue - giftCardApplied)}.
                  </p>
                ) : null}
                {reviewMismatch ? (
                  <p style={warnNote}>
                    SOP review figure ({fmtAmount(j.billing.amountDueNow)})
                    differs from the amount the charge will actually collect (
                    {fmtAmount(j.amountDue)}). Check the discount and deposit
                    reconciliation on the job page before charging.
                  </p>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DetailRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "3px 0",
        fontSize: 13,
        ...(strong
          ? {
              fontWeight: 700,
              borderTop: "1px solid var(--primary-10)",
              marginTop: 4,
              paddingTop: 7,
            }
          : {}),
      }}>
      <span style={{ color: "var(--primary-60)" }}>{label}</span>
      <span style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--primary-60)",
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  color: "var(--ink)",
};

const warnBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 700,
  color: "#92400e",
  background: "#fef3c7",
  border: "1px solid #fcd34d",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

const warnNote: React.CSSProperties = {
  marginTop: 8,
  padding: "8px 10px",
  fontSize: 12,
  color: "#92400e",
  background: "#fef3c7",
  border: "1px solid #fcd34d",
  borderRadius: 8,
};

const infoNote: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  color: "var(--primary-60)",
};

const detailHeading: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--primary-50)",
  marginBottom: 6,
};
