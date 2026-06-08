"use client";

import { useEffect, useState, useCallback } from "react";
import { Percent } from "lucide-react";
import {
  getLabourCostMetric,
  type LabourCostFilters,
} from "../actions/getLabourCostMetric";

interface Options {
  serviceTypes: string[];
  cleaners: Array<{ id: string; name: string }>;
}

export default function LabourCostCard() {
  const [filters, setFilters] = useState<LabourCostFilters>({});
  const [data, setData] = useState<{
    labour: number;
    revenue: number;
    labourPct: number | null;
    jobCount: number;
  } | null>(null);
  const [options, setOptions] = useState<Options>({
    serviceTypes: [],
    cleaners: [],
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: LabourCostFilters) => {
    setLoading(true);
    const res = await getLabourCostMetric(f);
    setLoading(false);
    if (res.success) {
      setData({
        labour: res.labour,
        revenue: res.revenue,
        labourPct: res.labourPct,
        jobCount: res.jobCount,
      });
      setOptions({ serviceTypes: res.serviceTypes, cleaners: res.cleaners });
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  function patch(p: Partial<LabourCostFilters>) {
    setFilters((f) => ({ ...f, ...p }));
  }

  const pctColor =
    data?.labourPct == null
      ? "#6b7280"
      : data.labourPct <= 35
      ? "#059669"
      : data.labourPct <= 50
      ? "#d97706"
      : "#dc2626";

  const input =
    "rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm bg-white";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-[#c44c03]/10 p-2">
            <Percent className="w-5 h-5 text-[#c44c03]" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Labour cost %</h3>
            <p className="text-xs text-gray-500">
              Labour as a share of revenue (completed &amp; paid jobs)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            className={input}
            value={filters.from ?? ""}
            onChange={(e) => patch({ from: e.target.value || undefined })}
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            className={input}
            value={filters.to ?? ""}
            onChange={(e) => patch({ to: e.target.value || undefined })}
          />
          <select
            className={input}
            value={filters.serviceType ?? ""}
            onChange={(e) => patch({ serviceType: e.target.value || undefined })}
          >
            <option value="">All services</option>
            {options.serviceTypes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className={input}
            value={filters.cleanerId ?? ""}
            onChange={(e) => patch({ cleanerId: e.target.value || undefined })}
          >
            <option value="">All cleaners</option>
            {options.cleaners.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {(filters.from || filters.to || filters.serviceType || filters.cleanerId) && (
            <button
              type="button"
              onClick={() => setFilters({})}
              className="text-xs text-gray-500 hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div className="text-3xl font-bold" style={{ color: pctColor }}>
            {loading ? "…" : data?.labourPct == null ? "—" : `${data.labourPct}%`}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Labour %</div>
        </div>
        <div>
          <div className="text-xl font-semibold text-gray-900">
            {loading ? "…" : `$${(data?.labour ?? 0).toLocaleString()}`}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Labour</div>
        </div>
        <div>
          <div className="text-xl font-semibold text-gray-900">
            {loading ? "…" : `$${(data?.revenue ?? 0).toLocaleString()}`}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Revenue (ex tax/tips)</div>
        </div>
        <div>
          <div className="text-xl font-semibold text-gray-900">
            {loading ? "…" : data?.jobCount ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Jobs</div>
        </div>
      </div>
    </div>
  );
}
