"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInventoryRequest } from "../actions/createInventoryRequest";

interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productDescription: string | null;
  unit: string;
  quantity: number;
  refillThreshold: number;
  usagePerJob: number;
  assignedAt: string;
  updatedAt: string;
  isLow: boolean;
  isOutOfStock: boolean;
}

interface RequestItem {
  id: string;
  productName: string | null;
  kitName: string | null;
  quantity: number;
  status: string;
  reason: string | null;
  createdAt: string;
}

interface Location {
  id: string;
  name: string;
  address: string | null;
}

interface MyInventoryClientProps {
  items: InventoryItem[];
  requests: RequestItem[];
  locations: Location[];
}

type TabId = "inventory" | "requests";

export default function MyInventoryClient({
  items,
  requests,
  locations,
}: MyInventoryClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("inventory");
  const [refillItem, setRefillItem] = useState<InventoryItem | null>(null);
  const [refillQuantity, setRefillQuantity] = useState<number>(0);
  const [refillReason, setRefillReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const needAttn = items.filter((i) => i.isLow || i.isOutOfStock).length;
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  function openRefill(item: InventoryItem) {
    setRefillItem(item);
    setRefillQuantity(Math.max(item.refillThreshold * 2, item.usagePerJob, 1));
    setRefillReason("");
    setFeedback(null);
  }

  function closeRefill() {
    setRefillItem(null);
    setRefillQuantity(0);
    setRefillReason("");
  }

  async function submitRefill() {
    if (!refillItem) return;
    if (refillQuantity <= 0) {
      setFeedback({ type: "error", text: "Quantity must be greater than 0." });
      return;
    }
    setSubmitting(true);
    const res = await createInventoryRequest({
      productId: refillItem.productId,
      quantity: refillQuantity,
      reason: refillReason || `Refill for ${refillItem.productName}`,
    });
    setSubmitting(false);
    if (res.success) {
      setFeedback({ type: "success", text: "Refill request submitted." });
      setTimeout(() => {
        closeRefill();
        router.refresh();
      }, 600);
    } else {
      setFeedback({ type: "error", text: res.error || "Failed to submit request." });
    }
  }

  return (
    <div className="cl-page-wrap">
      <div className="cl-page-head">
        <div>
          <h1 className="cl-page-title">My inventory</h1>
          <p className="cl-page-sub">Equipment and supplies assigned to you.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="/my-inventory/rag-wash" className="cl-action-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c-1 2-6 7-6 11a6 6 0 0 0 12 0c0-4-5-9-6-11z" /></svg>
            Log rag washes
          </a>
        </div>
      </div>

      {/* Hero */}
      <div className="cl-inv-hero">
        <div className="cl-inv-hero-main">
          <span className="greet-label">Your kit</span>
          <h2>{items.length} item{items.length === 1 ? "" : "s"} <em>in your bag.</em></h2>
          <p className="desc">
            {needAttn === 0
              ? "You're fully stocked. Nice work keeping the kit topped up."
              : `${needAttn} ${needAttn === 1 ? "item is" : "items are"} running low — pick up replacements from storage when you can.`}
          </p>
          <div className="cl-inv-hero-actions">
            <a href="/my-inventory/checkout" className="cl-inv-hero-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
              Pick up from storage
            </a>
          </div>
        </div>

        <div className={`cl-inv-hero-stat${needAttn > 0 ? " alert" : ""}`}>
          <div className="top">
            <span>Needs attention</span>
            <span className="icon-bubble">
              {needAttn > 0 ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </span>
          </div>
          <div className="big">{needAttn}</div>
          <div className="sub">{needAttn === 0 ? "All items stocked" : `${needAttn} below refill threshold`}</div>
        </div>

        <div className="cl-inv-hero-stat">
          <div className="top">
            <span>Total units</span>
            <span className="icon-bubble">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
            </span>
          </div>
          <div className="big">{totalUnits}</div>
          <div className="sub">across {items.length} item{items.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      {/* Section header */}
      <div className="cl-inv-section">
        <h2>
          {activeTab === "inventory" ? "Assigned items" : "Recent refills"}
          <span className="count">{activeTab === "inventory" ? items.length : requests.length}</span>
        </h2>
        <div className="tabs">
          <button
            className={activeTab === "inventory" ? "active" : ""}
            onClick={() => setActiveTab("inventory")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
            Current
          </button>
          <button
            className={activeTab === "requests" ? "active" : ""}
            onClick={() => setActiveTab("requests")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            History
          </button>
        </div>
      </div>

      {activeTab === "inventory" && (
        <>
          {items.length === 0 ? (
            <div className="cl-empty-block">
              <div className="icon-bubble">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
              </div>
              <div>No items assigned yet. <a href="/my-inventory/checkout" style={{ color: "var(--primary)", textDecoration: "underline" }}>Pick up from storage.</a></div>
            </div>
          ) : (
            <div className="cl-inv-list">
              {items.map((item) => {
                const pct = Math.min(100, (item.quantity / Math.max(item.refillThreshold * 2, 1)) * 100);
                const threshPct = Math.min(100, (item.refillThreshold / Math.max(item.refillThreshold * 2, 1)) * 100);
                const statusCls = item.isOutOfStock ? "empty" : item.isLow ? "low" : "";
                const pillCls = item.isOutOfStock ? "empty" : item.isLow ? "low" : "ok";
                return (
                  <article key={item.id} className={`cl-inv-row ${statusCls}`}>
                    <div className="ir-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                    </div>

                    <div className="ir-meta">
                      <div className="name-row">
                        <span className="ir-name">{item.productName}</span>
                        <span className={`cl-pill ${pillCls}`}>
                          {item.isOutOfStock ? "Empty" : item.isLow ? "Low" : "OK"}
                        </span>
                      </div>
                      {item.productDescription && (
                        <p className="ir-desc">{item.productDescription}</p>
                      )}
                    </div>

                    <div className="ir-meter">
                      <div className="cl-inv-meter-head">
                        <span className="cl-inv-meter-qty">
                          {item.quantity}<span className="unit"> {item.unit}</span>
                        </span>
                        <span className="cl-inv-meter-thresh">Refill at {item.refillThreshold}</span>
                      </div>
                      <div className="cl-inv-meter-bar">
                        <div className="cl-inv-meter-fill" style={{ width: `${pct}%` }} />
                        {item.refillThreshold > 0 && (
                          <span className="cl-inv-meter-thresh-mark" style={{ left: `calc(${threshPct}% - 1px)` }} />
                        )}
                      </div>
                      <div className="ir-updated">
                        Updated {new Date(item.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>

                    <div className="ir-actions">
                      {item.isLow || item.isOutOfStock ? (
                        <button className="cl-inv-replenish" onClick={() => openRefill(item)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" /></svg>
                          Replenish
                        </button>
                      ) : (
                        <button className="cl-inv-replenish ghost" onClick={() => openRefill(item)}>Top up</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "requests" && (
        <div className="cl-table-wrap">
          <div className="cl-table-scroll">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="cl-empty-block" style={{ margin: 0, border: "none", borderRadius: 0 }}>
                        <p style={{ margin: 0, color: "var(--ink-soft)" }}>No refill requests yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                        {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td>{r.productName || r.kitName || "Item"}</td>
                      <td>{r.quantity}</td>
                      <td style={{ fontSize: 12, color: "var(--ink-soft)", maxWidth: 240 }}>{r.reason || "—"}</td>
                      <td>
                        <span className={`cl-pill ${r.status === "FULFILLED" ? "completed" : r.status === "REJECTED" ? "cancelled" : "pending"}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refill modal */}
      {refillItem && (
        <div className="cl-modal-overlay" onClick={closeRefill}>
          <div className="cl-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="cl-modal-head">
              <h2 className="cl-modal-title">Request refill: {refillItem.productName}</h2>
              <button className="cl-modal-close" onClick={closeRefill} aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="cl-modal-section">
              <div style={{ fontSize: 13, color: "var(--primary-60)", marginBottom: 14 }}>
                Current: {refillItem.quantity} {refillItem.unit} · Threshold: {refillItem.refillThreshold} {refillItem.unit}
              </div>
              <label className="cl-form-label">Quantity to request</label>
              <input
                className="cl-form-input"
                type="number"
                min="0"
                step="0.01"
                value={refillQuantity}
                onChange={(e) => setRefillQuantity(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="cl-modal-section">
              <label className="cl-form-label">Reason (optional)</label>
              <input
                className="cl-form-input"
                value={refillReason}
                onChange={(e) => setRefillReason(e.target.value)}
                placeholder="e.g. Running low for upcoming jobs"
              />
            </div>
            {feedback && (
              <div style={{
                padding: "12px 16px", borderRadius: 12, fontSize: 13, margin: "0 20px 8px",
                background: feedback.type === "success" ? "rgba(0,95,106,0.08)" : "#fee2e2",
                color: feedback.type === "success" ? "var(--primary)" : "#dc2626",
              }}>
                {feedback.text}
              </div>
            )}
            <div className="cl-modal-foot">
              <button className="cl-modal-cancel" onClick={closeRefill}>Cancel</button>
              <button className="cl-modal-confirm" onClick={submitRefill} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
