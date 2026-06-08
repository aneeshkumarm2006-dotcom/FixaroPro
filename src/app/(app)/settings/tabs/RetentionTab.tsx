"use client";

import { useState } from "react";
import { saveRetentionConfig } from "../../actions/saveRetentionConfig";
import {
  RETENTION_SETTING_KEY,
  DEFAULT_SAVE_OFFER,
  type SaveOfferConfig,
} from "@/lib/retention-constants";

interface AppSettingRecord {
  key: string;
  value: unknown;
}

export default function RetentionTab({
  settings,
}: {
  settings: AppSettingRecord[];
}) {
  const stored = settings.find((s) => s.key === RETENTION_SETTING_KEY)?.value;
  const initial: SaveOfferConfig = {
    ...DEFAULT_SAVE_OFFER,
    ...(stored && typeof stored === "object"
      ? (stored as Partial<SaveOfferConfig>)
      : {}),
  };

  const [config, setConfig] = useState<SaveOfferConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  function patch(p: Partial<SaveOfferConfig>) {
    setConfig((c) => ({ ...c, ...p }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await saveRetentionConfig(config);
    setSaving(false);
    setMsg(
      res.success
        ? { type: "ok", text: "Saved." }
        : { type: "err", text: res.error ?? "Failed to save" }
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Retention save offer</h2>
        <p className="text-sm text-gray-500 mt-1">
          When a customer cancels their recurring service, we email them this
          one-time offer to win them back.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        Send a save offer on recurring cancellation
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Offer type
          </label>
          <select
            value={config.offerType}
            onChange={(e) =>
              patch({ offerType: e.target.value as "FIXED" | "PERCENT" })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="PERCENT">Percent off</option>
            <option value="FIXED">Fixed amount off</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {config.offerType === "PERCENT" ? "Percent (%)" : "Amount ($)"}
          </label>
          <input
            type="number"
            min={1}
            value={config.offerValue}
            onChange={(e) => patch({ offerValue: Number(e.target.value) })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Code valid for (days)
        </label>
        <input
          type="number"
          min={1}
          value={config.expiresInDays}
          onChange={(e) => patch({ expiresInDays: Number(e.target.value) })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Email headline
        </label>
        <input
          type="text"
          value={config.headline}
          onChange={(e) => patch({ headline: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Email body
        </label>
        <textarea
          rows={3}
          value={config.body}
          onChange={(e) => patch({ body: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Button label
        </label>
        <input
          type="text"
          value={config.buttonLabel}
          onChange={(e) => patch({ buttonLabel: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {msg && (
          <span
            className={`text-sm ${
              msg.type === "ok" ? "text-green-600" : "text-red-600"
            }`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
