"use client";

// Fix #7 (7e) — the ops queue. A list only: every decision is made on the job
// itself via EquipmentReadinessPanel, so there is exactly one place where a
// plan is approved and one audit shape for it.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Loader2 } from "lucide-react";
import { READINESS_LABELS, type PreJobEquipmentReadiness } from "@/lib/pre-job-equipment";
import {
  loadEquipmentApprovalQueue,
  type ApprovalQueueRow,
} from "../../actions/preJobEquipment";

const TABS: Array<{ key: PreJobEquipmentReadiness | "ALL"; label: string }> = [
  { key: "PENDING", label: "Pending approval" },
  { key: "REJECTED", label: "Rejected" },
  { key: "APPROVED", label: "Approved" },
  { key: "ALL", label: "All" },
];

function formatWhen(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
}

export default function EquipmentApprovalsClient() {
  const [tab, setTab] = useState<PreJobEquipmentReadiness | "ALL">("PENDING");
  const [rows, setRows] = useState<ApprovalQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: PreJobEquipmentReadiness | "ALL") => {
    setLoading(true);
    const res = await loadEquipmentApprovalQueue(status);
    if (res.success) {
      setRows(res.data);
      setError(null);
    } else {
      setRows([]);
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  return (
    <div className="fx-eqa">
      <header>
        <h1>
          <ClipboardList size={20} /> Equipment approvals
        </h1>
        <Link href="/equipment-checklists">Service checklists →</Link>
      </header>
      <p className="fx-sub">
        Pre-job equipment &amp; materials plans submitted by Pros. Plans are due 24 hours before
        the job starts, and nothing can be reimbursed until a plan is approved.
      </p>

      <nav className="fx-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={t.key === tab ? "active" : ""}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="fx-state">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </p>
      ) : error ? (
        <p className="fx-state bad">{error}</p>
      ) : rows.length === 0 ? (
        <p className="fx-state">Nothing here.</p>
      ) : (
        <ul className="fx-rows">
          {rows.map((r) => {
            const late = r.submittedAt != null && r.submittedAt > r.deadline;
            return (
              <li key={r.jobId}>
                <div className="top">
                  <Link href={`/jobs/${r.jobId}#equipment-readiness`}>
                    Job #{r.jobNumber} · {r.clientName}
                  </Link>
                  <span className={`st ${r.readiness.toLowerCase()}`}>
                    {READINESS_LABELS[r.readiness]}
                  </span>
                  {late ? <span className="late">late</span> : null}
                  {r.pendingReimbursements > 0 ? (
                    <span className="claims">
                      {r.pendingReimbursements} claim
                      {r.pendingReimbursements === 1 ? "" : "s"} to review
                    </span>
                  ) : null}
                </div>
                <div className="meta">
                  {r.jobType ?? "General"} · starts {formatWhen(r.startTime)} · submitted{" "}
                  {formatWhen(r.submittedAt)}
                  {r.submittedByName ? ` by ${r.submittedByName}` : ""} · {r.itemCount} item
                  {r.itemCount === 1 ? "" : "s"}
                </div>
                {r.toPurchase.length > 0 ? (
                  <div className="buy">To purchase: {r.toPurchase.join(", ")}</div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <style jsx>{`
        .fx-eqa {
          padding: 24px;
          max-width: 1000px;
        }
        .fx-eqa header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .fx-eqa h1 {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 22px;
          font-weight: 700;
          color: #2b2b2b;
          margin: 0;
        }
        .fx-eqa header :global(a) {
          font-size: 12.5px;
          color: #c2410c;
          text-decoration: underline;
        }
        .fx-sub {
          font-size: 13px;
          color: #6b6b6b;
          margin: 6px 0 16px;
          line-height: 1.5;
          max-width: 68ch;
        }
        .fx-tabs {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .fx-tabs button {
          font-size: 12.5px;
          font-weight: 600;
          border: 1px solid #dcdcdc;
          background: #fff;
          color: #52525b;
          border-radius: 999px;
          padding: 6px 14px;
        }
        .fx-tabs button.active {
          background: #2b2b2b;
          border-color: #2b2b2b;
          color: #fff;
        }
        .fx-state {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          color: #8a8a8a;
        }
        .fx-state.bad {
          color: #b91c1c;
        }
        .fx-rows {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .fx-rows li {
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          background: #fff;
          padding: 11px 13px;
        }
        .top {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .top :global(a) {
          font-size: 13.5px;
          font-weight: 700;
          color: #2b2b2b;
        }
        .top :global(a:hover) {
          color: #c2410c;
        }
        .st {
          font-size: 10.5px;
          font-weight: 700;
          border-radius: 999px;
          padding: 1px 8px;
          background: #f4f4f5;
          color: #52525b;
        }
        .st.approved {
          background: #dcfce7;
          color: #15803d;
        }
        .st.pending {
          background: #fef3c7;
          color: #b45309;
        }
        .st.rejected {
          background: #fee2e2;
          color: #b91c1c;
        }
        .late,
        .claims {
          font-size: 10.5px;
          font-weight: 700;
          border-radius: 999px;
          padding: 1px 8px;
          background: #fff1e6;
          color: #9a3412;
        }
        .meta {
          font-size: 11.5px;
          color: #8a8a8a;
          margin-top: 4px;
          line-height: 1.45;
        }
        .buy {
          font-size: 11.5px;
          color: #9a3412;
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}
