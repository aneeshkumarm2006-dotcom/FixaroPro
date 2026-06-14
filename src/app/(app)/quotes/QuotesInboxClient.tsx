"use client";

// Quote requests — Cleano "Quote requests" design, re-skinned to the Fixaro
// charcoal/orange palette (A): eyebrow/serif header, status tabs, table, and a
// right-side detail drawer (status workflow + notes + convert). Wired to the
// real quoteRequest data + updateQuoteStatus.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, MapPin, Sparkles, Home, CalendarClock, Clock, X, ArrowRight } from "lucide-react";
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

const ORDER: Status[] = ["NEW", "CONTACTED", "CONVERTED", "ARCHIVED"];
const STATUS_META: Record<Status, { label: string; dot: string; bg: string; fg: string }> = {
  NEW: { label: "New", dot: "#2f6fae", bg: "#dbeafe", fg: "#1e40af" },
  CONTACTED: { label: "Contacted", dot: "#d97706", bg: "#fffbeb", fg: "#92400e" },
  CONVERTED: { label: "Converted", dot: "#059669", bg: "#d1fae5", fg: "#065f46" },
  ARCHIVED: { label: "Archived", dot: "#64748b", bg: "#f1f5f9", fg: "#475569" },
};

const dDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const dTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return <span className="pill" style={{ background: m.bg, color: m.fg }}><span className="pill-dot" style={{ background: m.dot }} />{m.label}</span>;
}

export default function QuotesInboxClient({ quotes }: { quotes: Quote[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Status | "ALL">("ALL");
  const [open, setOpen] = useState<Quote | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const m: Record<string, number> = { ALL: quotes.length };
    ORDER.forEach((s) => { m[s] = quotes.filter((q) => q.status === s).length; });
    return m;
  }, [quotes]);
  const TABS: { id: Status | "ALL"; label: string }[] = [
    { id: "ALL", label: "All" },
    ...ORDER.map((s) => ({ id: s, label: STATUS_META[s].label })),
  ];
  const visible = tab === "ALL" ? quotes : quotes.filter((q) => q.status === tab);

  function save(quoteId: string, status: Status, notes: string) {
    startTransition(async () => {
      const res = await updateQuoteStatus({ quoteId, status, notes });
      if (!res.success) { alert(res.error ?? "Failed to update"); return; }
      setOpen(null);
      router.refresh();
    });
  }

  return (
    <div className="admin-font">
      <header style={{ marginBottom: 22 }}>
        <p className="eyebrow">Operations</p>
        <h1 className="display" style={{ fontSize: "clamp(32px, 4.2vw, 46px)", marginTop: 6 }}>
          Quote requests <span style={{ color: "var(--primary-40)", fontWeight: 300, fontFamily: "var(--font-serif)" }}>· {quotes.length}</span>
        </h1>
        <p className="subtitle" style={{ marginTop: 10, fontSize: 15.5 }}>Inbound estimate requests from the website. Review, quote, and convert to jobs.</p>
      </header>

      <div className="atabs">
        {TABS.map((t) => (
          <button key={t.id} className={`atab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
            {(counts[t.id] ?? 0) > 0 && <span className="atab-count">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      <div className="atable-wrap" style={{ marginTop: 18 }}>
        <div className="atable-scroll">
          <table className="atable">
            <thead><tr><th>Name</th><th>Contact</th><th>Service</th><th>Received</th><th>Status</th><th className="col-actions" /></tr></thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 56, color: "var(--primary-50)" }}>No {tab === "ALL" ? "" : STATUS_META[tab].label.toLowerCase() + " "}quote requests.</td></tr>
              ) : visible.map((q) => (
                <tr key={q.id} onClick={() => setOpen(q)} style={{ cursor: "pointer" }}>
                  <td className="col-client">{q.name}{q.address && <div className="col-client-sub">{q.address.split(",")[0]}</div>}</td>
                  <td style={{ whiteSpace: "normal" }}><div style={{ fontSize: 13 }}>{q.email}</div>{q.phone && <div style={{ fontSize: 12, color: "var(--primary-60)", marginTop: 2 }}>{q.phone}</div>}</td>
                  <td style={{ whiteSpace: "normal", maxWidth: 200 }}><div style={{ fontWeight: 500 }}>{q.serviceType ?? "—"}</div>{(q.bedCount != null || q.bathCount != null || q.squareFootage) && <div style={{ fontSize: 12, color: "var(--primary-60)", marginTop: 2 }}>{[q.bedCount != null ? `${q.bedCount}bd` : null, q.bathCount != null ? `${q.bathCount}ba` : null, q.squareFootage ? `${q.squareFootage} ft²` : null].filter(Boolean).join(" · ")}</div>}</td>
                  <td className="col-date"><div className="date-line">{dDay(q.createdAt)}</div><div className="time-line">{dTime(q.createdAt)}</div></td>
                  <td><StatusPill status={q.status} /></td>
                  <td className="col-actions" onClick={(e) => e.stopPropagation()}><button className="btn btn-secondary btn-sm" onClick={() => setOpen(q)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="apager"><span>{visible.length} {visible.length === 1 ? "request" : "requests"}</span><span /></div>
      </div>

      {open && <QuoteDrawer quote={open} pending={pending} onClose={() => setOpen(null)} onSave={save} onConvert={() => router.push("/jobs/new")} />}
    </div>
  );
}

function QuoteDrawer({ quote, pending, onClose, onSave, onConvert }: {
  quote: Quote; pending: boolean; onClose: () => void; onSave: (id: string, status: Status, notes: string) => void; onConvert: () => void;
}) {
  const [notes, setNotes] = useState(quote.notes ?? "");
  const property = [
    quote.bedCount != null ? `${quote.bedCount} bed` : null,
    quote.bathCount != null ? `${quote.bathCount} bath` : null,
    quote.squareFootage ? `${quote.squareFootage} ft²` : null,
  ].filter(Boolean).join(" · ") || "—";
  return (
    <div className="q-drawer-overlay" onClick={() => !pending && onClose()}>
      <aside className="q-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="q-drawer-head">
          <div>
            <h3 className="q-drawer-title">{quote.name}</h3>
            <div className="q-drawer-sub">{quote.id}</div>
          </div>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={onClose}><X size={16} /></button>
        </div>

        <div className="q-drawer-body">
          <StatusPill status={quote.status} />

          <div className="q-rows">
            <div className="q-row"><span className="q-k"><Mail size={15} /> Email</span><a className="q-v" href={`mailto:${quote.email}`}>{quote.email}</a></div>
            {quote.phone && <div className="q-row"><span className="q-k"><Phone size={15} /> Phone</span><a className="q-v" href={`tel:${quote.phone}`}>{quote.phone}</a></div>}
            {quote.address && <div className="q-row"><span className="q-k"><MapPin size={15} /> Address</span><span className="q-v">{quote.address}</span></div>}
            <div className="q-row"><span className="q-k"><Sparkles size={15} /> Service</span><span className="q-v">{quote.serviceType ?? "—"}</span></div>
            <div className="q-row"><span className="q-k"><Home size={15} /> Property</span><span className="q-v">{property}</span></div>
            {quote.preferredDate && <div className="q-row"><span className="q-k"><CalendarClock size={15} /> Preferred</span><span className="q-v">{new Date(quote.preferredDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span></div>}
            <div className="q-row"><span className="q-k"><Clock size={15} /> Received</span><span className="q-v">{dDay(quote.createdAt)} · {dTime(quote.createdAt)}</span></div>
          </div>

          {quote.message && (
            <div className="q-message">
              <div className="q-message-label">Customer message</div>
              <p>{quote.message}</p>
            </div>
          )}

          <div className="q-section-label">Status</div>
          <div className="q-status-grid">
            {ORDER.map((s) => {
              const m = STATUS_META[s];
              const on = quote.status === s;
              return (
                <button key={s} className={`q-status-btn ${on ? "on" : ""}`} disabled={pending || on}
                  style={on ? { background: m.bg, color: m.fg, borderColor: m.dot } : undefined}
                  onClick={() => onSave(quote.id, s, notes)}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: m.dot }} />{m.label}
                </button>
              );
            })}
          </div>

          <div className="q-section-label">Internal notes</div>
          <textarea rows={4} placeholder="Quote amount, follow-up details…" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <button className="btn btn-secondary btn-block" style={{ marginTop: 4 }} onClick={onConvert}>
            <ArrowRight size={15} /> Convert to job
          </button>
        </div>

        <div className="q-drawer-foot">
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => onSave(quote.id, quote.status, notes)}>{pending ? "Saving…" : "Save notes"}</button>
        </div>
      </aside>
    </div>
  );
}
