"use client";

import { useMemo, useState } from "react";

type Status = "PENDING_PAYMENT" | "ACTIVE" | "REDEEMED" | "REFUNDED" | "CANCELLED";

interface GiftCard {
  id: string;
  code: string;
  amount: number;
  status: Status;
  purchaserName: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail: string;
  personalMessage: string | null;
  coverKey: string;
  scheduledDeliveryDate: string | null;
  deliveredAt: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

interface Props {
  cards: GiftCard[];
}

const STATUS_TINT: Record<Status, { bg: string; fg: string }> = {
  PENDING_PAYMENT: { bg: "#f1f5f9", fg: "#475569" },
  ACTIVE: { bg: "#dcfce7", fg: "#166534" },
  REDEEMED: { bg: "#dbeafe", fg: "#1e40af" },
  REFUNDED: { bg: "#fef3c7", fg: "#854d0e" },
  CANCELLED: { bg: "#fee2e2", fg: "#991b1b" },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDay(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function GiftCardsAdminClient({ cards }: Props) {
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [open, setOpen] = useState<GiftCard | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (filter !== "ALL" && c.status !== filter) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.purchaserName.toLowerCase().includes(q) ||
        c.purchaserEmail.toLowerCase().includes(q) ||
        c.recipientName.toLowerCase().includes(q) ||
        c.recipientEmail.toLowerCase().includes(q)
      );
    });
  }, [cards, filter, search]);

  const stats = useMemo(() => {
    const active = cards.filter((c) => c.status === "ACTIVE");
    const redeemed = cards.filter((c) => c.status === "REDEEMED");
    return {
      activeCount: active.length,
      activeValue: active.reduce((s, c) => s + c.amount, 0),
      redeemedCount: redeemed.length,
      redeemedValue: redeemed.reduce((s, c) => s + c.amount, 0),
    };
  }, [cards]);

  return (
    <div className="cl-page-wrap">
      <div className="cl-page-head">
        <div>
          <h1 className="cl-page-title">Gift cards</h1>
          <p className="cl-page-sub">
            Every gift card purchased through the public landing page.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}>
        <StatCard label="Outstanding (unredeemed)" value={`$${stats.activeValue.toFixed(2)}`} sub={`${stats.activeCount} cards`} />
        <StatCard label="Redeemed total" value={`$${stats.redeemedValue.toFixed(2)}`} sub={`${stats.redeemedCount} cards`} />
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}>
        <input
          type="text"
          placeholder="Search by code, buyer, recipient…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "1 1 240px",
            padding: "8px 12px",
            fontSize: 13,
            border: "1px solid var(--primary-15)",
            borderRadius: 8,
          }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["ALL", "ACTIVE", "REDEEMED", "PENDING_PAYMENT", "REFUNDED", "CANCELLED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                background: filter === s ? "var(--primary)" : "#fff",
                color: filter === s ? "#fff" : "var(--ink)",
                border: "1px solid var(--primary-15)",
                borderRadius: 999,
                cursor: "pointer",
              }}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          background: "#fff",
          border: "1px solid var(--primary-10)",
          borderRadius: 14,
          overflow: "hidden",
        }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              fontSize: 14,
              color: "var(--primary-50)",
            }}>
            No gift cards match.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--primary-5)", textAlign: "left" }}>
                <th style={th}>Code</th>
                <th style={th}>From</th>
                <th style={th}>To</th>
                <th style={th}>Amount</th>
                <th style={th}>Status</th>
                <th style={th}>Delivery</th>
                <th style={th}>Purchased</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--primary-10)" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{c.code}</td>
                  <td style={td}>
                    <div style={{ fontSize: 13 }}>{c.purchaserName}</div>
                    <div style={{ fontSize: 11, color: "var(--primary-60)" }}>{c.purchaserEmail}</div>
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: 13 }}>{c.recipientName}</div>
                    <div style={{ fontSize: 11, color: "var(--primary-60)" }}>{c.recipientEmail}</div>
                  </td>
                  <td style={{ ...td, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    ${c.amount.toFixed(2)}
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: STATUS_TINT[c.status].bg,
                        color: STATUS_TINT[c.status].fg,
                      }}>
                      {c.status.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "var(--primary-60)" }}>
                    {c.deliveredAt
                      ? `Sent ${fmtDay(c.deliveredAt)}`
                      : c.scheduledDeliveryDate
                        ? `Scheduled ${fmtDay(c.scheduledDeliveryDate)}`
                        : "—"}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "var(--primary-60)" }}>
                    {fmtDate(c.createdAt)}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => setOpen(c)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        background: "var(--primary)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div
          onClick={() => setOpen(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              maxWidth: 480,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              maxHeight: "85vh",
              overflowY: "auto",
            }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>{open.code}</h2>
            <p style={{ marginTop: 2, fontSize: 13, color: "var(--primary-70)" }}>
              ${open.amount.toFixed(2)} · {open.coverKey} cover · {open.status.replace("_", " ")}
            </p>

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <DetailField label="From" value={`${open.purchaserName} (${open.purchaserEmail})`} />
              <DetailField label="To" value={`${open.recipientName} (${open.recipientEmail})`} />
              <DetailField label="Personal message" value={open.personalMessage ?? "—"} />
              <DetailField label="Purchased" value={fmtDate(open.createdAt)} />
              <DetailField label="Scheduled delivery" value={fmtDay(open.scheduledDeliveryDate) ?? "Immediate"} />
              <DetailField label="Delivered" value={fmtDate(open.deliveredAt) ?? "Not yet"} />
              <DetailField label="Redeemed" value={fmtDate(open.redeemedAt) ?? "Not yet"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--primary-10)",
        borderRadius: 14,
        padding: 16,
      }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary-60)" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div style={{ marginTop: 2, fontSize: 12, color: "var(--primary-60)" }}>{sub}</div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary-50)" }}>
        {label}
      </div>
      <div style={{ marginTop: 2, fontSize: 14, color: "var(--ink)", whiteSpace: "pre-wrap" }}>
        {value}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--primary-60)",
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  color: "var(--ink)",
};
