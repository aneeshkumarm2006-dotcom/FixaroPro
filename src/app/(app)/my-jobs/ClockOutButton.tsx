"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { clockOut } from "../actions/clockOut";
import { requestRefill } from "../actions/requestRefill";

interface InventoryRule {
  usagePerJob: number;
  refillThreshold: number;
}

interface EmployeeProduct {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    unit: string;
    inventoryRule?: InventoryRule | null;
  };
}

interface ClockOutButtonProps {
  jobId: string;
  employeeProducts: EmployeeProduct[];
}

export default function ClockOutButton({ jobId, employeeProducts }: ClockOutButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inventories, setInventories] = useState<Record<string, string>>({});
  const [refillingId, setRefillingId] = useState<string | null>(null);
  const [refillDone, setRefillDone] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    const init: Record<string, string> = {};
    employeeProducts.forEach((ep) => { init[ep.productId] = ep.quantity.toString(); });
    setInventories(init);
    setRefillDone({});
    setOpen(true);
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const productInventories = employeeProducts
        .map((ep) => ({
          productId: ep.productId,
          inventoryAfter: parseFloat(inventories[ep.productId] ?? "0"),
        }))
        .filter((inv) => !isNaN(inv.inventoryAfter));

      const result = await clockOut(jobId, productInventories);
      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error || "Failed to clock out");
      }
    } catch {
      setError("Failed to clock out");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefill(ep: EmployeeProduct) {
    setRefillingId(ep.productId);
    setError(null);
    try {
      const usagePerJob = ep.product.inventoryRule?.usagePerJob ?? 0;
      const qty = usagePerJob > 0 ? Math.max(usagePerJob * 5, 1) : 1;
      const result = await requestRefill({
        productId: ep.productId,
        quantity: qty,
        reason: `Low stock during clock-out for job ${jobId}`,
      });
      if (result.success) {
        setRefillDone((prev) => ({ ...prev, [ep.productId]: true }));
      } else {
        setError(result.error || "Failed to request refill");
      }
    } catch {
      setError("Failed to request refill");
    } finally {
      setRefillingId(null);
    }
  }

  const modal = open ? (
    <div className="co-overlay" onClick={() => !loading && setOpen(false)}>
      <div className="co-sheet" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="co-head">
          <div className="co-head-left">
            <span className="co-head-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </span>
            <div>
              <h2 className="co-title">Clock out</h2>
              <p className="co-subtitle">Update your remaining supply levels before finishing.</p>
            </div>
          </div>
          <button className="co-close" onClick={() => !loading && setOpen(false)} aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Product list */}
        <div className="co-body">
          {employeeProducts.length === 0 ? (
            <div className="co-empty">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              <p>No products assigned to you.</p>
            </div>
          ) : (
            employeeProducts.map((ep) => {
              const current = parseFloat(inventories[ep.productId] ?? "0");
              const used = isNaN(current) ? 0 : Math.max(0, ep.quantity - current);
              const remaining = isNaN(current) ? ep.quantity : current;
              const threshold = ep.product.inventoryRule?.refillThreshold ?? 0;
              const usagePerJob = ep.product.inventoryRule?.usagePerJob ?? 0;
              const isOut = remaining <= 0;
              const isLow = !isOut && threshold > 0 && remaining < threshold;

              return (
                <div key={ep.productId} className={`co-product${isOut ? " danger" : isLow ? " warn" : ""}`}>
                  <div className="co-product-top">
                    <span className="co-product-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      </svg>
                    </span>
                    <div className="co-product-info">
                      <span className="co-product-name">{ep.product.name}</span>
                      <span className="co-product-sub">Started with {ep.quantity} {ep.product.unit}</span>
                    </div>
                    {isOut && <span className="co-badge danger">Out of stock</span>}
                    {isLow && <span className="co-badge warn">Low stock</span>}
                  </div>

                  <div className="co-input-row">
                    <label className="co-input-label">
                      Remaining {ep.product.unit}
                    </label>
                    <input
                      className="co-input"
                      type="number"
                      step="0.01"
                      min="0"
                      max={ep.quantity}
                      value={inventories[ep.productId] ?? ""}
                      onChange={(e) =>
                        setInventories((prev) => ({ ...prev, [ep.productId]: e.target.value }))
                      }
                      placeholder="Enter remaining quantity"
                    />
                    {usagePerJob > 0 && (
                      <span className="co-input-hint">Avg usage: {usagePerJob} {ep.product.unit} per job</span>
                    )}
                  </div>

                  <div className="co-stats">
                    <div className="co-stat">
                      <span className="lbl">Used</span>
                      <span className="val">{used > 0 ? used.toFixed(2) : "0"} {ep.product.unit}</span>
                    </div>
                    <div className={`co-stat${isOut ? " danger" : isLow ? " warn" : ""}`}>
                      <span className="lbl">Remaining</span>
                      <span className="val">{isNaN(current) ? "—" : current.toFixed(2)} {ep.product.unit}</span>
                    </div>
                  </div>

                  {(isOut || isLow) && (
                    <div className="co-refill">
                      {refillDone[ep.productId] ? (
                        <span className="co-refill-done">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Replenishment requested
                        </span>
                      ) : (
                        <button
                          className="co-refill-btn"
                          onClick={() => handleRefill(ep)}
                          disabled={refillingId === ep.productId}
                        >
                          {refillingId === ep.productId ? "Requesting…" : "Replenish — pick up from warehouse"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {error && (
          <div style={{
            margin: "0 16px 12px",
            fontSize: 13,
            color: "#dc2626",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 10,
            padding: "10px 12px",
          }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="co-footer">
          <button className="co-btn-ghost" onClick={() => !loading && setOpen(false)} disabled={loading}>
            Cancel
          </button>
          <button className="co-btn-confirm" onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "co-spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Clocking out…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                Confirm clock out
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button className="cl-jd-clock out" onClick={handleOpen}>
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
        Clock Out
      </button>
      {typeof window !== "undefined" && modal
        ? createPortal(modal, document.body)
        : null}
    </>
  );
}
