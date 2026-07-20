"use client";

// Fix #7 (7a/7e) — the Pro's pre-job equipment & materials plan.
//
// Six buckets, prefilled from the service checklist so the Pro edits an
// informed draft rather than starting blank, due 24h before the job starts.
// Resubmittable while PENDING or REJECTED; locked once APPROVED until ops
// reopen it.
//
// All data is fetched through loadPreJobEquipment rather than passed down as
// props, so the server re-checks that the signed-in user is actually assigned
// to this job on every load — the mounting page cannot accidentally hand this
// component another Pro's plan.

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import EquipmentBucketEditor from "@/components/equipment/EquipmentBucketEditor";
import {
  READINESS_LABELS,
  countItems,
  emptyBuckets,
  type EquipmentBuckets,
  type PreJobEquipmentReadiness,
} from "@/lib/pre-job-equipment";
import {
  loadPreJobEquipment,
  submitPreJobEquipment,
  type PreJobEquipmentView,
} from "../../actions/preJobEquipment";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ReadinessBadge({ status }: { status: PreJobEquipmentReadiness }) {
  const icon =
    status === "APPROVED" ? (
      <CheckCircle2 size={13} />
    ) : status === "REJECTED" ? (
      <XCircle size={13} />
    ) : status === "PENDING" ? (
      <Clock size={13} />
    ) : (
      <AlertTriangle size={13} />
    );
  return (
    <span className={`fx-badge ${status.toLowerCase()}`}>
      {icon}
      {READINESS_LABELS[status]}
      <style jsx>{`
        .fx-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          font-weight: 700;
          border-radius: 999px;
          padding: 3px 10px;
          white-space: nowrap;
        }
        .approved {
          background: #dcfce7;
          color: #15803d;
        }
        .pending {
          background: #fef3c7;
          color: #b45309;
        }
        .rejected {
          background: #fee2e2;
          color: #b91c1c;
        }
        .not_submitted {
          background: #f4f4f5;
          color: #52525b;
        }
      `}</style>
    </span>
  );
}

export default function PreJobEquipmentPanel({ jobId }: { jobId: string }) {
  const [view, setView] = useState<PreJobEquipmentView | null>(null);
  const [buckets, setBuckets] = useState<EquipmentBuckets>(emptyBuckets());
  const [notes, setNotes] = useState("");
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
      setNotes(res.data.providerNotes ?? "");
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function submit() {
    setMsg(null);
    start(async () => {
      const res = await submitPreJobEquipment({ jobId, buckets, providerNotes: notes });
      if (res.success) {
        setMsg({
          ok: true,
          text:
            "late" in res && res.late
              ? "Sent to ops — flagged as submitted after the 24h deadline."
              : "Sent to ops for approval.",
        });
        await refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "Could not submit" });
      }
    });
  }

  if (loading) {
    return (
      <div className="fx-pje loading">
        <Loader2 size={16} className="animate-spin" /> Loading equipment plan…
        <style jsx>{`
          .fx-pje.loading {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #8a8a8a;
            border: 1px solid #e5e5e5;
            border-radius: 14px;
            padding: 16px;
            margin-top: 16px;
            background: #fff;
          }
        `}</style>
      </div>
    );
  }

  // Fail closed in the UI too: no view means the server declined to describe
  // this job to us, so we render nothing actionable.
  if (error || !view) {
    return (
      <div className="fx-pje-err">
        {error ?? "Equipment plan unavailable."}
        <style jsx>{`
          .fx-pje-err {
            font-size: 12.5px;
            color: #b91c1c;
            border: 1px solid #fecaca;
            background: #fef2f2;
            border-radius: 14px;
            padding: 14px 16px;
            margin-top: 16px;
          }
        `}</style>
      </div>
    );
  }

  const deadlinePassed = new Date(view.deadline).getTime() < Date.now();
  const locked = !view.canSubmit;
  const total = countItems(buckets);

  return (
    <div id="pre-job-equipment" className="fx-pje" style={{ scrollMarginTop: 80 }}>
      <header className="fx-pje-head">
        <h3>
          <ClipboardList size={18} /> Pre-job equipment &amp; materials
        </h3>
        <ReadinessBadge status={view.readiness} />
      </header>

      <p className="fx-pje-due">
        Due by <strong>{formatWhen(view.deadline)}</strong> — 24 hours before the job starts.
        {view.submittedAt ? (
          <>
            {" "}
            Submitted {formatWhen(view.submittedAt)}
            {view.isLate ? " (late)" : ""}.
          </>
        ) : deadlinePassed ? (
          <span className="fx-late"> The deadline has passed — submit as soon as you can.</span>
        ) : null}
      </p>

      {view.readiness === "REJECTED" && view.reviewNotes && (
        <div className="cl-eq-warn" style={{ marginBottom: 12 }}>
          <strong>
            <XCircle size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "-2px" }} />
            Ops sent this back
          </strong>
          <span>{view.reviewNotes}</span>
          <span className="cl-eq-warn-fix">Update the list below and resubmit.</span>
        </div>
      )}

      {view.readiness === "APPROVED" && (
        <div className="fx-ok">
          <CheckCircle2 size={13} /> Approved
          {view.reviewedByName ? ` by ${view.reviewedByName}` : ""}
          {view.reviewedAt ? ` on ${formatWhen(view.reviewedAt)}` : ""}. This plan is locked —
          ask ops to reopen it if something changed.
          {view.reviewNotes ? <em> “{view.reviewNotes}”</em> : null}
        </div>
      )}

      <EquipmentBucketEditor buckets={buckets} onChange={setBuckets} disabled={locked} />

      <div className="fx-notes">
        <label htmlFor="fx-pje-notes">Notes for ops (optional)</label>
        <textarea
          id="fx-pje-notes"
          value={notes}
          disabled={locked}
          maxLength={2000}
          rows={2}
          placeholder="Anything ops should know — access constraints, why an item needs buying…"
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {!locked && (
        <div className="fx-actions">
          <button type="button" className="primary" disabled={pending || total === 0} onClick={submit}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            {view.readiness === "NOT_SUBMITTED" ? "Submit for approval" : "Resubmit for approval"}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={pending}
            onClick={() => {
              // Back to the service checklist an admin maintains.
              setBuckets({ ...emptyBuckets(), coreTools: view.checklist });
            }}>
            <RotateCcw size={13} /> Reset to service checklist
          </button>
          <span className="fx-count">{total} item{total === 1 ? "" : "s"}</span>
        </div>
      )}

      {msg ? (
        <p className={`fx-msg ${msg.ok ? "ok" : "bad"}`}>{msg.text}</p>
      ) : null}

      {view.reimbursements.length > 0 && (
        <div className="fx-reimb">
          <h4>Your reimbursement claims</h4>
          <ul>
            {view.reimbursements.map((r) => (
              <li key={r.id}>
                <span className="item">{r.item}</span>
                <span className="amt">${r.amount.toFixed(2)}</span>
                <span className={`st ${r.status.toLowerCase()}`}>{r.status}</span>
                {r.reviewNotes ? <span className="rn">{r.reviewNotes}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!view.canRequestReimbursement && view.readiness !== "APPROVED" && (
        <p className="fx-gate">
          Reimbursement claims unlock once ops approve this plan — get approval before you buy
          anything.
        </p>
      )}

      <style jsx>{`
        .fx-pje {
          border: 1px solid #e5e5e5;
          border-radius: 14px;
          background: #fafafa;
          padding: 16px;
          margin-top: 16px;
        }
        .fx-pje-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }
        .fx-pje-head h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 700;
          color: #2b2b2b;
          margin: 0;
        }
        .fx-pje-due {
          font-size: 12.5px;
          color: #6b6b6b;
          margin: 0 0 12px;
          line-height: 1.45;
        }
        .fx-late {
          color: #b45309;
          font-weight: 600;
        }
        .fx-ok {
          display: block;
          font-size: 12.5px;
          color: #15803d;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 9px 11px;
          margin-bottom: 12px;
          line-height: 1.45;
        }
        .fx-notes {
          margin-top: 12px;
        }
        .fx-notes label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #52525b;
          margin-bottom: 4px;
        }
        .fx-notes textarea {
          width: 100%;
          border: 1px solid #dcdcdc;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 12.5px;
          font-family: inherit;
          resize: vertical;
        }
        .fx-notes textarea:focus {
          outline: none;
          border-color: #f97316;
        }
        .fx-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .fx-actions button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 9px;
          padding: 8px 14px;
        }
        .fx-actions .primary {
          background: #f97316;
          color: #fff;
        }
        .fx-actions .primary:hover:not(:disabled) {
          background: #ea580c;
        }
        .fx-actions .primary:disabled {
          opacity: 0.5;
        }
        .fx-actions .ghost {
          border: 1px solid #dcdcdc;
          color: #52525b;
          background: #fff;
        }
        .fx-count {
          font-size: 11.5px;
          color: #8a8a8a;
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
        .fx-gate {
          font-size: 11.5px;
          color: #8a8a8a;
          margin-top: 10px;
          line-height: 1.45;
        }
        .fx-reimb {
          margin-top: 14px;
          border-top: 1px solid #e8e8e8;
          padding-top: 10px;
        }
        .fx-reimb h4 {
          font-size: 12.5px;
          font-weight: 700;
          color: #2b2b2b;
          margin: 0 0 6px;
        }
        .fx-reimb ul {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .fx-reimb li {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 12px;
          color: #3f3f46;
        }
        .fx-reimb .amt {
          font-weight: 700;
        }
        .fx-reimb .rn {
          color: #8a8a8a;
          font-size: 11.5px;
        }
        .fx-reimb .st {
          font-size: 10.5px;
          font-weight: 700;
          border-radius: 999px;
          padding: 1px 7px;
          background: #f4f4f5;
          color: #52525b;
        }
        .fx-reimb .st.approved {
          background: #dcfce7;
          color: #15803d;
        }
        .fx-reimb .st.paid {
          background: #dbeafe;
          color: #1d4ed8;
        }
        .fx-reimb .st.denied {
          background: #fee2e2;
          color: #b91c1c;
        }
        .fx-reimb .st.pending {
          background: #fef3c7;
          color: #b45309;
        }
      `}</style>
    </div>
  );
}
