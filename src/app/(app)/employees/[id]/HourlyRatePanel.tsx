"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";
import { setEmployeeHourlyRate } from "../../actions/setEmployeeHourlyRate";

/**
 * Admin control for a provider's hourly PAY rate (Fix #3e / #8d).
 *
 * Empty input = clear the override and fall back to the configured default.
 * The server re-validates and audit-logs; this component is convenience only.
 */
export default function HourlyRatePanel({
  employeeId,
  initialRate,
  defaultRate,
}: {
  employeeId: string;
  initialRate: number | null;
  defaultRate: number;
}) {
  const [value, setValue] = useState(initialRate != null ? String(initialRate) : "");
  const [saved, setSaved] = useState<number | null>(initialRate);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const effective = saved ?? defaultRate;

  async function save() {
    const trimmed = value.trim();
    let rate: number | null = null;
    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setMsg({ type: "error", text: "Enter a rate of $0 or more, or leave blank for the default." });
        return;
      }
      rate = parsed;
    }
    setSaving(true);
    setMsg(null);
    const res = await setEmployeeHourlyRate({ employeeId, hourlyRate: rate });
    setSaving(false);
    if (res.success) {
      setSaved(rate);
      setMsg({
        type: "success",
        text: rate == null ? "Cleared — using the default rate." : "Hourly rate updated.",
      });
    } else {
      setMsg({ type: "error", text: res.error ?? "Failed to update rate." });
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="w-4 h-4 text-[#e85d04]" />
        <h3 className="text-sm font-[600] text-gray-800">Hourly Pay Rate</h3>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-[600] text-gray-900">
          ${effective.toFixed(2)}
        </span>
        <span className="text-sm text-gray-500">/hr</span>
        {saved == null && (
          <span className="text-xs text-gray-400">(default)</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="0.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Default $${defaultRate.toFixed(2)}`}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-[#e85d04]"
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-[#e85d04] text-white rounded-lg hover:bg-[#e85d04]/90 disabled:opacity-50">
          {saving ? "Saving…" : "Set"}
        </button>
      </div>

      {msg && (
        <p
          className={`text-xs mt-2 ${
            msg.type === "success" ? "text-green-600" : "text-red-500"
          }`}>
          {msg.text}
        </p>
      )}

      <p className="text-xs text-gray-400 mt-2">
        What this provider is PAID per clocked hour — not the customer&apos;s labour
        rate. Leave blank to use the configured default. A single job can override
        this; changes are audit-logged.
      </p>
    </div>
  );
}
