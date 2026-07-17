"use client";

// Activity Log — Cleano "Activity log" design, re-skinned to the Fixaro
// charcoal/orange palette (A). Wired to the real ActivityLog Prisma model:
// the parent server component queries db.activityLog and passes a serialized,
// admin-guarded window of rows plus all-time health counts. Merged audit
// timeline with rich filters (date range, category multi-select, status,
// search) + a detail drawer surfacing each row's message / error / metadata.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock, ChevronRight, ChevronLeft, Check, X, AlertCircle,
  Search, Send, CheckCircle2, XCircle, Clock, type LucideIcon,
} from "lucide-react";

type Status = "SUCCESS" | "FAILED" | "PENDING" | "SKIPPED";
type Category = "EMAIL" | "SMS" | "PAYMENT" | "REFUND" | "DEPOSIT" | "WEBHOOK" | "AUTH" | "BOOKING" | "ADMIN" | "CRON" | "SYSTEM";

// Shape of one serialized ActivityLog row handed down from the server.
export interface ActivityRow {
  id: string;
  createdAt: string; // ISO
  category: Category;
  action: string;
  status: Status;
  message: string | null;
  recipient: string | null;
  subject: string | null;
  actorLabel: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  amount: number | null;
  providerId: string | null;
  error: string | null;
  metadata: unknown;
}

// All-time totals for the health cards (independent of the loaded window).
export interface HealthCounts {
  emailsSent: number;
  emailsFailed: number;
  emailsPending: number;
  activityOk: number;
  activityFailed: number;
}

const STATUS_META: Record<Status, { bg: string; fg: string; dot: string; label: string }> = {
  SUCCESS: { bg: "#d1fae5", fg: "#065f46", dot: "#059669", label: "Success" },
  FAILED: { bg: "#fef2f2", fg: "#991b1b", dot: "#dc2626", label: "Failed" },
  PENDING: { bg: "#fffbeb", fg: "#92400e", dot: "#d97706", label: "Pending" },
  SKIPPED: { bg: "#f1f5f9", fg: "#334155", dot: "#94a3b8", label: "Skipped" },
};
const STATUS_FALLBACK = { bg: "#f1f5f9", fg: "#334155", dot: "#94a3b8", label: "—" };
const statusMeta = (s: Status) => STATUS_META[s] ?? STATUS_FALLBACK;

const CATEGORY_META: Record<Category, { color: string; label: string }> = {
  EMAIL: { color: "#0284c7", label: "Email" },
  SMS: { color: "#7c3aed", label: "SMS" },
  PAYMENT: { color: "#059669", label: "Payment" },
  REFUND: { color: "#d97706", label: "Refund" },
  DEPOSIT: { color: "#0d9488", label: "Deposit" },
  WEBHOOK: { color: "#6366f1", label: "Webhook" },
  AUTH: { color: "#be185d", label: "Auth" },
  BOOKING: { color: "#e85d04", label: "Booking" },
  ADMIN: { color: "#64748b", label: "Admin" },
  CRON: { color: "#9333ea", label: "Cron" },
  SYSTEM: { color: "#475569", label: "System" },
};
const CATEGORY_FALLBACK = { color: "#475569", label: "Other" };
const catMeta = (c: Category) => CATEGORY_META[c] ?? CATEGORY_FALLBACK;
const CATEGORY_ORDER: Category[] = ["EMAIL", "SMS", "PAYMENT", "REFUND", "DEPOSIT", "WEBHOOK", "AUTH", "BOOKING", "ADMIN", "CRON", "SYSTEM"];

// ── helpers ──
const money = (n: number) => "$" + n.toFixed(2);
const dateStr = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const timeStr = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function sameDay(a: Date | null, b: Date | null) { return !!a && !!b && startOfDay(a).getTime() === startOfDay(b).getTime(); }
function hasMetadata(m: unknown): boolean {
  if (m == null) return false;
  if (typeof m === "object") return Object.keys(m as object).length > 0;
  return true;
}

const PRESETS = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
] as const;
type PresetId = (typeof PRESETS)[number]["id"] | "custom";
function presetRange(id: PresetId): [Date | null, Date | null] {
  const now = new Date();
  const end = endOfDay(now);
  const s = startOfDay(now);
  if (id === "today") return [s, end];
  if (id === "7d") { s.setDate(s.getDate() - 6); return [s, end]; }
  if (id === "30d") { s.setDate(s.getDate() - 29); return [s, end]; }
  return [null, null];
}
function pageWindow(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const s = Math.max(2, page - 1), e = Math.min(count - 1, page + 1);
  if (s > 2) out.push("…");
  for (let i = s; i <= e; i++) out.push(i);
  if (e < count - 1) out.push("…");
  out.push(count);
  return out;
}

function StatusBadge({ status }: { status: Status }) {
  const m = statusMeta(status);
  return <span className="pill" style={{ background: m.bg, color: m.fg }}><span className="pill-dot" style={{ background: m.dot }} />{m.label}</span>;
}

interface RangeVal { preset: PresetId; from: Date | null; to: Date | null }

function DateRange({ value, onChange }: { value: RangeVal; onChange: (v: RangeVal) => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => new Date());
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const label = value.preset === "custom" && value.from
    ? `${fmtDay(value.from)} – ${value.to ? fmtDay(value.to) : "…"}`
    : (PRESETS.find((p) => p.id === value.preset) || PRESETS[0]).label;

  function pickDay(day: Date) {
    if (value.preset !== "custom" || !value.from || (value.from && value.to)) onChange({ preset: "custom", from: day, to: null });
    else if (day < value.from) onChange({ preset: "custom", from: day, to: value.from });
    else onChange({ preset: "custom", from: value.from, to: day });
  }

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startDow = first.getDay();
  const dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
  const inRange = (d: Date) => !!value.from && !!value.to && d > startOfDay(value.from) && d < startOfDay(value.to);

  return (
    <div className="act-pop-wrap" ref={ref}>
      <button className={`act-control ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)}>
        <CalendarClock size={15} /><span>{label}</span>
        <ChevronRight size={14} style={{ transform: "rotate(90deg)", opacity: 0.5 }} />
      </button>
      {open && (
        <div className="act-pop act-pop-date">
          <div className="act-presets">
            {PRESETS.map((p) => <button key={p.id} className={`act-preset ${value.preset === p.id ? "active" : ""}`} onClick={() => { onChange({ preset: p.id, from: null, to: null }); setOpen(false); }}>{p.label}</button>)}
            <div className="act-preset-note">Or pick a custom range →</div>
          </div>
          <div className="act-cal">
            <div className="act-cal-head">
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><ChevronLeft size={15} /></button>
              <strong>{view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><ChevronRight size={15} /></button>
            </div>
            <div className="act-cal-grid act-cal-dow">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
            <div className="act-cal-grid">
              {cells.map((d, i) => d ? (
                <button key={i} className={`act-day ${sameDay(d, value.from) || sameDay(d, value.to) ? "edge" : ""} ${inRange(d) ? "in" : ""}`} onClick={() => pickDay(d)}>{d.getDate()}</button>
              ) : <span key={i} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryDropdown({ selected, onChange, counts }: { selected: Set<Category>; onChange: (s: Set<Category>) => void; counts: Record<Category, number> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  function toggle(c: Category) {
    const next = new Set(selected);
    if (next.has(c)) next.delete(c); else next.add(c);
    onChange(next);
  }
  const label = selected.size === 0 ? "All categories" : `${selected.size} categor${selected.size === 1 ? "y" : "ies"}`;
  return (
    <div className="act-pop-wrap" ref={ref}>
      <button className={`act-control ${open ? "open" : ""} ${selected.size ? "has" : ""}`} onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        {selected.size > 0 && <span className="act-control-badge">{selected.size}</span>}
        <ChevronRight size={14} style={{ transform: "rotate(90deg)", opacity: 0.5 }} />
      </button>
      {open && (
        <div className="act-pop act-pop-cat">
          <div className="act-pop-cat-head">
            <span>Filter categories</span>
            {selected.size > 0 && <button className="link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: 12 }} onClick={() => onChange(new Set())}>Clear</button>}
          </div>
          {CATEGORY_ORDER.map((c) => {
            const meta = catMeta(c);
            const n = counts[c] || 0;
            const dead = n === 0;
            return (
              <button key={c} className={`act-cat-row ${selected.has(c) ? "on" : ""} ${dead ? "dead" : ""}`} disabled={dead} onClick={() => !dead && toggle(c)}>
                <span className="act-check">{selected.has(c) && <Check size={12} />}</span>
                <span className="act-cat-dot" style={{ background: meta.color }} />
                <span className="act-cat-name">{meta.label}</span>
                <span className="act-cat-count">{dead ? "no events" : n}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Drawer({ entry, onClose }: { entry: ActivityRow | null; onClose: () => void }) {
  if (!entry) return null;
  const meta = catMeta(entry.category);
  const rows: [string, React.ReactNode][] = [
    ["Category", <span key="c" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span className="act-cat-dot" style={{ background: meta.color }} />{meta.label} · <code>{entry.action}</code></span>],
    ["Time", new Date(entry.createdAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })],
    ...(entry.recipient ? [["Recipient", entry.recipient] as [string, React.ReactNode]] : []),
    ...(entry.actorLabel ? [["Actor", entry.actorLabel] as [string, React.ReactNode]] : []),
    ...(entry.targetLabel ? [["Target", entry.targetLabel] as [string, React.ReactNode]] : []),
    ...(entry.subject ? [["Subject", entry.subject] as [string, React.ReactNode]] : []),
    ...(entry.amount != null ? [["Amount", money(entry.amount)] as [string, React.ReactNode]] : []),
    ...(entry.providerId ? [["Provider ID", <code key="p">{entry.providerId}</code>] as [string, React.ReactNode]] : []),
  ];
  const showMeta = hasMetadata(entry.metadata);
  return (
    <div className="act-drawer-overlay" onClick={onClose}>
      <aside className="act-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="act-drawer-head">
          <div className="row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusBadge status={entry.status} />
            <span style={{ fontSize: 12, color: "var(--primary-50)", fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>{entry.id}</span>
          </div>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={onClose}><X size={16} /></button>
        </div>
        <h3 className="act-drawer-title">{entry.message || entry.action}</h3>
        <div className="act-drawer-rows">
          {rows.map(([k, v], i) => <div className="act-drawer-row" key={i}><span className="act-drawer-k">{k}</span><span className="act-drawer-v">{v}</span></div>)}
        </div>
        {entry.error && <div className="act-error"><AlertCircle size={14} /><span>{entry.error}</span></div>}
        {showMeta && (
          <div className="act-drawer-rows" style={{ marginTop: 4 }}>
            <div className="act-drawer-row" style={{ alignItems: "flex-start" }}>
              <span className="act-drawer-k">Metadata</span>
              <pre className="act-drawer-v" style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 12, maxHeight: 220, overflow: "auto" }}>
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function ActivityLogClient({ rows, counts, totalCount, windowLimit }: { rows: ActivityRow[]; counts: HealthCounts; totalCount: number; windowLimit: number }) {
  const all = rows;
  const [range, setRange] = useState<RangeVal>({ preset: "all", from: null, to: null });
  const [cats, setCats] = useState<Set<Category>>(new Set());
  const [status, setStatus] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ActivityRow | null>(null);

  const categoryCounts = useMemo(() => {
    const m = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<Category, number>;
    all.forEach((e) => { if (e.category in m) m[e.category] += 1; });
    return m;
  }, [all]);

  const [from, to] = range.preset === "custom"
    ? [range.from ? startOfDay(range.from) : null, range.to ? endOfDay(range.to) : range.from ? endOfDay(range.from) : null]
    : presetRange(range.preset);

  const preStatus = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((e) => {
      const t = new Date(e.createdAt);
      if (from && t < from) return false;
      if (to && t > to) return false;
      if (cats.size && !cats.has(e.category)) return false;
      if (q) {
        const hay = [e.recipient, e.subject, e.message, e.error, e.actorLabel, e.targetLabel, e.targetId, e.action, e.providerId].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, from, to, cats, search]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = { all: preStatus.length, SUCCESS: 0, FAILED: 0, PENDING: 0, SKIPPED: 0 };
    preStatus.forEach((e) => { if (e.status in m) m[e.status] += 1; });
    return m;
  }, [preStatus]);

  const filtered = useMemo(() => {
    const list = status === "all" ? preStatus : preStatus.filter((e) => e.status === status);
    return [...list].sort((a, b) => sort === "new" ? +new Date(b.createdAt) - +new Date(a.createdAt) : +new Date(a.createdAt) - +new Date(b.createdAt));
  }, [preStatus, status, sort]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  useEffect(() => { setPage(1); }, [range, cats, status, search, perPage, sort]);

  const activeFilters = range.preset !== "all" || cats.size > 0 || status !== "all" || !!search.trim();
  function clearAll() { setRange({ preset: "all", from: null, to: null }); setCats(new Set()); setStatus("all"); setSearch(""); }

  const HEALTH: { label: string; value: number; icon: LucideIcon; tone: string }[] = [
    { label: "Emails sent", value: counts.emailsSent, icon: Send, tone: "ok" },
    { label: "Emails failed", value: counts.emailsFailed, icon: AlertCircle, tone: counts.emailsFailed ? "bad" : "mute" },
    { label: "Emails pending", value: counts.emailsPending, icon: Clock, tone: counts.emailsPending ? "warn" : "mute" },
    { label: "Activity OK", value: counts.activityOk, icon: CheckCircle2, tone: "ok" },
    { label: "Activity failed", value: counts.activityFailed, icon: XCircle, tone: counts.activityFailed ? "bad" : "mute" },
  ];
  const STATUS_TABS: { id: Status | "all"; label: string; n: number }[] = [
    { id: "all", label: "All", n: statusCounts.all },
    { id: "SUCCESS", label: "Success", n: statusCounts.SUCCESS },
    { id: "FAILED", label: "Failed", n: statusCounts.FAILED },
    { id: "PENDING", label: "Pending", n: statusCounts.PENDING },
    { id: "SKIPPED", label: "Skipped", n: statusCounts.SKIPPED },
  ];

  return (
    <div className="admin-font">
      <header style={{ marginBottom: 22 }}>
        <p className="eyebrow">System</p>
        <h1 className="display" style={{ fontSize: "clamp(32px, 4.2vw, 46px)", marginTop: 6 }}>Activity <em>log.</em></h1>
        <p className="subtitle" style={{ marginTop: 10, fontSize: 15.5 }}>Every email, payment, webhook and system event — searchable and auditable.</p>
      </header>

      <div className="act-health">
        {HEALTH.map((h, i) => {
          const Icon = h.icon;
          return (
            <div key={i} className={`act-health-card ${h.tone}`}>
              <div className="act-health-top"><span>{h.label}</span><Icon size={15} /></div>
              <div className="act-health-val">{h.value}</div>
            </div>
          );
        })}
      </div>

      <div className="act-filterbar">
        <div className="act-search">
          <span className="act-search-ic"><Search size={15} /></span>
          <input className="input" type="search" placeholder="Search message, recipient, actor, target, provider ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <DateRange value={range} onChange={setRange} />
        <CategoryDropdown selected={cats} onChange={setCats} counts={categoryCounts} />
        <select className="aselect" value={sort} onChange={(e) => setSort(e.target.value as "new" | "old")} aria-label="Sort" style={{ height: 42 }}>
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
        </select>
        <select className="aselect" value={perPage} onChange={(e) => setPerPage(+e.target.value)} aria-label="Per page" style={{ height: 42 }}>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
        {activeFilters && <button className="act-clear" onClick={clearAll}><X size={13} /> Clear</button>}
      </div>

      <div className="act-statusseg">
        {STATUS_TABS.map((t) => (
          <button key={t.id} className={`act-seg ${status === t.id ? "active" : ""}`} onClick={() => setStatus(t.id)}>
            {t.id !== "all" && <span className="act-seg-dot" style={{ background: statusMeta(t.id as Status).dot }} />}
            {t.label}<span className="act-seg-n">{t.n}</span>
          </button>
        ))}
      </div>

      <div className="atable-wrap">
        <div className="atable-scroll">
          <table className="atable act-table">
            <thead><tr><th>Time</th><th>Category</th><th>Event</th><th>Who / target</th><th>Status</th><th className="col-actions" /></tr></thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 64, color: "var(--primary-50)" }}>
                  {all.length === 0 ? "No activity has been recorded yet." : "No log entries match these filters."}
                </td></tr>
              ) : paged.map((e) => {
                const meta = catMeta(e.category);
                return (
                  <tr key={e.id} onClick={() => setSelected(e)}>
                    <td className="col-date" style={{ whiteSpace: "nowrap" }}>
                      <div className="date-line">{dateStr(e.createdAt)}</div>
                      <div className="time-line">{timeStr(e.createdAt)}</div>
                    </td>
                    <td><span className="act-cat-cell"><span className="act-cat-dot" style={{ background: meta.color }} />{meta.label}</span></td>
                    <td style={{ maxWidth: 420, whiteSpace: "normal" }}>
                      <code className="act-action">{e.action}</code>
                      <div className="act-msg">{e.message || "—"}</div>
                    </td>
                    <td style={{ maxWidth: 200, whiteSpace: "normal" }}>
                      <div className="act-who">{e.recipient || e.actorLabel || "—"}</div>
                      {e.targetLabel && <div className="act-target">{e.targetLabel}</div>}
                    </td>
                    <td><StatusBadge status={e.status} /></td>
                    <td className="col-actions" onClick={(ev) => ev.stopPropagation()}>
                      <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setSelected(e)} aria-label="View details"><ChevronRight size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="apager">
          <span>{total === 0 ? "0" : `${(safePage - 1) * perPage + 1}–${Math.min(safePage * perPage, total)}`} of {total}</span>
          <div className="apager-controls">
            <button className="apager-btn" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={16} /></button>
            {pageWindow(safePage, pageCount).map((p, i) => p === "…"
              ? <span key={i} style={{ padding: "0 6px", color: "var(--primary-40)" }}>…</span>
              : <button key={i} className={`apager-btn ${p === safePage ? "active" : ""}`} onClick={() => setPage(p as number)}>{p}</button>)}
            <button className="apager-btn" disabled={safePage === pageCount} onClick={() => setPage(safePage + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--primary-50)", marginTop: 14, textAlign: "center" }}>
        {totalCount === 0
          ? "No events recorded yet."
          : totalCount > windowLimit
            ? `Showing the ${windowLimit} most recent of ${totalCount.toLocaleString()} events.`
            : `${totalCount.toLocaleString()} event${totalCount === 1 ? "" : "s"} recorded.`}
      </p>

      <Drawer entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
