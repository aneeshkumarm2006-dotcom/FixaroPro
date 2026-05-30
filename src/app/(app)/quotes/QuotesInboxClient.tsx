"use client";

import { useMemo, useState, useTransition } from "react";
import { updateQuoteStatus } from "../actions/updateQuoteStatus";

type Status = "NEW" | "CONTACTED" | "CONVERTED" | "ARCHIVED";

interface Quote {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  serviceType: string | null;
  bedCount: number | null;
  bathCount: number | null;
  squareFootage: number | null;
  preferredDate: string | null;
  message: string | null;
  status: Status;
  notes: string | null;
  createdAt: string;
}

interface Props {
  quotes: Quote[];
}

const STATUS_OPTIONS: Status[] = ["NEW", "CONTACTED", "CONVERTED", "ARCHIVED"];

const STATUS_TINT: Record<Status, { bg: string; fg: string }> = {
  NEW: { bg: "#fef3c7", fg: "#854d0e" },
  CONTACTED: { bg: "#dbeafe", fg: "#1e40af" },
  CONVERTED: { bg: "#dcfce7", fg: "#166534" },
  ARCHIVED: { bg: "#f1f5f9", fg: "#475569" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function QuotesInboxClient({ quotes }: Props) {
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [open, setOpen] = useState<Quote | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (filter === "ALL") return quotes;
    return quotes.filter((q) => q.status === filter);
  }, [quotes, filter]);

  function setStatus(quoteId: string, status: Status, notes?: string) {
    startTransition(async () => {
      const result = await updateQuoteStatus({ quoteId, status, notes });
      if (!result.success) alert(result.error ?? "Failed to update");
      else setOpen(null);
    });
  }

  return (
    <div className="cl-page-wrap">
      <div className="cl-page-head">
        <div>
          <h1 className="cl-page-title">Quote requests</h1>
          <p className="cl-page-sub">
            Submissions from the public quote landing page. Triage and convert.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["ALL", ...STATUS_OPTIONS] as const).map((s) => (
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
              {s}
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
              color: "var(--primary-50)",
              fontSize: 14,
            }}>
            No quote requests yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--primary-5)", textAlign: "left" }}>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Service</th>
                <th style={th}>Received</th>
                <th style={th}>Status</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr
                  key={q.id}
                  style={{ borderTop: "1px solid var(--primary-10)" }}>
                  <td style={td}>{q.name}</td>
                  <td style={{ ...td, fontSize: 12, color: "var(--primary-70)" }}>
                    {q.email}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "var(--primary-60)" }}>
                    {q.serviceType ?? "—"}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "var(--primary-60)" }}>
                    {fmtDate(q.createdAt)}
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: STATUS_TINT[q.status].bg,
                        color: STATUS_TINT[q.status].fg,
                      }}>
                      {q.status}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => setOpen(q)}
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
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <QuoteDrawer
          quote={open}
          onClose={() => setOpen(null)}
          onStatus={(s, n) => setStatus(open.id, s, n)}
        />
      )}
    </div>
  );
}

function QuoteDrawer({
  quote,
  onClose,
  onStatus,
}: {
  quote: Quote;
  onClose: () => void;
  onStatus: (status: Status, notes?: string) => void;
}) {
  const [notes, setNotes] = useState(quote.notes ?? "");
  return (
    <div
      onClick={onClose}
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
          maxWidth: 560,
          width: "100%",
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{quote.name}</h2>
        <p style={{ marginTop: 4, fontSize: 13, color: "var(--primary-70)" }}>
          {quote.email}
          {quote.phone ? ` · ${quote.phone}` : ""}
        </p>

        <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
          <Field label="Service" value={quote.serviceType ?? "—"} />
          <Field label="Address" value={quote.address ?? "—"} />
          <Field
            label="Property"
            value={[
              quote.bedCount != null ? `${quote.bedCount} bed` : null,
              quote.bathCount != null ? `${quote.bathCount} bath` : null,
              quote.squareFootage ? `${quote.squareFootage} sq ft` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          />
          <Field
            label="Preferred date"
            value={
              quote.preferredDate
                ? new Date(quote.preferredDate).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"
            }
          />
          <Field label="Message" value={quote.message ?? "—"} />
        </div>

        <label
          style={{
            display: "block",
            marginTop: 16,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--primary-70)",
          }}>
          Internal notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{
            marginTop: 4,
            width: "100%",
            padding: "8px 12px",
            fontSize: 14,
            border: "1px solid var(--primary-15)",
            borderRadius: 8,
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />

        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatus(s, notes)}
              disabled={s === quote.status}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                background:
                  s === quote.status ? "var(--primary-10)" : "var(--primary)",
                color: s === quote.status ? "var(--primary-50)" : "#fff",
                border: "none",
                borderRadius: 8,
                cursor: s === quote.status ? "default" : "pointer",
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--primary-50)",
        }}>
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
