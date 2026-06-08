"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRetentionKpi, type RetentionKpi, type RetentionKpiRow } from "../actions/getRetentionKpi";
import { updateRecurringCancellation } from "../actions/updateRecurringCancellation";

type Preset = "month" | "quarter" | "year" | "custom";
type Tab = "all" | "pending" | "reactivated" | "replied";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  if (preset === "year") {
    return { from: isoDate(new Date(y, 0, 1)), to: isoDate(new Date(y, 11, 31)) };
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return {
      from: isoDate(new Date(y, q * 3, 1)),
      to: isoDate(new Date(y, q * 3 + 3, 0)),
    };
  }
  // month
  return {
    from: isoDate(new Date(y, now.getMonth(), 1)),
    to: isoDate(new Date(y, now.getMonth() + 1, 0)),
  };
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-2xl font-bold" style={{ color: accent ?? "#111827" }}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function RetentionKpiClient() {
  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState(() => presetRange("month"));
  const [data, setData] = useState<RetentionKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (r: { from: string; to: string }) => {
    setLoading(true);
    const res = await getRetentionKpi(r);
    setLoading(false);
    if (res.success) {
      setData(res);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

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
    if (tab === "pending") return data.rows.filter((r) => !r.reactivatedAt);
    if (tab === "reactivated") return data.rows.filter((r) => r.reactivatedAt);
    if (tab === "replied") return data.rows.filter((r) => r.repliedAt);
    return data.rows;
  }, [data, tab]);

  const presetBtn = (p: Preset, label: string) => (
    <button
      type="button"
      onClick={() => choosePreset(p)}
      className={`px-3 py-1.5 text-sm rounded-lg border ${
        preset === p
          ? "border-[#c44c03] text-[#c44c03] bg-[#c44c03]/5"
          : "border-gray-300 text-gray-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Recurring retention</h1>
      <p className="text-sm text-gray-500 mb-5">
        Save-offer performance for clients who cancelled their recurring service.
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-5">
        {presetBtn("month", "This month")}
        {presetBtn("quarter", "This quarter")}
        {presetBtn("year", "This year")}
        {presetBtn("custom", "Custom")}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Stat label="Cancellations" value={loading ? "…" : String(data?.totalCancellations ?? 0)} />
        <Stat
          label="Reactivated"
          value={loading ? "…" : String(data?.reactivated ?? 0)}
          accent="#059669"
        />
        <Stat
          label="Reactivation rate"
          value={loading ? "…" : data?.reactivationRate == null ? "—" : `${data.reactivationRate}%`}
          accent="#059669"
        />
        <Stat label="Pending" value={loading ? "…" : String(data?.pending ?? 0)} accent="#d97706" />
        <Stat label="Replied" value={loading ? "…" : String(data?.replied ?? 0)} />
        <Stat
          label="Active recurring"
          value={loading ? "…" : String(data?.activeRecurringClients ?? 0)}
        />
      </div>

      <div className="text-xs text-gray-500 mb-4">
        Offer funnel — sent {data?.emailSent ?? 0} · opened {data?.opened ?? 0} · clicked{" "}
        {data?.clicked ?? 0}
      </div>

      {/* Drill-down */}
      <div className="flex items-center gap-2 mb-3">
        {(["all", "pending", "reactivated", "replied"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-lg capitalize ${
              tab === t ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Client</th>
              <th className="text-left px-4 py-2 font-medium">Frequency</th>
              <th className="text-left px-4 py-2 font-medium">Cancelled</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {loading ? "Loading…" : "No cancellations in this period."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-2.5 text-gray-900">
                  {r.clientName}
                  {r.reason && (
                    <span className="block text-xs text-gray-400">{r.reason}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-600 capitalize">
                  {r.frequency.toLowerCase()}
                </td>
                <td className="px-4 py-2.5 text-gray-600">
                  {new Date(r.cancelledAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-xs text-gray-700">
                    {r.reactivatedAt
                      ? "Reactivated"
                      : r.repliedAt
                      ? "Replied"
                      : r.clickedAt
                      ? "Clicked"
                      : r.openedAt
                      ? "Opened"
                      : r.emailSentAt
                      ? "Sent"
                      : r.offerStatus}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {!r.repliedAt && !r.reactivatedAt && (
                    <button
                      type="button"
                      onClick={() => markReplied(r.id)}
                      disabled={busyId === r.id}
                      className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Mark replied
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
