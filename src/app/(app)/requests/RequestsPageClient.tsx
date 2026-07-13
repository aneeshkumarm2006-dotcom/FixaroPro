"use client";

// Pending requests — Cleano "Pending requests" card design, re-skinned to the
// Fixaro charcoal/orange palette (A). Keeps the existing resolveJobRequest flow.

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, MapPin, Briefcase, X, CheckCircle2, RotateCcw } from "lucide-react";
import { resolveJobRequest } from "../actions/resolveJobRequest";
import { refundJobDeposit } from "../actions/refundJobDeposit";

interface JobRow {
  id: string;
  jobNumber: number;
  status: string;
  isFlexible: boolean;
  startTime: string;
  location: string | null;
  jobType: string | null;
  price: number | null;
  cancellationRequestedAt: string | null;
  rescheduleRequestedAt: string | null;
  depositPaid: boolean;
  depositAmount: number;
  depositRefundable: number;
  client: { id: string; name: string; email: string | null; phone: string | null } | null;
  cleaners: { id: string; name: string }[];
}

type Filter = "all" | "cancellation" | "reschedule";
type Kind = "cancellation" | "reschedule";

const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-CA");
const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
function relTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function RequestsPageClient({ jobs }: { jobs: JobRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ jobId: string; kind: Kind; decision: "approve" | "deny" } | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refundBusyId, setRefundBusyId] = useState<string | null>(null);
  const [refundedIds, setRefundedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (filter === "cancellation") return jobs.filter((j) => j.cancellationRequestedAt);
    if (filter === "reschedule") return jobs.filter((j) => j.rescheduleRequestedAt);
    return jobs;
  }, [jobs, filter]);

  const counts = {
    all: jobs.length,
    cancellation: jobs.filter((j) => j.cancellationRequestedAt).length,
    reschedule: jobs.filter((j) => j.rescheduleRequestedAt).length,
  };
  const TABS: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all", label: "All", count: counts.all },
    { id: "cancellation", label: "Cancellation", count: counts.cancellation },
    { id: "reschedule", label: "Reschedule", count: counts.reschedule },
  ];

  function handle(jobId: string, kind: Kind, decision: "approve" | "deny") {
    setNote("");
    setError(null);
    setPending({ jobId, kind, decision });
  }

  // One-click deposit refund (D0.6). No auto-refund happens in
  // requestCancellation — the deposit is only returned once an admin acts here.
  async function handleRefundDeposit(jobId: string) {
    setRefundBusyId(jobId);
    setError(null);
    const res = await refundJobDeposit(jobId);
    setRefundBusyId(null);
    if (!res.success) {
      setError(res.error || "Failed to refund deposit");
      return;
    }
    setRefundedIds((prev) => new Set(prev).add(jobId));
  }
  async function confirmHandle() {
    if (!pending) return;
    const { jobId, kind, decision } = pending;
    setSubmitting(true);
    setError(null);
    const res = await resolveJobRequest({ jobId, kind, decision, note: note.trim() || undefined });
    setSubmitting(false);
    if (!res.success) { setError(res.error || "Failed to resolve"); return; }
    setPending(null);
    setBusyId(jobId);
    setBusyId(null);
  }

  const modalCopy = (() => {
    if (!pending) return { title: "", body: "" };
    const { kind, decision, jobId } = pending;
    const num = jobs.find((j) => j.id === jobId)?.jobNumber ?? "";
    if (decision === "deny") return { title: "Deny request", body: `Keep Job #${num} as scheduled and let the customer know their request was declined.` };
    if (kind === "cancellation") return { title: "Approve cancellation", body: `Cancel Job #${num}. The slot will be freed and the customer notified.` };
    return { title: "Approve reschedule", body: `Approve the reschedule for Job #${num}. The cleaners and customer will be notified.` };
  })();
  const confirmCls = pending?.decision === "deny" ? "btn-secondary req-deny" : pending?.kind === "cancellation" ? "req-approve-cancel" : "req-approve-resched";

  return (
    <div className="admin-font">
      <header style={{ marginBottom: 24 }}>
        <p className="eyebrow">Operations</p>
        <h1 className="display" style={{ fontSize: "clamp(32px, 4.2vw, 46px)", marginTop: 6 }}>
          Pending <em>requests.</em> <span style={{ color: "var(--primary-40)", fontWeight: 300, fontFamily: "var(--font-serif)" }}>· {jobs.length}</span>
        </h1>
        <p className="subtitle" style={{ marginTop: 10, fontSize: 15.5 }}>Customer-initiated cancellation and reschedule requests awaiting your approval.</p>
      </header>

      {error && (
        <div style={{ marginBottom: 18, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", padding: "12px 14px", fontSize: 13.5, color: "#991b1b" }}>{error}</div>
      )}

      <div className="an-tabs" style={{ marginBottom: 22 }}>
        {TABS.map((t) => (
          <button key={t.id} className={`an-tab ${filter === t.id ? "active" : ""}`} onClick={() => setFilter(t.id)}>
            {t.label}<span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: filter === t.id ? "var(--accent-soft, rgba(232,93,4,0.12))" : "var(--primary-10)", color: filter === t.id ? "var(--accent)" : "var(--primary-60)" }}>{t.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="dcard" style={{ padding: 64, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: 16, background: "var(--primary-5)", color: "var(--primary-40)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={28} />
          </div>
          <h3 className="title-sm" style={{ marginBottom: 6 }}>All caught up</h3>
          <p className="subtitle" style={{ fontSize: 14, margin: 0 }}>No {filter === "all" ? "" : filter + " "}requests need your attention right now.</p>
        </div>
      ) : (
        <div className="req-grid">
          {filtered.map((j) => {
            const kinds: Kind[] = [];
            if (j.cancellationRequestedAt) kinds.push("cancellation");
            if (j.rescheduleRequestedAt) kinds.push("reschedule");
            const requestedAt = j.cancellationRequestedAt ?? j.rescheduleRequestedAt;
            const startStr = new Date(j.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
            const price = (j.price || 0);
            return (
              <article key={j.id} className="req-card">
                <div className="req-card-top">
                  <div>
                    <div className="req-jobno">Job #{j.jobNumber}</div>
                    {requestedAt && <div className="req-when">Requested {relTime(requestedAt)}</div>}
                  </div>
                  <div className="req-badges">
                    {kinds.map((k) => <span key={k} className={`req-badge ${k === "cancellation" ? "cancel" : "resched"}`}>{k}</span>)}
                  </div>
                </div>

                <div className="req-rows">
                  <div className="req-row">
                    <span className="req-row-ic"><CalendarClock size={15} /></span>
                    <div className="req-row-main">{startStr}{j.isFlexible && <span style={{ color: "var(--primary-60)", fontWeight: 400 }}> · flexible</span>}</div>
                  </div>
                  {j.location && (
                    <div className="req-row"><span className="req-row-ic"><MapPin size={15} /></span><div className="req-row-main">{j.location}</div></div>
                  )}
                  {j.client && (
                    <div className="req-row">
                      <span className="req-row-ic"><span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600 }}>{initials(j.client.name)}</span></span>
                      <div>
                        <div className="req-row-main">{j.client.name}</div>
                        <div className="req-row-sub">{[j.client.email, j.client.phone].filter(Boolean).join(" · ") || "—"}</div>
                      </div>
                    </div>
                  )}
                  {j.cleaners.length > 0 && (
                    <div className="req-row"><span className="req-row-ic"><Briefcase size={15} /></span><div className="req-row-main">{j.cleaners.map((c) => c.name).join(", ")}</div></div>
                  )}
                </div>

                <div className="req-foot">
                  <div className="req-price">{money(price)}</div>
                  <div className="req-actions">
                    <Link href={`/jobs/${j.id}`} className="btn btn-secondary btn-sm">Open job</Link>
                    {j.cancellationRequestedAt && j.depositPaid ? (
                      refundedIds.has(j.id) || j.depositRefundable <= 0 ? (
                        <span className="req-refunded" title="The deposit has been refunded to the customer">
                          <CheckCircle2 size={13} /> Deposit refunded
                        </span>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={refundBusyId === j.id}
                          title={`Refund the ${money(j.depositAmount)} deposit to the customer`}
                          onClick={() => handleRefundDeposit(j.id)}>
                          <RotateCcw size={13} />
                          {refundBusyId === j.id ? "Refunding…" : `Refund ${money(j.depositRefundable)} deposit`}
                        </button>
                      )
                    ) : null}
                    {kinds.map((k) => (
                      <Fragment key={k}>
                        <button className="btn btn-secondary btn-sm req-deny" disabled={busyId === j.id} onClick={() => handle(j.id, k, "deny")}>Deny</button>
                        <button className={`btn btn-sm ${k === "cancellation" ? "req-approve-cancel" : "req-approve-resched"}`} disabled={busyId === j.id} onClick={() => handle(j.id, k, "approve")}>
                          {k === "cancellation" ? "Approve cancellation" : "Approve reschedule"}
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pending && (
        <div className="req-modal-overlay" onClick={() => !submitting && setPending(null)}>
          <div className="req-modal" onClick={(e) => e.stopPropagation()}>
            <div className="req-modal-head">
              <h3>{modalCopy.title}</h3>
              <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => !submitting && setPending(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <p className="req-modal-body">{modalCopy.body}</p>
            <label className="req-modal-label">Customer-facing note <span>(optional)</span></label>
            <textarea
              rows={3}
              value={note}
              disabled={submitting}
              onChange={(e) => setNote(e.target.value)}
              placeholder={pending.decision === "deny" ? "Let them know why, and offer alternatives…" : "Add a friendly note to include in the confirmation…"}
            />
            {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#991b1b" }}>{error}</p>}
            <div className="req-modal-foot">
              <button className="btn btn-ghost btn-sm" disabled={submitting} onClick={() => setPending(null)}>Cancel</button>
              <button className={`btn btn-sm ${confirmCls}`} disabled={submitting} onClick={confirmHandle}>
                {submitting ? "Working…" : modalCopy.title}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
