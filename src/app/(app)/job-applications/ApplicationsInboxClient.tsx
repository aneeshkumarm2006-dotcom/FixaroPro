"use client";

// Job applications — Cleano "Job applications" master/detail design, re-skinned
// to the Fixaro charcoal/orange palette (A). Wired to the real applications data
// + updateApplicationStatus. Notes/cover letter are shown read-only (no
// notes-save action exists yet).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, Mail, Phone, Clock, FileText, Sparkles, AlertTriangle, KeyRound } from "lucide-react";
import { useServiceCatalog } from "@/lib/config/ServiceConfigProvider";
import { updateApplicationStatus } from "../actions/updateApplicationStatus";
import { hireApplicant } from "../actions/hireApplicant";

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
  const [error, setError] = useState<string | null>(null);
  const catalog = useServiceCatalog();

  // Fix #9f: the outcome of the last hire — which services onboarding seeded,
  // and the standing prompt to review them. Kept in state (not a toast) so the
  // admin cannot miss that a new provider's work authorisations are unreviewed.
  const [hireOutcome, setHireOutcome] = useState<{
    applicantName: string;
    employeeId: string;
    seeded: string[];
    needsReview: boolean;
    reviewReason: string;
    tempPassword?: string;
  } | null>(null);

  const labelOf = (value: string) =>
    catalog.find((s) => s.value === value)?.label ?? value;

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
    setError(null);

    // Moving to HIRED is not just a status change: it provisions the provider
    // account AND seeds their service eligibility from onboarding, so it must
    // go through hireApplicant rather than the plain status update.
    if (status === "HIRED") {
      const applicantName = applications.find((a) => a.id === id)?.name ?? "Applicant";
      const res = await hireApplicant(id);
      setBusy(false);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setHireOutcome({
        applicantName,
        employeeId: res.eligibility.employeeId,
        seeded: res.eligibility.seeded,
        needsReview: res.eligibility.needsReview,
        reviewReason: res.eligibility.reviewReason,
        tempPassword: res.existing ? undefined : res.tempPassword,
      });
      router.refresh();
      return;
    }

    const res = await updateApplicationStatus({ applicationId: id, status });
    setBusy(false);
    if (!res?.success) {
      const msg = (res as { error?: string } | undefined)?.error;
      setError(msg ?? "Failed to update application");
      return;
    }
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

      {error && (
        <div
          role="alert"
          style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fee2e2", color: "#991b1b", fontSize: 13.5 }}>
          {error}
        </div>
      )}

      {hireOutcome && (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 14,
            border: "1px solid #f59e0b",
            background: "#fffbeb",
            color: "#78350f",
            fontSize: 13.5,
            lineHeight: 1.55,
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, marginBottom: 8 }}>
            <AlertTriangle size={16} />
            {hireOutcome.applicantName} hired — review their service eligibility
          </div>

          {hireOutcome.seeded.length > 0 ? (
            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 6 }}>Seeded from onboarding (starter set):</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {hireOutcome.seeded.map((s) => (
                  <span
                    key={s}
                    style={{ padding: "3px 9px", borderRadius: 999, background: "#fef3c7", border: "1px solid #fcd34d", fontSize: 12 }}>
                    {labelOf(s)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 8, fontWeight: 600 }}>
              No services were seeded — this provider will see NO claimable jobs until you approve some.
            </div>
          )}

          {hireOutcome.reviewReason && (
            <div style={{ marginBottom: 10 }}>{hireOutcome.reviewReason}</div>
          )}

          {hireOutcome.tempPassword && (
            <div
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 10px", borderRadius: 10, background: "#fff", border: "1px solid #fcd34d" }}>
              <KeyRound size={14} />
              <span>Temporary password (share securely, shown once):</span>
              <code style={{ fontWeight: 700, letterSpacing: 0.5 }}>{hireOutcome.tempPassword}</code>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {/* The detail view keeps tab state locally (no URL param), so this
                lands on the profile — the copy above says which tab to open. */}
            <Link className="btn btn-primary btn-sm" href={`/employees/${hireOutcome.employeeId}`}>
              Open provider profile
            </Link>
            <button className="btn btn-secondary btn-sm" onClick={() => setHireOutcome(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

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
