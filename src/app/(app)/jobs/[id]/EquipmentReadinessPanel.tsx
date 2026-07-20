"use client";

// Fix #7 (7c/7d/7e) — the manager's view of one job's pre-job equipment plan.
//
// Shows readiness (not submitted / pending approval / approved / rejected),
// the six buckets, approve / reject / reopen / edit, and the reimbursement
// claims filed against the job.
//
// "Readiness" here is the PAPERWORK state of this job's plan. It is a
// different thing from src/lib/equipment-readiness.ts, which compares a Pro's
// inventory profile to a service checklist for notification targeting. This
// panel never reads that.
//
// Data comes from loadPreJobEquipment rather than page props, so the server
// re-authorizes on every load, and every button below hits an action that
// independently re-checks OWNER/ADMIN/OPS_MANAGER. A FIELD_LEAD can read this
// panel; their writes are refused server-side.

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  Pencil,
  RotateCcw,
  XCircle,
} from "lucide-react";
import EquipmentBucketEditor from "@/components/equipment/EquipmentBucketEditor";
import {
  READINESS_LABELS,
  emptyBuckets,
  type EquipmentBuckets,
  type PreJobEquipmentReadiness,
} from "@/lib/pre-job-equipment";
import {
  editPreJobEquipment,
  loadPreJobEquipment,
  reviewEquipmentReimbursement,
  reviewPreJobEquipment,
  type PreJobEquipmentView,
  type ReimbursementDecision,
  type ReviewDecision,
} from "../../actions/preJobEquipment";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EquipmentReadinessPanel({ jobId }: { jobId: string }) {
  const [view, setView] = useState<PreJobEquipmentView | null>(null);
  const [buckets, setBuckets] = useState<EquipmentBuckets>(emptyBuckets());
  const [editing, setEditing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const refresh = useCallback(async () => {
    const res = await loadPreJobEquipment(jobId);
    if (!res.success) {
      setError(res.error);
      setView(null);
    } else {
      setError(null);
      setView(res.data);
      setBuckets(res.data.buckets);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function decide(decision: ReviewDecision) {
    // Enforced again server-side; this only avoids a pointless round trip.
    if (decision === "REJECT" && !reviewNotes.trim()) {
      setMsg({ ok: false, text: "Add a reason before rejecting." });
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await reviewPreJobEquipment({ jobId, decision, reviewNotes });
      if (res.success) {
        setReviewNotes("");
        setMsg({ ok: true, text: "Decision recorded." });
        await refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "Could not save decision" });
      }
    });
  }

  function saveEdit() {
    setMsg(null);
    start(async () => {
      const res = await editPreJobEquipment({ jobId, buckets, reviewNotes });
      if (res.success) {
        setEditing(false);
        setReviewNotes("");
        setMsg({ ok: true, text: "Plan updated." });
        await refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "Could not save changes" });
      }
    });
  }

  function decideReimbursement(id: string, decision: ReimbursementDecision) {
    const notes =
      decision === "DENY"
        ? (globalThis.prompt("Reason for denying this claim?") ?? "").trim()
        : "";
    if (decision === "DENY" && !notes) return;
    setMsg(null);
    start(async () => {
      const res = await reviewEquipmentReimbursement({
        reimbursementId: id,
        decision,
        reviewNotes: notes || undefined,
      });
      if (res.success) {
        setMsg({ ok: true, text: "Claim updated." });
        await refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "Could not update claim" });
      }
    });
  }

  if (loading) {
    return (
      <div className="fx-erp muted">
        <Loader2 size={15} className="animate-spin" /> Loading equipment readiness…
        <style jsx>{`
          .fx-erp.muted {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #8a8a8a;
            border: 1px solid #e5e5e5;
            border-radius: 14px;
            background: #fff;
            padding: 16px;
            margin-top: 16px;
          }
        `}</style>
      </div>
    );
  }

  // Fail closed: if the server would not describe this job to us, show nothing
  // actionable.
  if (error || !view) {
    return (
      <div className="fx-erp-err">
        {error ?? "Equipment readiness unavailable."}
        <style jsx>{`
          .fx-erp-err {
            font-size: 12.5px;
            color: #b91c1c;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 14px;
            padding: 14px 16px;
            margin-top: 16px;
          }
        `}</style>
      </div>
    );
  }

  const status: PreJobEquipmentReadiness = view.readiness;
  const submitted = status !== "NOT_SUBMITTED";
  const canAct = view.canReview;

  return (
    <div className="fx-erp" id="equipment-readiness" style={{ scrollMarginTop: 80 }}>
      <header>
        <h3>
          <ClipboardList size={18} /> Equipment readiness
        </h3>
        <span className={`fx-badge ${status.toLowerCase()}`}>
          {status === "APPROVED" ? (
            <CheckCircle2 size={13} />
          ) : status === "REJECTED" ? (
            <XCircle size={13} />
          ) : status === "PENDING" ? (
            <Clock size={13} />
          ) : (
            <AlertTriangle size={13} />
          )}
          {READINESS_LABELS[status]}
        </span>
      </header>

      <p className="fx-meta">
        Plan due {formatWhen(view.deadline)} (24h before start).
        {view.submittedAt ? (
          <>
            {" "}
            Submitted {formatWhen(view.submittedAt)}
            {view.submittedByName ? ` by ${view.submittedByName}` : ""}
            {view.isLate ? <span className="fx-late"> — late</span> : ""}.
          </>
        ) : (
          <span className="fx-late"> Nothing submitted yet.</span>
        )}
        {view.reviewedAt ? (
          <>
            {" "}
            Reviewed {formatWhen(view.reviewedAt)}
            {view.reviewedByName ? ` by ${view.reviewedByName}` : ""}.
          </>
        ) : null}
      </p>

      {view.providerNotes ? (
        <p className="fx-quote">Pro&apos;s note: “{view.providerNotes}”</p>
      ) : null}
      {view.reviewNotes ? <p className="fx-quote">Review note: “{view.reviewNotes}”</p> : null}

      {!submitted ? (
        <p className="fx-none">
          The assigned Pro has not submitted an equipment &amp; materials plan for this job.
          Nothing can be reimbursed until they do and it is approved.
        </p>
      ) : (
        <>
          {view.buckets.toPurchase.length > 0 && (
            <div className="cl-eq-warn" style={{ marginBottom: 12 }}>
              <strong>
                <AlertTriangle
                  size={13}
                  style={{ display: "inline", marginRight: 5, verticalAlign: "-2px" }}
                />
                {view.buckets.toPurchase.length} item
                {view.buckets.toPurchase.length === 1 ? "" : "s"} need purchasing
              </strong>
              <span>{view.buckets.toPurchase.join(", ")}</span>
              <span className="cl-eq-warn-fix">
                Approving this plan authorises the Pro to buy these and claim them back.
              </span>
            </div>
          )}

          <EquipmentBucketEditor
            buckets={buckets}
            onChange={setBuckets}
            disabled={!editing || !canAct}
          />

          {canAct && (
            <>
              <textarea
                className="fx-notes"
                rows={2}
                maxLength={2000}
                value={reviewNotes}
                placeholder="Review note — required when rejecting"
                onChange={(e) => setReviewNotes(e.target.value)}
              />

              <div className="fx-actions">
                {editing ? (
                  <>
                    <button type="button" className="primary" disabled={pending} onClick={saveEdit}>
                      {pending ? <Loader2 size={13} className="animate-spin" /> : null} Save edits
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={pending}
                      onClick={() => {
                        setBuckets(view.buckets);
                        setEditing(false);
                      }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {status !== "APPROVED" && (
                      <button
                        type="button"
                        className="approve"
                        disabled={pending}
                        onClick={() => decide("APPROVE")}>
                        <CheckCircle2 size={13} /> Approve
                      </button>
                    )}
                    {status !== "REJECTED" && (
                      <button
                        type="button"
                        className="reject"
                        disabled={pending}
                        onClick={() => decide("REJECT")}>
                        <XCircle size={13} /> Reject
                      </button>
                    )}
                    {status === "APPROVED" && (
                      <button
                        type="button"
                        className="ghost"
                        disabled={pending}
                        onClick={() => decide("REOPEN")}>
                        <RotateCcw size={13} /> Reopen for edits
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost"
                      disabled={pending}
                      onClick={() => setEditing(true)}>
                      <Pencil size={13} /> Edit list
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}

      {msg ? <p className={`fx-msg ${msg.ok ? "ok" : "bad"}`}>{msg.text}</p> : null}

      <div className="fx-claims">
        <h4>Reimbursement claims</h4>
        {view.reimbursements.length === 0 ? (
          <p className="fx-none">No claims filed against this job.</p>
        ) : (
          <ul>
            {view.reimbursements.map((r) => (
              <li key={r.id}>
                <div className="row">
                  <span className="item">{r.item}</span>
                  <span className="amt">${r.amount.toFixed(2)}</span>
                  <span className={`st ${r.status.toLowerCase()}`}>{r.status}</span>
                  <span className="who">
                    {r.providerName ?? "Pro"} · {formatWhen(r.createdAt)}
                  </span>
                </div>
                {r.receiptUrl ? (
                  <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer nofollow">
                    View receipt
                  </a>
                ) : null}
                {r.reason ? <p className="rn">{r.reason}</p> : null}
                {r.reviewNotes ? <p className="rn">Review: {r.reviewNotes}</p> : null}
                {canAct && (
                  <div className="fx-actions small">
                    {r.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          className="approve"
                          disabled={pending}
                          onClick={() => decideReimbursement(r.id, "APPROVE")}>
                          Approve
                        </button>
                        <button
                          type="button"
                          className="reject"
                          disabled={pending}
                          onClick={() => decideReimbursement(r.id, "DENY")}>
                          Deny
                        </button>
                      </>
                    )}
                    {r.status === "APPROVED" && (
                      <button
                        type="button"
                        className="primary"
                        disabled={pending}
                        onClick={() => decideReimbursement(r.id, "MARK_PAID")}>
                        Mark paid
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <style jsx>{`
        .fx-erp {
          border: 1px solid #e5e5e5;
          border-radius: 14px;
          background: #fafafa;
          padding: 16px;
          margin-top: 16px;
        }
        .fx-erp header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }
        .fx-erp h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 700;
          color: #2b2b2b;
          margin: 0;
        }
        .fx-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          font-weight: 700;
          border-radius: 999px;
          padding: 3px 10px;
        }
        .fx-badge.approved {
          background: #dcfce7;
          color: #15803d;
        }
        .fx-badge.pending {
          background: #fef3c7;
          color: #b45309;
        }
        .fx-badge.rejected {
          background: #fee2e2;
          color: #b91c1c;
        }
        .fx-badge.not_submitted {
          background: #f4f4f5;
          color: #52525b;
        }
        .fx-meta {
          font-size: 12.5px;
          color: #6b6b6b;
          margin: 0 0 8px;
          line-height: 1.45;
        }
        .fx-late {
          color: #b45309;
          font-weight: 600;
        }
        .fx-quote {
          font-size: 12px;
          color: #52525b;
          background: #fff;
          border-left: 3px solid #f97316;
          border-radius: 0 8px 8px 0;
          padding: 7px 10px;
          margin: 0 0 8px;
        }
        .fx-none {
          font-size: 12.5px;
          color: #8a8a8a;
          line-height: 1.45;
          margin: 0;
        }
        .fx-notes {
          width: 100%;
          margin-top: 12px;
          border: 1px solid #dcdcdc;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 12.5px;
          font-family: inherit;
          resize: vertical;
        }
        .fx-notes:focus {
          outline: none;
          border-color: #f97316;
        }
        .fx-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .fx-actions button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 9px;
          padding: 7px 13px;
        }
        .fx-actions.small button {
          font-size: 11.5px;
          padding: 5px 10px;
        }
        .fx-actions button:disabled {
          opacity: 0.5;
        }
        .fx-actions .primary {
          background: #f97316;
          color: #fff;
        }
        .fx-actions .approve {
          background: #16a34a;
          color: #fff;
        }
        .fx-actions .reject {
          background: #fff;
          border: 1px solid #fca5a5;
          color: #b91c1c;
        }
        .fx-actions .ghost {
          background: #fff;
          border: 1px solid #dcdcdc;
          color: #52525b;
        }
        .fx-msg {
          font-size: 12px;
          margin-top: 8px;
        }
        .fx-msg.ok {
          color: #15803d;
        }
        .fx-msg.bad {
          color: #b91c1c;
        }
        .fx-claims {
          margin-top: 16px;
          border-top: 1px solid #e8e8e8;
          padding-top: 10px;
        }
        .fx-claims h4 {
          font-size: 12.5px;
          font-weight: 700;
          color: #2b2b2b;
          margin: 0 0 8px;
        }
        .fx-claims ul {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .fx-claims li {
          background: #fff;
          border: 1px solid #ececec;
          border-radius: 10px;
          padding: 9px 11px;
        }
        .fx-claims .row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 12.5px;
          color: #3f3f46;
        }
        .fx-claims .amt {
          font-weight: 700;
        }
        .fx-claims .who {
          font-size: 11px;
          color: #9a9a9a;
        }
        .fx-claims a {
          font-size: 11.5px;
          text-decoration: underline;
          color: #c2410c;
        }
        .fx-claims .rn {
          font-size: 11.5px;
          color: #7a7a7a;
          margin-top: 3px;
        }
        .fx-claims .st {
          font-size: 10.5px;
          font-weight: 700;
          border-radius: 999px;
          padding: 1px 7px;
          background: #f4f4f5;
          color: #52525b;
        }
        .fx-claims .st.approved {
          background: #dcfce7;
          color: #15803d;
        }
        .fx-claims .st.paid {
          background: #dbeafe;
          color: #1d4ed8;
        }
        .fx-claims .st.denied {
          background: #fee2e2;
          color: #b91c1c;
        }
        .fx-claims .st.pending {
          background: #fef3c7;
          color: #b45309;
        }
      `}</style>
    </div>
  );
}
