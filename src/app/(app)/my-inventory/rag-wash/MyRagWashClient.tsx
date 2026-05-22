"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createRagWash } from "../../actions/createRagWash";
import { Calendar, Plus } from "lucide-react";

interface WashEntry {
  id: string;
  washDate: string;
  ragCount: number;
  notes: string | null;
}

interface MyRagWashClientProps {
  employeeId: string;
  washes: WashEntry[];
  totalRags: number;
  totalWashes: number;
  lastWashDate: string | null;
}

export default function MyRagWashClient({
  employeeId,
  washes,
  totalRags,
  totalWashes,
  lastWashDate,
}: MyRagWashClientProps) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [washDate, setWashDate] = useState(new Date().toISOString().split("T")[0]);
  const [ragCount, setRagCount] = useState("1");
  const [notes, setNotes] = useState("");

  const avgRagsPerWash = totalWashes > 0 ? (totalRags / totalWashes).toFixed(1) : "—";

  function resetForm() {
    setWashDate(new Date().toISOString().split("T")[0]);
    setRagCount("1");
    setNotes("");
    setMessage(null);
  }

  async function handleAdd() {
    setSaving(true);
    setMessage(null);
    const res = await createRagWash({
      employeeId,
      washDate,
      ragCount: parseInt(ragCount) || 0,
      notes: notes || undefined,
    });
    if (res.success) {
      setMessage({ type: "success", text: "Wash entry logged." });
      setTimeout(() => {
        setShowAddModal(false);
        resetForm();
        router.refresh();
      }, 600);
    } else {
      setMessage({ type: "error", text: res.error || "Failed to log entry." });
    }
    setSaving(false);
  }

  return (
    <div className="cl-page-wrap">
      <button
        className="cl-back-link"
        onClick={() => router.push("/my-inventory")}
        style={{ marginBottom: 14 }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        Back to my inventory
      </button>

      <div className="cl-page-head">
        <div>
          <h1 className="cl-page-title">My rag washes</h1>
          <p className="cl-page-sub">Log and track the rags you have laundered.</p>
        </div>
        <button
          className="cl-log-wash-btn"
          onClick={() => { resetForm(); setShowAddModal(true); }}>
          <Plus className="w-[14px] h-[14px]" />
          Log new wash
        </button>
      </div>

      <div className="cl-rag-stats">
        <div className="cl-rag-stat">
          <div className="label">Total washes</div>
          <div className="val">{totalWashes}</div>
        </div>
        <div className="cl-rag-stat">
          <div className="label">Total rags</div>
          <div className="val">{totalRags}</div>
        </div>
        <div className="cl-rag-stat">
          <div className="label">Avg rags / wash</div>
          <div className="val">{avgRagsPerWash}</div>
        </div>
        <div className="cl-rag-stat">
          <div className="label">Last wash</div>
          <div className="val dt">
            {lastWashDate
              ? new Date(lastWashDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
              : "—"}
          </div>
        </div>
      </div>

      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, color: "var(--ink)", margin: "20px 0 12px", letterSpacing: "-0.01em" }}>
        Wash history
      </h2>

      <div className="cl-rag-table">
        <div className="cl-rag-table-head">
          <div>Date</div>
          <div>Rag count</div>
          <div>Notes</div>
        </div>
        {washes.length === 0 ? (
          <div style={{ padding: "32px 22px", textAlign: "center", color: "var(--primary-50)", fontSize: 13 }}>
            No wash entries yet. Click &ldquo;Log new wash&rdquo; to get started.
          </div>
        ) : (
          washes.map((wash) => (
            <div className="cl-rag-table-row" key={wash.id}>
              <div className="date">
                <span className="icon-bubble">
                  <Calendar className="w-4 h-4" />
                </span>
                {new Date(wash.washDate).toLocaleDateString("en-US", {
                  weekday: "short", month: "short", day: "numeric", year: "numeric",
                })}
              </div>
              <div>
                <span className="cl-rag-count-pill">
                  {wash.ragCount} rag{wash.ragCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ color: wash.notes ? "var(--ink-soft)" : "var(--primary-40)", fontSize: 13 }}>
                {wash.notes || "—"}
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="cl-modal-overlay" onClick={() => { setShowAddModal(false); resetForm(); }}>
          <div className="cl-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="cl-modal-head">
              <h2 className="cl-modal-title">Log new wash</h2>
              <button
                className="cl-modal-close"
                onClick={() => { setShowAddModal(false); resetForm(); }}
                aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="cl-modal-section">
              <label className="cl-form-label">Wash date</label>
              <input
                className="cl-form-input"
                type="date"
                value={washDate}
                onChange={(e) => setWashDate(e.target.value)}
              />
            </div>
            <div className="cl-modal-section">
              <label className="cl-form-label">Rag count</label>
              <input
                className="cl-form-input"
                type="number"
                min="1"
                value={ragCount}
                onChange={(e) => setRagCount(e.target.value)}
                placeholder="Number of rags washed"
              />
            </div>
            <div className="cl-modal-section">
              <label className="cl-form-label">Notes (optional)</label>
              <textarea
                className="cl-modal-textarea"
                rows={3}
                placeholder="Any additional notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {message && (
              <div style={{
                padding: "12px 16px", borderRadius: 12, fontSize: 13,
                background: message.type === "success" ? "rgba(0,95,106,0.08)" : "#fee2e2",
                color: message.type === "success" ? "var(--primary)" : "#dc2626",
                marginBottom: 8,
              }}>
                {message.text}
              </div>
            )}
            <div className="cl-modal-foot">
              <button className="cl-modal-cancel" onClick={() => { setShowAddModal(false); resetForm(); }}>Cancel</button>
              <button
                className="cl-modal-confirm"
                onClick={handleAdd}
                disabled={saving || !ragCount || parseInt(ragCount) < 1}>
                {saving ? "Saving..." : "Log wash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
