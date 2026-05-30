"use client";

import { useMemo, useState, useTransition } from "react";
import { bulkChargeJobs } from "../actions/bulkChargeJobs";

interface BulkJob {
  id: string;
  jobNumber: number;
  clientName: string;
  jobType: string | null;
  amount: number;
  completedAt: string | null;
  hasCardOnFile: boolean;
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

export default function BulkChargeClient({ jobs }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<BatchResult | null>(null);
  const [pending, startTransition] = useTransition();

  const eligible = useMemo(() => jobs.filter((j) => j.hasCardOnFile), [jobs]);
  const allSelected = eligible.length > 0 && selected.size === eligible.length;
  const selectedTotal = useMemo(
    () =>
      jobs
        .filter((j) => selected.has(j.id))
        .reduce((sum, j) => sum + j.amount, 0),
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

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(eligible.map((j) => j.id)));
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
            All completed jobs that are unpaid and have a card on file. Select
            the rows you want to bill and run them in one batch.
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
              {pending ? "Charging…" : `Charge ${selected.size} job${selected.size === 1 ? "" : "s"}`}
            </button>
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
                  <th style={{ ...th, textAlign: "right" }}>Amount</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const disabled = !j.hasCardOnFile;
                  return (
                    <tr
                      key={j.id}
                      style={{
                        borderTop: "1px solid var(--primary-10)",
                        opacity: disabled ? 0.55 : 1,
                      }}>
                      <td style={td}>
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={selected.has(j.id)}
                          onChange={() => toggle(j.id)}
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
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                        }}>
                        {fmtAmount(j.amount)}
                      </td>
                      <td style={{ ...td, fontSize: 11, color: "var(--primary-50)" }}>
                        {disabled ? "No card on file" : ""}
                      </td>
                    </tr>
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
