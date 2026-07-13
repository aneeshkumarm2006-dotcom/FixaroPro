"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw, Save, Wrench, X } from "lucide-react";
import {
  setServiceEquipment,
  resetServiceEquipment,
} from "../actions/setServiceEquipment";
import { updateAppSetting } from "../actions/updateAppSetting";
import {
  EQUIPMENT_READINESS_SETTING_KEY,
  EQUIPMENT_READINESS_SETTING_CATEGORY,
  type EquipmentReadinessMode,
} from "@/lib/equipment-readiness-constants";

interface Checklist {
  serviceType: string;
  label: string;
  category: string;
  items: string[];
  customised: boolean;
}

interface Coverage {
  totalItems: number;
  trackedItems: number;
}

const READINESS_MODES: Array<{
  value: EquipmentReadinessMode;
  label: string;
  hint: string;
}> = [
  {
    value: "off",
    label: "Off",
    hint: "Ignore equipment entirely. Providers are notified and can claim on service eligibility alone.",
  },
  {
    value: "warn",
    label: "Warn (recommended)",
    hint: "Notify every eligible provider, but tell them what they are short of before they claim or bid.",
  },
  {
    value: "strict",
    label: "Strict",
    hint: "Additionally hide the job from providers who are provably short of a required item.",
  },
];

export default function EquipmentChecklistsClient({
  checklists,
  categories,
  readinessMode,
  coverage,
}: {
  checklists: Checklist[];
  categories: string[];
  readinessMode: EquipmentReadinessMode;
  coverage: Coverage;
}) {
  const [rows, setRows] = useState<Checklist[]>(checklists);
  const [openService, setOpenService] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [mode, setMode] = useState<EquipmentReadinessMode>(readinessMode);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // An item is only checkable when it matches a row in the product catalog.
  // With none matched, "strict" has nothing to act on — say so rather than let
  // ops believe they have turned on a filter that does anything.
  const nothingTracked = coverage.trackedItems === 0;

  function saveMode(next: EquipmentReadinessMode) {
    const previous = mode;
    setMode(next);
    setMsg(null);
    start(async () => {
      const res = await updateAppSetting({
        key: EQUIPMENT_READINESS_SETTING_KEY,
        category: EQUIPMENT_READINESS_SETTING_CATEGORY,
        value: next,
      });
      if (res.success) {
        setMsg({ ok: true, text: `Equipment readiness set to “${next}”.` });
      } else {
        setMode(previous);
        setMsg({ ok: false, text: res.error ?? "Failed to save readiness mode" });
      }
    });
  }

  function open(row: Checklist) {
    setOpenService(row.serviceType);
    setDraftItems(row.items);
    setNewItem("");
    setMsg(null);
  }

  function save(serviceType: string) {
    setMsg(null);
    start(async () => {
      const res = await setServiceEquipment({ serviceType, items: draftItems });
      if (res.success) {
        setRows((r) =>
          r.map((x) =>
            x.serviceType === serviceType
              ? { ...x, items: res.items ?? [], customised: true }
              : x
          )
        );
        setOpenService(null);
        setMsg({ ok: true, text: "Checklist saved." });
      } else {
        setMsg({ ok: false, text: res.error ?? "Failed to save" });
      }
    });
  }

  function reset(serviceType: string) {
    setMsg(null);
    start(async () => {
      const res = await resetServiceEquipment(serviceType);
      if (res.success) {
        setRows((r) =>
          r.map((x) =>
            x.serviceType === serviceType
              ? { ...x, items: res.items ?? [], customised: false }
              : x
          )
        );
        setOpenService(null);
        setMsg({ ok: true, text: "Reset to the Fixaro default." });
      } else {
        setMsg({ ok: false, text: res.error ?? "Failed to reset" });
      }
    });
  }

  return (
    <div className="cl-stack-24" style={{ padding: 24 }}>
      <header className="cl-stack-8">
        <h1 className="cl-title-lg flex items-center gap-2">
          <Wrench size={20} /> Equipment checklists
        </h1>
        <p className="cl-subtitle" style={{ maxWidth: 720 }}>
          The equipment and products generally required for each service. Customers see
          this on the booking page before checkout, and handymen see it on the job card.
          Services you have not customised use the Fixaro default. Every edit is
          recorded in the audit log.
        </p>
      </header>

      {msg ? (
        <p
          style={{
            fontSize: 13,
            color: msg.ok ? "#15803d" : "#dc2626",
            margin: 0,
          }}>
          {msg.text}
        </p>
      ) : null}

      <section
        style={{
          border: "1px solid rgba(28,25,23,0.10)",
          borderRadius: 14,
          padding: "16px 18px",
          background: "#fff",
        }}>
        <h2 className="cl-label" style={{ margin: 0 }}>
          Missing-equipment flow
        </h2>
        <p
          className="cl-subtitle"
          style={{ margin: "6px 0 14px", maxWidth: 720, fontSize: 13 }}>
          What happens when a handyman is short of something on the list — both when we
          decide who to notify about a new job, and when they try to claim it.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {READINESS_MODES.map((option) => (
            <label
              key={option.value}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                cursor: pending ? "default" : "pointer",
                opacity: pending ? 0.6 : 1,
              }}>
              <input
                type="radio"
                name="equipment-readiness-mode"
                value={option.value}
                checked={mode === option.value}
                disabled={pending}
                onChange={() => saveMode(option.value)}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong style={{ fontSize: 13 }}>{option.label}</strong>
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--primary-60)",
                    marginTop: 2,
                  }}>
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </div>

        <p
          style={{
            margin: "14px 0 0",
            fontSize: 12,
            color: nothingTracked ? "#92400e" : "var(--primary-60)",
            background: nothingTracked ? "rgba(217,119,6,0.10)" : "transparent",
            padding: nothingTracked ? "8px 10px" : 0,
            borderRadius: 8,
          }}>
          {nothingTracked ? (
            <>
              <strong>None of the {coverage.totalItems} checklist items match a product
              categorised “Tool” yet</strong>, so we cannot prove anyone is missing anything —
              “strict” currently hides nothing and behaves like “warn”. To make readiness real:
              add the tool under Inventory → Products with the <strong>Tool</strong> category,
              then assign it to the handymen who own one. Only Tool products are ever checked;
              consumables never count against anyone.
            </>
          ) : (
            <>
              {coverage.trackedItems} of {coverage.totalItems} checklist items match a{" "}
              <strong>Tool</strong> product and can be checked against a handyman’s kit. The
              other {coverage.totalItems - coverage.trackedItems} are never counted against
              anyone. Only Tool-category products are considered — consumables are ignored.
            </>
          )}
        </p>
      </section>

      {categories.map((cat) => {
        const inCat = rows.filter((r) => r.category === cat);
        if (inCat.length === 0) return null;
        return (
          <section key={cat} className="cl-stack-12">
            <h2 className="cl-label">{cat}</h2>
            <div className="cl-stack-8">
              {inCat.map((row) => (
                <div
                  key={row.serviceType}
                  style={{
                    border: "1px solid rgba(28,25,23,0.10)",
                    borderRadius: 14,
                    padding: "14px 18px",
                    background: "#fff",
                  }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>{row.label}</strong>
                      {row.customised ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "rgba(217,119,6,0.12)",
                            color: "#92400e",
                          }}>
                          customised
                        </span>
                      ) : null}
                      <div style={{ fontSize: 12, color: "var(--primary-60)", marginTop: 4 }}>
                        {row.items.length > 0
                          ? row.items.join(" · ")
                          : "No equipment required"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      {row.customised ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => reset(row.serviceType)}
                          title="Reset to the Fixaro default"
                          className="cl-btn cl-btn-secondary"
                          style={{ padding: "6px 10px" }}>
                          <RotateCcw size={14} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          openService === row.serviceType ? setOpenService(null) : open(row)
                        }
                        className="cl-btn cl-btn-secondary"
                        style={{ padding: "6px 12px", fontSize: 13 }}>
                        {openService === row.serviceType ? "Close" : "Edit"}
                      </button>
                    </div>
                  </div>

                  {openService === row.serviceType ? (
                    <div className="cl-stack-8" style={{ marginTop: 14 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {draftItems.map((item, i) => (
                          <span
                            key={`${item}-${i}`}
                            style={{
                              fontSize: 13,
                              padding: "6px 8px 6px 12px",
                              borderRadius: 999,
                              background: "rgba(28,25,23,0.04)",
                              border: "1px solid rgba(28,25,23,0.10)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}>
                            {item}
                            <button
                              type="button"
                              onClick={() =>
                                setDraftItems((d) => d.filter((_, j) => j !== i))
                              }
                              aria-label={`Remove ${item}`}
                              style={{
                                border: 0,
                                background: "transparent",
                                cursor: "pointer",
                                lineHeight: 0,
                              }}>
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                        {draftItems.length === 0 ? (
                          <span style={{ fontSize: 12, color: "var(--primary-60)" }}>
                            No items — this service will show no equipment requirement.
                          </span>
                        ) : null}
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={newItem}
                          onChange={(e) => setNewItem(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newItem.trim()) {
                              e.preventDefault();
                              setDraftItems((d) => [...d, newItem.trim()]);
                              setNewItem("");
                            }
                          }}
                          placeholder="Add equipment, then press Enter"
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid rgba(28,25,23,0.15)",
                            fontSize: 13,
                            fontFamily: "inherit",
                          }}
                        />
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => save(row.serviceType)}
                          className="cl-btn cl-btn-primary"
                          style={{ padding: "8px 14px", fontSize: 13 }}>
                          {pending ? (
                            <Loader2 size={14} className="cl-spin" />
                          ) : (
                            <Save size={14} />
                          )}{" "}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
