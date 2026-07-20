"use client";

// Quote requests — Cleano "Quote requests" design, re-skinned to the Fixaro
// charcoal/orange palette (A): eyebrow/serif header, status tabs, table, and a
// right-side detail drawer (status workflow + notes + convert). Wired to the
// real quoteRequest data + updateQuoteStatus.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, MapPin, Sparkles, Home, CalendarClock, Clock, X, ArrowRight, Image as ImageIcon } from "lucide-react";
import { updateQuoteStatus } from "../actions/updateQuoteStatus";
import { convertQuote } from "../actions/convertQuote";
import { saveQuotedPrice } from "./actions/saveQuotedPrice";
import { useServiceLabel, useServiceCatalog } from "@/lib/config/ServiceConfigProvider";
import { buildIntakeRows } from "@/lib/intake";
import { TIME_SLOTS } from "@/app/(book)/book/types";

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
  paintRepairArea: string | null;
  paintRepairSurface: string | null;
  acType: string | null;
  acLocation: string | null;
  acMountType: string | null;
  clientHasAcUnit: boolean | null;
  photoUrls: string[];
  status: Status;
  notes: string | null;
  /** Phase 2D — the agreed price ops recorded, and the job it became. */
  quotedPrice: number | null;
  convertedJobId: string | null;
  createdAt: string;
}

// serviceType stores the catalog value (e.g. "AC_INSTALLATION"); legacy rows may
// hold the old free-text label. useServiceLabel() maps it against the LIVE
// catalog, falling back to the raw value so nothing renders blank.

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
  const serviceLabel = useServiceLabel();
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
                  <td style={{ whiteSpace: "normal", maxWidth: 200 }}><div style={{ fontWeight: 500 }}>{serviceLabel(q.serviceType)}</div>{q.photoUrls.length > 0 && <div style={{ fontSize: 12, color: "var(--primary-60)", marginTop: 2, display: "inline-flex", alignItems: "center", gap: 4 }}><ImageIcon size={12} /> {q.photoUrls.length} photo{q.photoUrls.length === 1 ? "" : "s"}</div>}{q.quotedPrice != null && <div style={{ fontSize: 12, color: "var(--primary-60)", marginTop: 2 }}>${q.quotedPrice.toFixed(2)} + tax</div>}</td>
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

      {open && <QuoteDrawer quote={open} pending={pending} onClose={() => setOpen(null)} onSave={save} />}
    </div>
  );
}

function QuoteDrawer({ quote, pending, onClose, onSave }: {
  quote: Quote; pending: boolean; onClose: () => void; onSave: (id: string, status: Status, notes: string) => void;
}) {
  const serviceLabel = useServiceLabel();
  const router = useRouter();
  const catalog = useServiceCatalog();
  const [notes, setNotes] = useState(quote.notes ?? "");

  // ── Convert to job (Phase 2D) ────────────────────────────────────────────
  // The old button was `router.push("/jobs/new")` — a blank form. Ops now record
  // the agreed price, date and start time here and the server builds the job
  // from the quote's own client, address, service, intake answers and photos.
  const converted = quote.status === "CONVERTED" || quote.convertedJobId != null;
  const [price, setPrice] = useState(quote.quotedPrice != null ? String(quote.quotedPrice) : "");
  // The quote's preferred date is stored as midnight UTC of the business-tz
  // calendar date, so slicing the ISO string yields the key the picker wants.
  const [date, setDate] = useState(quote.preferredDate ? quote.preferredDate.slice(0, 10) : "");
  const [slot, setSlot] = useState(TIME_SLOTS[0]);
  // Legacy quotes may hold a free-text label that no longer resolves; the server
  // rejects those, so ops pick a live catalog service here.
  const catalogHasService = catalog.some((s) => s.value === quote.serviceType);
  const [serviceType, setServiceType] = useState(catalogHasService ? quote.serviceType! : "");
  const [busy, setBusy] = useState<"price" | "convert" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSavePrice() {
    setBusy("price");
    setMsg(null);
    const res = await saveQuotedPrice({
      quoteId: quote.id,
      quotedPrice: price.trim() === "" ? null : Number(price),
    });
    setBusy(null);
    setMsg({ ok: res.success, text: res.success ? "Quoted price saved." : res.error ?? "Failed to save" });
    if (res.success) router.refresh();
  }

  async function handleConvert() {
    setBusy("convert");
    setMsg(null);
    const res = await convertQuote({
      quoteId: quote.id,
      quotedPrice: Number(price),
      date,
      timeSlot: slot,
      serviceType: serviceType || undefined,
    });
    setBusy(null);
    if (!res.success) {
      setMsg({ ok: false, text: res.error ?? "Could not convert this quote." });
      return;
    }
    if (res.jobId) {
      router.push(`/jobs/${res.jobId}`);
      return;
    }
    setMsg({ ok: true, text: "This quote was already converted." });
    router.refresh();
  }

  const intakeRows = buildIntakeRows(quote);
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
            <div className="q-row"><span className="q-k"><Sparkles size={15} /> Service</span><span className="q-v">{serviceLabel(quote.serviceType)}</span></div>
            {property !== "—" && <div className="q-row"><span className="q-k"><Home size={15} /> Property</span><span className="q-v">{property}</span></div>}
            {quote.preferredDate && <div className="q-row"><span className="q-k"><CalendarClock size={15} /> Preferred</span><span className="q-v">{new Date(quote.preferredDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span></div>}
            <div className="q-row"><span className="q-k"><Clock size={15} /> Received</span><span className="q-v">{dDay(quote.createdAt)} · {dTime(quote.createdAt)}</span></div>
          </div>

          {/* Service-specific intake (SOP v4.2 §4). */}
          {intakeRows.length > 0 && (
            <>
              <div className="q-section-label">Service intake</div>
              <div className="q-rows">
                {intakeRows.map((r) => (
                  <div className="q-row" key={r.label}><span className="q-k">{r.label}</span><span className="q-v">{r.value}</span></div>
                ))}
              </div>
            </>
          )}

          {/* Customer photos (SOP v4.2 §4). */}
          {quote.photoUrls.length > 0 && (
            <>
              <div className="q-section-label">Customer photos · {quote.photoUrls.length}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {quote.photoUrls.map((url, i) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: 88, height: 88, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,0,0,0.1)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Customer photo ${i + 1}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </a>
                ))}
              </div>
            </>
          )}

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

          <div className="q-section-label">Quoted price &amp; conversion</div>
          {converted ? (
            <div style={{ fontSize: 13, color: "var(--primary-70)", lineHeight: 1.55 }}>
              Converted{quote.quotedPrice != null ? ` at $${quote.quotedPrice.toFixed(2)} + tax` : ""}.
              {quote.convertedJobId ? (
                <>
                  {" "}
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={() => router.push(`/jobs/${quote.convertedJobId}`)}>
                    <ArrowRight size={14} /> Open job
                  </button>
                </>
              ) : null}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--primary-60)" }}>
                Agreed price (before tax)
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy !== null || pending}
                    onClick={handleSavePrice}>
                    {busy === "price" ? "Saving…" : "Save price"}
                  </button>
                </div>
              </label>

              {!catalogHasService && (
                <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--primary-60)" }}>
                  Service (this quote&apos;s service isn&apos;t in the current catalog)
                  <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                    <option value="">Choose a service…</option>
                    {catalog.filter((s) => s.active).map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </label>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--primary-60)", flex: 1 }}>
                  Date
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--primary-60)", flex: 1 }}>
                  Start time
                  <select value={slot} onChange={(e) => setSlot(e.target.value)}>
                    {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>

              <p style={{ fontSize: 12, color: "var(--primary-60)", margin: 0, lineHeight: 1.5 }}>
                Creates a scheduled job with this client, address, service, intake
                answers and photos at the agreed price plus tax, and marks the
                quote converted. This can only happen once.
              </p>

              <button
                className="btn btn-primary btn-block"
                disabled={busy !== null || pending || !price.trim() || !date}
                onClick={handleConvert}>
                <ArrowRight size={15} /> {busy === "convert" ? "Converting…" : "Convert to job"}
              </button>
            </div>
          )}
          {msg && (
            <p style={{ fontSize: 12.5, margin: 0, color: msg.ok ? "#065f46" : "#b91c1c" }}>{msg.text}</p>
          )}
        </div>

        <div className="q-drawer-foot">
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => onSave(quote.id, quote.status, notes)}>{pending ? "Saving…" : "Save notes"}</button>
        </div>
      </aside>
    </div>
  );
}
