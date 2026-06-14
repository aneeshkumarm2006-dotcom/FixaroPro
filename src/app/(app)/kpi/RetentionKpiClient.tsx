"use client";

// Recurring client retention — Cleano "Retention" design, re-skinned to the
// Fixaro charcoal/orange palette (A). Keeps the existing data fetch + actions.

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRetentionKpi, type RetentionKpi, type RetentionKpiRow } from "../actions/getRetentionKpi";
import { updateRecurringCancellation } from "../actions/updateRecurringCancellation";

type Preset = "month" | "quarter" | "year" | "custom";
type Bucket = "all" | "pending" | "reactivated" | "replied";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  if (preset === "year") return { from: isoDate(new Date(y, 0, 1)), to: isoDate(new Date(y, 11, 31)) };
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: isoDate(new Date(y, q * 3, 1)), to: isoDate(new Date(y, q * 3 + 3, 0)) };
  }
  return { from: isoDate(new Date(y, now.getMonth(), 1)), to: isoDate(new Date(y, now.getMonth() + 1, 0)) };
}
const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

// ── progress ring (ported from the Cleano chart kit, palette A) ──
function Ring({ value, max = 100, label, sublabel, color = "#059669", size = 140 }: {
  value: number; max?: number; label?: string; sublabel?: string; color?: string; size?: number;
}) {
  const stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max)), cx = size / 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--primary-10)" strokeWidth={stroke} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${cx} ${cx})`} />
        <text x={cx} y={cx - 2} textAnchor="middle" fontSize={size * 0.2} fontFamily="var(--font-serif)" fill="var(--ink)">{Math.round(pct * 100)}%</text>
        {sublabel && <text x={cx} y={cx + size * 0.16} textAnchor="middle" fontSize="11" fill="var(--primary-60)">{sublabel}</text>}
      </svg>
      {label && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{label}</div>}
    </div>
  );
}

function Tile({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="an-tile">
      <div className="an-tile-label">{label}</div>
      <div className="an-tile-value" style={accent ? { color: accent } : undefined}>{value}</div>
      {hint && <div className="an-tile-hint">{hint}</div>}
    </div>
  );
}

function statusOf(r: RetentionKpiRow) {
  if (r.reactivatedAt) return { label: "Reactivated", bg: "#d1fae5", color: "#065f46", dot: "#059669" };
  if (r.repliedAt) return { label: "Replied", bg: "#dbeafe", color: "#1e40af", dot: "#3b82f6" };
  if (r.clickedAt) return { label: "Clicked", bg: "var(--primary-5)", color: "var(--primary)", dot: "var(--primary)" };
  if (r.openedAt) return { label: "Opened", bg: "var(--primary-5)", color: "var(--primary-70)", dot: "var(--primary-40)" };
  if (r.emailSentAt) return { label: "Sent", bg: "#fef3c7", color: "var(--amber-800)", dot: "#d97706" };
  return { label: r.offerStatus || "Cancelled", bg: "#fef2f2", color: "#991b1b", dot: "#dc2626" };
}

export default function RetentionKpiClient() {
  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState(() => presetRange("month"));
  const [data, setData] = useState<RetentionKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (r: { from: string; to: string }) => {
    setLoading(true);
    const res = await getRetentionKpi(r);
    setLoading(false);
    if (res.success) setData(res);
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  function choosePreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  }
  async function markReplied(id: string) {
    setBusyId(id);
    await updateRecurringCancellation({ id, action: "replied" });
    setBusyId(null);
    load(range);
  }

  const rows = useMemo<RetentionKpiRow[]>(() => {
    if (!data) return [];
    if (bucket === "pending") return data.rows.filter((r) => !r.reactivatedAt);
    if (bucket === "reactivated") return data.rows.filter((r) => r.reactivatedAt);
    if (bucket === "replied") return data.rows.filter((r) => r.repliedAt);
    return data.rows;
  }, [data, bucket]);

  const total = data?.totalCancellations ?? 0;
  const reactivated = data?.reactivated ?? 0;
  const reactRate = data?.reactivationRate ?? 0;
  const pending = data?.pending ?? 0;
  const replied = data?.replied ?? 0;

  const PERIODS: Array<{ id: Preset; label: string }> = [
    { id: "month", label: "This month" }, { id: "quarter", label: "This quarter" },
    { id: "year", label: "This year" }, { id: "custom", label: "Custom" },
  ];
  const BUCKETS: Array<{ id: Bucket; label: string; count: number }> = [
    { id: "all", label: "All", count: data?.rows.length ?? 0 },
    { id: "pending", label: "Pending", count: data?.rows.filter((r) => !r.reactivatedAt).length ?? 0 },
    { id: "reactivated", label: "Reactivated", count: reactivated },
    { id: "replied", label: "Replied", count: replied },
  ];

  return (
    <div className="admin-font">
      <header style={{ marginBottom: 24 }}>
        <p className="eyebrow">Insights · Retention</p>
        <h1 className="display" style={{ fontSize: "clamp(32px, 4.2vw, 46px)", marginTop: 6 }}>Recurring client <em>retention.</em></h1>
        <p className="subtitle" style={{ marginTop: 10, fontSize: 15.5 }}>Save-offer performance for clients who cancelled their recurring service.</p>
      </header>

      {/* Period selector */}
      <div className="k-period">
        <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <button key={p.id} className={`an-chip ${preset === p.id ? "active" : ""}`} onClick={() => choosePreset(p.id)}>{p.label}</button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="row" style={{ display: "flex", gap: 10 }}>
            <label className="k-date">From<input type="date" className="input" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></label>
            <label className="k-date">To<input type="date" className="input" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></label>
          </div>
        )}
      </div>

      {/* KPI tiles + ring */}
      <div className="k-top">
        <div className="k-cards">
          <Tile label="Reactivation rate" value={loading ? "…" : `${reactRate}%`} accent="var(--emerald-600)" hint={`${reactivated} of ${total} won back`} />
          <Tile label="Cancellations" value={loading ? "…" : total} hint="recurring services cancelled" />
          <Tile label="Reactivations" value={loading ? "…" : reactivated} accent="var(--primary)" hint="won back this period" />
          <Tile label="Pending" value={loading ? "…" : pending} accent="var(--amber-700)" hint="awaiting outcome" />
        </div>
        <div className="dcard k-ring">
          <Ring value={reactRate} color="#059669" label="Reactivated" sublabel={`${reactivated}/${total} clients`} size={140} />
        </div>
      </div>

      {/* Offer funnel */}
      <p className="k-funnel">
        Offer funnel — sent <strong>{data?.emailSent ?? 0}</strong> · opened <strong>{data?.opened ?? 0}</strong> · clicked <strong>{data?.clicked ?? 0}</strong> · replied <strong>{replied}</strong> · active recurring <strong>{data?.activeRecurringClients ?? 0}</strong>
      </p>

      {/* Bucket filter */}
      <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "24px 0 16px" }}>
        {BUCKETS.map((b) => (
          <button key={b.id} className={`k-bucket ${bucket === b.id ? "active" : ""}`} onClick={() => setBucket(b.id)}>
            {b.label}<span className="k-bucket-count">{b.count}</span>
          </button>
        ))}
      </div>

      {/* Client table */}
      <div className="atable-wrap">
        <div className="atable-scroll">
          <table className="atable">
            <thead>
              <tr><th>Client</th><th>Frequency</th><th>Cancelled</th><th>Status</th><th style={{ textAlign: "right" }}>Action</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 48, color: "var(--primary-50)" }}>{loading ? "Loading…" : "No cancellations in this period."}</td></tr>
              ) : rows.map((r) => {
                const s = statusOf(r);
                return (
                  <tr key={r.id} style={{ cursor: "default" }}>
                    <td>
                      <div className="row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flex: "0 0 auto" }}>{initials(r.clientName)}</span>
                        <div><div className="col-client">{r.clientName}</div>{r.reason && <div className="col-client-sub">{r.reason}</div>}</div>
                      </div>
                    </td>
                    <td><span className="pill" style={{ background: "var(--primary-5)", color: "var(--primary)", textTransform: "capitalize" }}>{r.frequency.toLowerCase()}</span></td>
                    <td style={{ fontSize: 13, color: "var(--ink-soft)" }}>{new Date(r.cancelledAt).toLocaleDateString()}</td>
                    <td><span className="pill" style={{ background: s.bg, color: s.color }}><span className="pill-dot" style={{ background: s.dot }} />{s.label}</span></td>
                    <td style={{ textAlign: "right" }}>
                      {!r.repliedAt && !r.reactivatedAt && (
                        <button className="btn btn-secondary btn-sm" onClick={() => markReplied(r.id)} disabled={busyId === r.id}>Mark replied</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
