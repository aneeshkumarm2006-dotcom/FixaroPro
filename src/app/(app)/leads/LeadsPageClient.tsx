"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, XCircle, Sparkles, Search } from "lucide-react";
import { updateLeadStatus } from "../actions/updateLeadStatus";
import { convertLeadToJob } from "../actions/convertLeadToJob";
import PremiumSelect from "@/components/ui/PremiumSelect";

type Status = "NEW" | "CONTACTED" | "CONVERTED" | "DEAD" | "OUT_OF_AREA";

interface Lead {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  postalCode: string | null;
  dropOffStep: number | null;
  serviceType: string | null;
  bedCount: number | null;
  bathCount: number | null;
  preferredDate: string | null;
  isFlexible: boolean;
  preferredSlot: string | null;
  status: Status;
  source: string | null;
  lastActivityAt: string;
  createdAt: string;
  convertedJob: { id: string; jobNumber: number; jobDate: string | null } | null;
}

const SERVICE_LABELS: Record<string, string> = {
  standard: "Standard", deep: "Deep", "move-in": "Move-in",
  "move-out": "Move-out", office: "Office",
};

const STATUS_COLORS: Record<Status, { bg: string; fg: string; dot: string; label: string }> = {
  NEW:         { bg: "rgba(217,119,6,0.12)",   fg: "#92400e", dot: "#d97706", label: "New" },
  CONTACTED:   { bg: "rgba(2,132,199,0.10)",   fg: "#075985", dot: "#0284c7", label: "Contacted" },
  CONVERTED:   { bg: "rgba(5,150,105,0.10)",   fg: "#065f46", dot: "#10b981", label: "Converted" },
  DEAD:        { bg: "rgba(148,163,184,0.18)", fg: "#475569", dot: "#94a3b8", label: "Dead" },
  OUT_OF_AREA: { bg: "rgba(249,115,22,0.12)",  fg: "#9a3412", dot: "#f97316", label: "Out of area" },
};

const TABS = [
  { id: "all",         label: "All" },
  { id: "new",         label: "New" },
  { id: "contacted",   label: "Contacted" },
  { id: "converted",   label: "Converted" },
  { id: "out_of_area", label: "Out of area" },
  { id: "dead",        label: "Dead" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function AStatCard({ icon: Icon, label, value, hint, delta, deltaDir }: {
  icon: React.ElementType; label: string; value: number | string;
  hint?: string; delta?: string; deltaDir?: "up" | "down";
}) {
  return (
    <div className="astat">
      <div className="astat-head">
        <span>{label}</span>
        <span className="astat-icon"><Icon size={15} /></span>
      </div>
      <div className="astat-value">{value}</div>
      {(hint || delta) && (
        <div className={`astat-delta ${deltaDir ?? ""}`}>
          {delta && <strong>{delta}</strong>}
          {hint && <> {hint}</>}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function dateStr(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export default function LeadsPageClient({ leads }: { leads: Lead[] }) {
  const [tab, setTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  const stats = useMemo(() => ({
    total:       leads.length,
    new:         leads.filter(l => l.status === "NEW").length,
    contacted:   leads.filter(l => l.status === "CONTACTED").length,
    converted:   leads.filter(l => l.status === "CONVERTED").length,
    dead:        leads.filter(l => l.status === "DEAD").length,
    out_of_area: leads.filter(l => l.status === "OUT_OF_AREA").length,
  }), [leads]);

  const countFor = (id: TabId) =>
    id === "all" ? stats.total : (stats[id as keyof typeof stats] ?? 0);

  const filtered = useMemo(() => {
    let list = tab === "all"
      ? leads
      : leads.filter(l => l.status === tab.toUpperCase());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.email.toLowerCase().includes(q) ||
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.postalCode && l.postalCode.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );
  }, [tab, search, leads]);

  async function handleStatusChange(id: string, status: Status) {
    setUpdating(id);
    await updateLeadStatus({ id, status });
    setUpdating(null);
  }

  async function handleConvert(id: string) {
    setConverting(id);
    const result = await convertLeadToJob(id);
    setConverting(null);
    if (result.success && result.jobId) {
      window.location.href = `/jobs/${result.jobId}`;
    }
  }

  return (
    <div className="admin-font stack-24">
      <header className="row-between" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div className="stack-8" style={{ minWidth: 0 }}>
          <p className="eyebrow">Sales</p>
          <h1 className="display" style={{ fontSize: "clamp(34px, 4.2vw, 48px)", whiteSpace: "nowrap" }}>
            Leads{" "}
            <span style={{ color: "var(--primary-40)", fontWeight: 300 }}>· {stats.total}</span>
          </h1>
        </div>
      </header>

      <div className="astat-grid">
        <AStatCard icon={Sparkles}     label="Total leads"  value={stats.total}     hint="all time" />
        <AStatCard icon={AlertCircle}  label="New"          value={stats.new}       hint="awaiting first contact" />
        <AStatCard
          icon={CheckCircle2} label="Converted" value={stats.converted}
          delta={stats.total ? `${Math.round((stats.converted / stats.total) * 100)}%` : "0%"}
          deltaDir="up" hint="rate"
        />
        <AStatCard
          icon={XCircle} label="Dead / lost"
          value={stats.dead + stats.out_of_area}
          hint={`${stats.out_of_area} out of area`}
        />
      </div>

      <div className="atabs">
        {TABS.map(t => (
          <button key={t.id} type="button"
            className={`atab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}>
            {t.label}
            {countFor(t.id) > 0 && <span className="atab-count">{countFor(t.id)}</span>}
          </button>
        ))}
      </div>

      <div className="atoolbar">
        <div className="atoolbar-search">
          <span className="atoolbar-search-icon"><Search size={14} /></span>
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, postal code…"
          />
        </div>
        <span style={{ fontSize: 13, color: "var(--primary-60)", marginLeft: "auto" }}>
          {filtered.length} of {stats.total}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="atable-wrap" style={{ padding: "80px 40px", textAlign: "center", color: "var(--primary-60)" }}>
          No leads in this view.
        </div>
      ) : (
        <>
          <div className="atable-wrap" id="ld-desktop">
            <div className="atable-scroll">
              <table className="atable">
                <thead>
                  <tr>
                    <th>Contact</th>
                    <th>Property</th>
                    <th>Preferred</th>
                    <th>Status</th>
                    <th>Job</th>
                    <th>Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.id}>
                      <td style={{ minWidth: 240 }}>
                        <div className="col-client">
                          {l.name || <em style={{ color: "var(--primary-50)", fontStyle: "normal" }}>No name</em>}
                        </div>
                        <div className="col-client-sub" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span>{l.email}</span>
                          {l.phone && <span style={{ color: "var(--primary-40)" }}>·</span>}
                          {l.phone && <span>{l.phone}</span>}
                          {l.postalCode && (
                            <span style={{ fontSize: 11, padding: "2px 6px", background: "var(--primary-5)", borderRadius: 4, color: "var(--primary)", fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                              {l.postalCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ minWidth: 200 }}>
                        {l.serviceType ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {(l.bedCount !== null || l.bathCount !== null) && (
                              <span style={{ fontSize: 12, color: "var(--primary-70)" }}>
                                {l.bedCount ?? "?"}bd · {l.bathCount ?? "?"}ba
                              </span>
                            )}
                            <span className="pill" style={{ background: "var(--primary-10)", color: "var(--primary)" }}>
                              {SERVICE_LABELS[l.serviceType] ?? l.serviceType}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--primary-40)", fontStyle: "italic" }}>—</span>
                        )}
                        {l.dropOffStep !== null && l.dropOffStep > 0 && l.dropOffStep < 4 && (
                          <div style={{ fontSize: 11, color: "var(--primary-50)", marginTop: 4 }}>
                            Stopped at step {l.dropOffStep}
                          </div>
                        )}
                      </td>
                      <td style={{ minWidth: 140 }}>
                        {l.preferredDate ? (
                          <>
                            <div className="date-line">{dateStr(l.preferredDate)}</div>
                            <div className="time-line">{l.isFlexible ? "Flexible" : (l.preferredSlot || "—")}</div>
                          </>
                        ) : <span style={{ color: "var(--primary-40)" }}>—</span>}
                      </td>
                      <td>
                        <PremiumSelect
                          value={l.status}
                          onChange={v => handleStatusChange(l.id, v as Status)}
                          disabled={updating === l.id}
                          size="sm"
                          options={Object.entries(STATUS_COLORS).map(([s, c]) => ({ value: s, label: c.label }))}
                          style={{ width: 130 }}
                        />
                      </td>
                      <td style={{ minWidth: 150 }}>
                        {l.convertedJob ? (
                          <a href={`/jobs/${l.convertedJob.id}`} className="link" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            Job #{l.convertedJob.jobNumber} →
                          </a>
                        ) : (l.status === "NEW" || l.status === "CONTACTED") ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={converting === l.id}
                            onClick={() => handleConvert(l.id)}>
                            {converting === l.id ? "Converting…" : "→ Convert to job"}
                          </button>
                        ) : <span style={{ color: "var(--primary-40)" }}>—</span>}
                      </td>
                      <td style={{ minWidth: 100 }}>
                        <div className="time-line" style={{ fontSize: 12 }}>
                          {formatRelative(l.lastActivityAt)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div id="ld-mobile" style={{ display: "none", flexDirection: "column", gap: 10 }}>
            {filtered.map(l => {
              const c = STATUS_COLORS[l.status];
              return (
                <article key={l.id} className="jcard">
                  <div className="jcard-top">
                    <div>
                      <div className="jcard-client">{l.name || l.email}</div>
                      <div className="jcard-meta">{l.email}</div>
                      {l.phone && <div className="jcard-meta">{l.phone}</div>}
                    </div>
                    <span className="pill" style={{ background: c.bg, color: c.fg }}>
                      <span className="pill-dot" style={{ background: c.dot }} />
                      {c.label}
                    </span>
                  </div>
                  <div className="jcard-row" style={{ marginTop: 10 }}>
                    <div>
                      {l.preferredDate && (
                        <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
                          {dateStr(l.preferredDate)}
                        </div>
                      )}
                      {(l.bedCount !== null || l.bathCount !== null) && (
                        <div style={{ fontSize: 11, color: "var(--primary-60)" }}>
                          {l.bedCount ?? "?"}bd · {l.bathCount ?? "?"}ba
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {l.serviceType && (
                        <div style={{ fontSize: 13 }}>{SERVICE_LABELS[l.serviceType] ?? l.serviceType}</div>
                      )}
                      <div style={{ fontSize: 11, color: "var(--primary-60)" }}>
                        {formatRelative(l.lastActivityAt)}
                      </div>
                    </div>
                  </div>
                  {(l.status === "NEW" || l.status === "CONTACTED") && !l.convertedJob && (
                    <div style={{ paddingTop: 10, borderTop: "1px solid var(--primary-10)" }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={converting === l.id}
                        onClick={() => handleConvert(l.id)}>
                        {converting === l.id ? "Converting…" : "→ Convert to Job"}
                      </button>
                    </div>
                  )}
                  {l.convertedJob && (
                    <div style={{ paddingTop: 10, borderTop: "1px solid var(--primary-10)" }}>
                      <a href={`/jobs/${l.convertedJob.id}`} className="link" style={{ fontSize: 13 }}>
                        Job #{l.convertedJob.jobNumber}
                      </a>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <style>{`
            @media (max-width: 1100px) {
              #ld-desktop { display: none !important; }
              #ld-mobile  { display: flex !important; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
