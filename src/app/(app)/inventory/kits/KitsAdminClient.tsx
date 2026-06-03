"use client";

import { useMemo, useState, useTransition } from "react";
import {
  assignToCleanerKit,
  removeFromCleanerKit,
} from "../../actions/assignToCleanerKit";

interface KitItem {
  employeeProductId: string;
  productId: string;
  productName: string;
  unit: string;
  category: string;
  quantity: number;
  masterStock: number;
}

interface Cleaner {
  id: string;
  name: string;
  email: string;
  kit: KitItem[];
}

interface Product {
  id: string;
  name: string;
  unit: string;
  stockLevel: number;
  category: string;
}

interface Props {
  cleaners: Cleaner[];
  products: Product[];
}

export default function KitsAdminClient({ cleaners, products }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    cleaners[0]?.id ?? null
  );
  const [search, setSearch] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cleaners;
    return cleaners.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [cleaners, search]);

  const selected = cleaners.find((c) => c.id === selectedId) ?? null;

  function add() {
    if (!selected || !addProductId || addQty <= 0) return;
    setBusy(true);
    setError(null);
    startTransition(async () => {
      const result = await assignToCleanerKit({
        cleanerId: selected.id,
        productId: addProductId,
        quantity: addQty,
      });
      setBusy(false);
      if (!result.success) {
        setError(result.error ?? "Failed to add");
        return;
      }
      setAddProductId("");
      setAddQty(1);
    });
  }

  function remove(item: KitItem) {
    if (!selected) return;
    const qty = Number(prompt(`Remove how many ${item.productName}?`, "1"));
    if (!qty || qty <= 0) return;
    setBusy(true);
    setError(null);
    startTransition(async () => {
      const result = await removeFromCleanerKit({
        cleanerId: selected.id,
        productId: item.productId,
        quantity: qty,
      });
      setBusy(false);
      if (!result.success) {
        setError(result.error ?? "Failed to remove");
      }
    });
  }

  return (
    <div className="cl-page-wrap">
      <div className="cl-page-head">
        <div>
          <h1 className="cl-page-title">Technician kits</h1>
          <p className="cl-page-sub">
            Assign items to each technician's personal kit. Master stock stays
            unchanged when you assign; it only drops when a technician reports
            damage or loss.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: 20,
        }}>
        {/* Cleaner list */}
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--primary-10)",
            borderRadius: 14,
            overflow: "hidden",
          }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--primary-10)" }}>
            <input
              type="text"
              placeholder="Search cleaners…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                border: "1px solid var(--primary-15)",
                borderRadius: 8,
              }}
            />
          </div>
          <div style={{ maxHeight: 540, overflowY: "auto" }}>
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                style={{
                  width: "100%",
                  display: "block",
                  padding: "12px 14px",
                  textAlign: "left",
                  background:
                    c.id === selectedId ? "var(--primary-5)" : "transparent",
                  borderTop: "1px solid var(--primary-10)",
                  cursor: "pointer",
                }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}>
                  {c.name}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 11,
                    color: "var(--primary-60)",
                  }}>
                  {c.kit.length} kit item{c.kit.length === 1 ? "" : "s"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected cleaner's kit */}
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--primary-10)",
            borderRadius: 14,
            padding: 20,
          }}>
          {!selected ? (
            <p style={{ fontSize: 14, color: "var(--primary-50)" }}>
              Pick a technician from the left to manage their kit.
            </p>
          ) : (
            <>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {selected.name}
              </h2>
              <p style={{ marginTop: 2, fontSize: 12, color: "var(--primary-60)" }}>
                {selected.email}
              </p>

              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: "var(--primary-5)",
                  borderRadius: 10,
                }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--primary-60)",
                    marginBottom: 10,
                  }}>
                  Add to kit
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}>
                  <select
                    value={addProductId}
                    onChange={(e) => setAddProductId(e.target.value)}
                    style={{
                      flex: "1 1 200px",
                      padding: "8px 12px",
                      fontSize: 13,
                      border: "1px solid var(--primary-15)",
                      borderRadius: 8,
                    }}>
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (master: {p.stockLevel} {p.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={addQty}
                    onChange={(e) => setAddQty(Math.max(1, Number(e.target.value)))}
                    style={{
                      width: 100,
                      padding: "8px 12px",
                      fontSize: 13,
                      border: "1px solid var(--primary-15)",
                      borderRadius: 8,
                    }}
                  />
                  <button
                    type="button"
                    onClick={add}
                    disabled={!addProductId || busy}
                    style={{
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      background:
                        !addProductId || busy ? "var(--primary-20)" : "var(--primary)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      cursor: !addProductId || busy ? "default" : "pointer",
                    }}>
                    {busy ? "…" : "Add"}
                  </button>
                </div>
                {error && (
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "#dc2626",
                    }}>
                    {error}
                  </p>
                )}
              </div>

              {selected.kit.length === 0 ? (
                <p style={{ marginTop: 20, fontSize: 13, color: "var(--primary-50)" }}>
                  No items in this technician's kit yet.
                </p>
              ) : (
                <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid var(--primary-10)",
                      }}>
                      <th style={th}>Product</th>
                      <th style={th}>In kit</th>
                      <th style={th}>Master stock</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.kit.map((item) => (
                      <tr
                        key={item.employeeProductId}
                        style={{ borderBottom: "1px solid var(--primary-10)" }}>
                        <td style={td}>{item.productName}</td>
                        <td
                          style={{
                            ...td,
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}>
                          {item.quantity} {item.unit}
                        </td>
                        <td
                          style={{
                            ...td,
                            fontSize: 12,
                            color: "var(--primary-60)",
                            fontVariantNumeric: "tabular-nums",
                          }}>
                          {item.masterStock} {item.unit}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => remove(item)}
                            disabled={busy}
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              background: "#fff",
                              color: "var(--primary-70)",
                              border: "1px solid var(--primary-15)",
                              borderRadius: 6,
                              cursor: busy ? "default" : "pointer",
                            }}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--primary-60)",
};

const td: React.CSSProperties = {
  padding: "10px",
  fontSize: 13,
  color: "var(--ink)",
};
