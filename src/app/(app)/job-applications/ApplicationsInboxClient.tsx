"use client";

// Job applications — Cleano "Job applications" master/detail design, re-skinned
// to the Fixaro charcoal/orange palette (A). Wired to the real applications data
// + updateApplicationStatus. Notes/cover letter are shown read-only (no
// notes-save action exists yet).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Mail, Phone, Clock, FileText, Sparkles } from "lucide-react";
import { updateApplicationStatus } from "../actions/updateApplicationStatus";

type Status = "NEW" | "REVIEWING" | "INTERVIEW" | "HIRED" | "REJECTED" | "ARCHIVED";

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  experience: string | null;
  coverLetter: string | null;
  resumeUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

const ORDER: Status[] = ["NEW", "REVIEWING", "INTERVIEW", "HIRED", "REJECTED", "ARCHIVED"];
const STATUS_META: Record<Status, { label: string; dot: string; bg: string; fg: string }> = {
  NEW: { label: "New", dot: "#2f6fae", bg: "#dbeafe", fg: "#1e40af" },
  REVIEWING: { label: "Reviewing", dot: "#d97706", bg: "#fef3c7", fg: "#92400e" },
  INTERVIEW: { label: "Interview", dot: "#7c3aed", bg: "#e0e7ff", fg: "#3730a3" },
  HIRED: { label: "Hired", dot: "#059669", bg: "#d1fae5", fg: "#065f46" },
  REJECTED: { label: "Rejected", dot: "#dc2626", bg: "#fee2e2", fg: "#991b1b" },
  ARCHIVED: { label: "Archived", dot: "#64748b", bg: "#f3f4f6", fg: "#475569" },
};
const metaOf = (s: string) => STATUS_META[s as Status] ?? STATUS_META.ARCHIVED;
const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const dateStr = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function StatusPill({ status, sm }: { status: string; sm?: boolean }) {
  const m = metaOf(status);
  return <span className="pill" style={{ background: m.bg, color: m.fg, ...(sm ? { fontSize: 10.5 } : {}) }}><span className="pill-dot" style={{ background: m.dot }} />{m.label}</span>;
}
function Avatar({ name, size }: { name: string; size: number }) {
  return <span className="apps-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</span>;
}

export default function ApplicationsInboxClient({ applications }: { applications: Application[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | Status>("ALL");
  const [selId, setSelId] = useState<string | undefined>(
    applications.find((a) => a.status === "NEW")?.id || applications[0]?.id
  );
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const m: Record<string, number> = { ALL: applications.length };
    ORDER.forEach((s) => { m[s] = applications.filter((a) => a.status === s).length; });
    return m;
  }, [applications]);

  const visible = filter === "ALL" ? applications : applications.filter((a) => a.status === filter);
  const sel = applications.find((a) => a.id === selId);

  const FILTERS: { id: "ALL" | Status; label: string }[] = [
    { id: "ALL", label: "All" },
    ...ORDER.map((s) => ({ id: s, label: STATUS_META[s].label })),
  ];

  async function setStatus(id: string, status: Status) {
    setBusy(true);
    await updateApplicationStatus({ applicationId: id, status });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="admin-font">
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 className="title" style={{ fontSize: 30 }}>Job applications</h1>
          <span className="apps-headcount">{applications.length}</span>
        </div>
        <p className="subtitle" style={{ marginTop: 8, fontSize: 15 }}>Move applicants through the hiring pipeline — from new lead to hired.</p>
      </header>

      <div className="apps-filters">
        {FILTERS.map((f) => (
          <button key={f.id} className={`apps-filter ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>
            {f.id !== "ALL" && <span className="apps-filter-dot" style={{ background: STATUS_META[f.id].dot }} />}
            {f.label}
            <span className="apps-filter-count">{counts[f.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="apps-split">
        <div className="apps-list">
          {visible.length === 0 ? (
            <div className="apps-empty">
              <Briefcase size={28} />
              <p>No {filter === "ALL" ? "" : STATUS_META[filter].label.toLowerCase() + " "}applications.</p>
            </div>
          ) : visible.map((a) => (
            <button key={a.id} className={`apps-card ${a.id === selId ? "active" : ""}`} onClick={() => setSelId(a.id)}>
              <Avatar name={a.name} size={42} />
              <div className="apps-card-body">
                <div className="apps-card-name">{a.name}</div>
                <div className="apps-card-sub">{[a.position, dateStr(a.createdAt)].filter(Boolean).join(" · ")}</div>
              </div>
              <StatusPill status={a.status} sm />
            </button>
          ))}
        </div>

        {!sel ? (
          <div className="apps-detail apps-detail-empty">
            <Briefcase size={32} />
            <p>Select an applicant to view details.</p>
          </div>
        ) : (
          <div className="apps-detail">
            <div className="apps-detail-head">
              <Avatar name={sel.name} size={56} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="apps-detail-name">{sel.name}</h2>
                <div className="apps-detail-contact">
                  <a className="apps-contact-link" href={`mailto:${sel.email}`}><Mail size={14} /> {sel.email}</a>
                  {sel.phone && <a className="apps-contact-link" href={`tel:${sel.phone}`}><Phone size={14} /> {sel.phone}</a>}
                </div>
              </div>
              <StatusPill status={sel.status} />
            </div>

            <div className="apps-rows">
              {sel.position && <div className="apps-row"><span className="apps-row-k"><Briefcase size={15} /> Position</span><span className="apps-row-v">{sel.position}</span></div>}
              {sel.experience && <div className="apps-row"><span className="apps-row-k"><Sparkles size={15} /> Experience</span><span className="apps-row-v">{sel.experience}</span></div>}
              <div className="apps-row"><span className="apps-row-k"><Clock size={15} /> Applied</span><span className="apps-row-v">{dateStr(sel.createdAt)}</span></div>
            </div>

            {sel.coverLetter && (
              <>
                <div className="apps-section-label">Cover letter</div>
                <div className="apps-block">{sel.coverLetter}</div>
              </>
            )}

            {sel.resumeUrl && (
              <a className="btn btn-secondary btn-sm apps-resume" href={sel.resumeUrl} target="_blank" rel="noreferrer">
                <FileText size={14} /> View résumé (PDF)
              </a>
            )}

            <div className="apps-section-label">Move to stage</div>
            <div className="apps-status-grid">
              {ORDER.map((s) => {
                const m = STATUS_META[s];
                const on = sel.status === s;
                return (
                  <button key={s} className={`apps-status-btn ${on ? "on" : ""}`} disabled={busy || on}
                    style={on ? { background: m.bg, color: m.fg, borderColor: m.dot } : undefined}
                    onClick={() => setStatus(sel.id, s)}>
                    <span className="apps-filter-dot" style={{ background: m.dot }} />{m.label}
                  </button>
                );
              })}
            </div>

            {sel.notes && (
              <>
                <div className="apps-section-label">Admin notes</div>
                <div className="apps-block">{sel.notes}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
