"use client";

// Fix #7 — the six-bucket equipment & materials editor, shared by the Pro's
// PreJobEquipmentPanel and the manager's EquipmentReadinessPanel so both sides
// see identical buckets, labels and ordering.
//
// Purely presentational: it owns no persistence and performs no authorization.
// Every action behind it re-validates and re-authorizes server-side.

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  BUCKET_HINTS,
  BUCKET_KEYS,
  BUCKET_LABELS,
  type BucketKey,
  type EquipmentBuckets,
} from "@/lib/pre-job-equipment";

export function EquipmentBucketEditor({
  buckets,
  onChange,
  disabled = false,
}: {
  buckets: EquipmentBuckets;
  onChange: (next: EquipmentBuckets) => void;
  disabled?: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function addItem(key: BucketKey) {
    const raw = (drafts[key] ?? "").trim().replace(/\s+/g, " ");
    if (!raw) return;
    // Client-side dedupe is a convenience only — the server dedupes too.
    const exists = buckets[key].some((i) => i.toLowerCase() === raw.toLowerCase());
    if (!exists) onChange({ ...buckets, [key]: [...buckets[key], raw.slice(0, 120)] });
    setDrafts((d) => ({ ...d, [key]: "" }));
  }

  function removeItem(key: BucketKey, item: string) {
    onChange({ ...buckets, [key]: buckets[key].filter((i) => i !== item) });
  }

  return (
    <div className="fx-buckets">
      {BUCKET_KEYS.map((key) => (
        <section key={key} className="fx-bucket">
          <header>
            <h4>{BUCKET_LABELS[key]}</h4>
            <span className="fx-bucket-count">{buckets[key].length}</span>
          </header>
          <p className="fx-bucket-hint">{BUCKET_HINTS[key]}</p>

          <div className="fx-chips">
            {buckets[key].length === 0 ? (
              <span className="fx-empty">Nothing added</span>
            ) : (
              buckets[key].map((item) => (
                <span key={item} className={`fx-chip${key === "toPurchase" ? " buy" : ""}`}>
                  {item}
                  {!disabled && (
                    <button
                      type="button"
                      aria-label={`Remove ${item}`}
                      onClick={() => removeItem(key, item)}>
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))
            )}
          </div>

          {!disabled && (
            <div className="fx-add">
              <input
                value={drafts[key] ?? ""}
                maxLength={120}
                placeholder={`Add to ${BUCKET_LABELS[key].toLowerCase()}`}
                onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem(key);
                  }
                }}
              />
              <button type="button" onClick={() => addItem(key)} aria-label="Add item">
                <Plus size={14} />
              </button>
            </div>
          )}
        </section>
      ))}

      <style jsx>{`
        .fx-buckets {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 12px;
        }
        .fx-bucket {
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          padding: 12px;
          background: #fff;
        }
        .fx-bucket header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .fx-bucket h4 {
          font-size: 13px;
          font-weight: 700;
          color: #2b2b2b;
          margin: 0;
        }
        .fx-bucket-count {
          font-size: 11px;
          font-weight: 700;
          color: #7a7a7a;
          background: #f3f3f3;
          border-radius: 999px;
          padding: 1px 8px;
        }
        .fx-bucket-hint {
          font-size: 11.5px;
          color: #8a8a8a;
          margin: 4px 0 8px;
          line-height: 1.35;
        }
        .fx-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 8px;
        }
        .fx-empty {
          font-size: 11.5px;
          color: #b0b0b0;
          font-style: italic;
        }
        .fx-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          background: #f4f4f5;
          color: #3f3f46;
          border-radius: 999px;
          padding: 3px 8px;
        }
        .fx-chip.buy {
          background: #fff1e6;
          color: #9a3412;
          font-weight: 600;
        }
        .fx-chip button {
          display: inline-flex;
          color: inherit;
          opacity: 0.55;
        }
        .fx-chip button:hover {
          opacity: 1;
        }
        .fx-add {
          display: flex;
          gap: 6px;
        }
        .fx-add input {
          flex: 1;
          min-width: 0;
          border: 1px solid #dcdcdc;
          border-radius: 8px;
          padding: 6px 9px;
          font-size: 12.5px;
        }
        .fx-add input:focus {
          outline: none;
          border-color: #f97316;
        }
        .fx-add button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          border: 1px solid #dcdcdc;
          border-radius: 8px;
          color: #2b2b2b;
        }
        .fx-add button:hover {
          background: #2b2b2b;
          border-color: #2b2b2b;
          color: #fff;
        }
      `}</style>
    </div>
  );
}

export default EquipmentBucketEditor;
