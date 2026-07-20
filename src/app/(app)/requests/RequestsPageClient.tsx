"use client";

// Pending requests — Cleano "Pending requests" card design, re-skinned to the
// Fixaro charcoal/orange palette (A). Keeps the existing resolveJobRequest flow.

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, MapPin, Briefcase, X, CheckCircle2, RotateCcw, ClipboardEdit } from "lucide-react";
import { resolveJobRequest } from "../actions/resolveJobRequest";
import { refundJobDeposit } from "../actions/refundJobDeposit";
import { adminResolvePriceRevision } from "../actions/priceRevision";

// Phase 2B — a PENDING on-site price revision the Pro raised, still awaiting the
// customer. Ops can approve/reject it on the customer's behalf (agreed by phone)
// or cancel one raised in error. Every override needs a written reason.
interface PriceRevisionRow {
  id: string;
  previousPrice: number;
  proposedPrice: number;
  reason: string;
  requestedByName: string | null;
  createdAt: string;
}

interface JobRow {
  priceRevision: PriceRevisionRow | null;
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

type Filter = "all" | "cancellation" | "reschedule" | "revision";
type Kind = "cancellation" | "reschedule" | "revision";
// Cancellation/reschedule are approve|deny. A price revision adds "cancel" —
// killing the request without answering for the customer either way.
type Decision = "approve" | "deny" | "cancel";

// Ops is moving a customer's bill without the customer clicking anything, so the
// reason is mandatory and long enough to mean something. Matches the server.
const MIN_REVISION_NOTE = 10;

const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-CA");
const money2 = (n: number) =>
  (n || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
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
  const [pending, setPending] = useState<{ jobId: string; kind: Kind; decision: Decision } | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refundBusyId, setRefundBusyId] = useState<string | null>(null);
  const [refundedIds, setRefundedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (filter === "cancellation") return jobs.filter((j) => j.cancellationRequestedAt);
    if (filter === "reschedule") return jobs.filter((j) => j.rescheduleRequestedAt);
    if (filter === "revision") return jobs.filter((j) => j.priceRevision);
    return jobs;
  }, [jobs, filter]);

  const counts = {
    all: jobs.length,
    cancellation: jobs.filter((j) => j.cancellationRequestedAt).length,
    reschedule: jobs.filter((j) => j.rescheduleRequestedAt).length,
    revision: jobs.filter((j) => j.priceRevision).length,
  };
  const TABS: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all", label: "All", count: counts.all },
    { id: "cancellation", label: "Cancellation", count: counts.cancellation },
    { id: "reschedule", label: "Reschedule", count: counts.reschedule },
    { id: "revision", label: "Price revision", count: counts.revision },
  ];

  function handle(jobId: string, kind: Kind, decision: Decision) {
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

    // Price revisions go to their own action — they move money, so they carry a
    // mandatory reason and their own authz path (OWNER/ADMIN, re-checked server
    // side). resolveJobRequest only understands cancellation/reschedule.
    if (kind === "revision") {
      const revision = jobs.find((j) => j.id === jobId)?.priceRevision;
      if (!revision) { setError("This request is no longer available."); return; }
      const trimmed = note.trim();
      if (trimmed.length < MIN_REVISION_NOTE) {
        setError(`Give a reason of at least ${MIN_REVISION_NOTE} characters for the override.`);
        return;
      }
      setSubmitting(true);
      setError(null);
      const res = await adminResolvePriceRevision({
        revisionId: revision.id,
        decision: decision === "approve" ? "APPROVE" : decision === "deny" ? "REJECT" : "CANCEL",
        note: trimmed,
      });
      setSubmitting(false);
      if (!res.success) { setError(res.error || "Failed to resolve"); return; }
      setPending(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    const res = await resolveJobRequest({
      jobId,
      kind,
      decision: decision === "approve" ? "approve" : "deny",
      note: note.trim() || undefined,
    });
    setSubmitting(false);
    if (!res.success) { setError(res.error || "Failed to resolve"); return; }
    setPending(null);
    setBusyId(jobId);
    setBusyId(null);
  }

  const modalCopy = (() => {
    if (!pending) return { title: "", body: "" };
    const { kind, decision, jobId } = pending;
    const job = jobs.find((j) => j.id === jobId);
    const num = job?.jobNumber ?? "";
    if (kind === "revision") {
      const rev = job?.priceRevision;
      const from = rev ? money2(rev.previousPrice) : "the current price";
      const to = rev ? money2(rev.proposedPrice) : "the proposed price";
      if (decision === "approve") {
        return {
          title: "Approve price revision",
          body: `Move Job #${num} from ${from} to ${to} on the customer's behalf. Only do this when the customer has agreed — the charge changes immediately. Provider pay is NOT changed: pay stays hourly rate × clocked hours.`,
        };
      }
      if (decision === "deny") {
        return {
          title: "Reject price revision",
          body: `Decline the revision on Job #${num}. The price stays at ${from} and the Pro is notified to keep to the original scope.`,
        };
      }
      return {
        title: "Cancel price revision",
        body: `Withdraw the pending revision on Job #${num} without answering for the customer. The price stays at ${from} and the Pro is notified.`,
      };
    }
    if (decision === "deny") return { title: "Deny request", body: `Keep Job #${num} as scheduled and let the customer know their request was declined.` };
    if (kind === "cancellation") return { title: "Approve cancellation", body: `Cancel Job #${num}. The slot will be freed and the customer notified.` };
    return { title: "Approve reschedule", body: `Approve the reschedule for Job #${num}. The Pros and customer will be notified.` };
  })();
  const confirmCls =
    pending?.decision === "deny" || pending?.decision === "cancel"
      ? "btn-secondary req-deny"
      : pending?.kind === "cancellation"
        ? "req-approve-cancel"
        : "req-approve-resched";
  const noteRequired = pending?.kind === "revision";

  return (
    <div className="admin-font">
      <header style={{ marginBottom: 24 }}>
        <p className="eyebrow">Operations</p>
        <h1 className="display" style={{ fontSize: "clamp(32px, 4.2vw, 46px)", marginTop: 6 }}>
          Pending <em>requests.</em> <span style={{ color: "var(--primary-40)", fontWeight: 300, fontFamily: "var(--font-serif)" }}>· {jobs.length}</span>
        </h1>
        <p className="subtitle" style={{ marginTop: 10, fontSize: 15.5 }}>Cancellation and reschedule requests from customers, plus on-site price revisions raised by your Pros and awaiting a customer response.</p>
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
          <p className="subtitle" style={{ fontSize: 14, margin: 0 }}>No {filter === "all" ? "" : (filter === "revision" ? "price revision" : filter) + " "}requests need your attention right now.</p>
        </div>
      ) : (
        <div className="req-grid">
          {filtered.map((j) => {
            const kinds: Kind[] = [];
            if (j.cancellationRequestedAt) kinds.push("cancellation");
            if (j.rescheduleRequestedAt) kinds.push("reschedule");
            if (j.priceRevision) kinds.push("revision");
            const requestedAt =
              j.cancellationRequestedAt ?? j.rescheduleRequestedAt ?? j.priceRevision?.createdAt ?? null;
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
                    {kinds.map((k) => (
                      <span key={k} className={`req-badge ${k === "cancellation" ? "cancel" : "resched"}`}>
                        {k === "revision" ? "price revision" : k}
                      </span>
                    ))}
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
                  {j.priceRevision && (
                    <div className="req-row">
                      <span className="req-row-ic"><ClipboardEdit size={15} /></span>
                      <div>
                        <div className="req-row-main">
                          {money2(j.priceRevision.previousPrice)} → {money2(j.priceRevision.proposedPrice)}
                          <span style={{ color: "var(--primary-60)", fontWeight: 400 }}>
                            {" "}· awaiting customer
                          </span>
                        </div>
                        <div className="req-row-sub">
                          {j.priceRevision.requestedByName
                            ? `${j.priceRevision.requestedByName}: `
                            : ""}
                          {j.priceRevision.reason}
                        </div>
                      </div>
                    </div>
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
                    {kinds.map((k) =>
                      k === "revision" ? (
                        <Fragment key={k}>
                          <button className="btn btn-ghost btn-sm" disabled={busyId === j.id} onClick={() => handle(j.id, k, "cancel")} title="Withdraw this request without answering for the customer">Cancel request</button>
                          <button className="btn btn-secondary btn-sm req-deny" disabled={busyId === j.id} onClick={() => handle(j.id, k, "deny")}>Reject revision</button>
                          <button className="btn btn-sm req-approve-resched" disabled={busyId === j.id} onClick={() => handle(j.id, k, "approve")} title="Only when the customer has agreed — this changes what they are charged">
                            Approve revision
                          </button>
                        </Fragment>
                      ) : (
                        <Fragment key={k}>
                          <button className="btn btn-secondary btn-sm req-deny" disabled={busyId === j.id} onClick={() => handle(j.id, k, "deny")}>Deny</button>
                          <button className={`btn btn-sm ${k === "cancellation" ? "req-approve-cancel" : "req-approve-resched"}`} disabled={busyId === j.id} onClick={() => handle(j.id, k, "approve")}>
                            {k === "cancellation" ? "Approve cancellation" : "Approve reschedule"}
                          </button>
                        </Fragment>
                      )
                    )}
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
            <label className="req-modal-label">
              {noteRequired ? "Reason for the override " : "Customer-facing note "}
              <span>{noteRequired ? "(required)" : "(optional)"}</span>
            </label>
            <textarea
              rows={3}
              value={note}
              disabled={submitting}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                noteRequired
                  ? "Who approved this, and how? e.g. 'Customer approved by phone at 14:20 with J. Tremblay.'"
                  : pending.decision === "deny"
                    ? "Let them know why, and offer alternatives…"
                    : "Add a friendly note to include in the confirmation…"
              }
            />
            {noteRequired && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--primary-60)" }}>
                Recorded on the audit trail and the job history. Minimum {MIN_REVISION_NOTE} characters.
              </p>
            )}
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
