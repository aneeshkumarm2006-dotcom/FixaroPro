"use client";

import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { fmtDate } from "@/lib/timezone";
import {
  STRIKE_THRESHOLD,
  STRIKE_WINDOW_DAYS,
  STRIKE_REASON_LABELS,
  type StrikeReasonKey,
} from "@/lib/strikes-constants";

interface StrikeRow {
  id: string;
  reason: string;
  status: string;
  note: string | null;
  jobId: string | null;
  createdAt: string;
  countsTowardThreshold: boolean;
}

interface StrikesSummary {
  activeCount: number;
  level: "none" | "warning" | "critical";
  strikes: StrikeRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

function reasonLabel(reason: string): string {
  return STRIKE_REASON_LABELS[reason as StrikeReasonKey] ?? reason;
}

/**
 * Read-only strike history for the signed-in Pro. Pure presentation: all
 * scoping/authorization happened server-side in page.tsx.
 */
export default function StrikesClient({ summary }: { summary: StrikesSummary }) {
  const remaining = Math.max(0, STRIKE_THRESHOLD - summary.activeCount);
  const standingClass =
    summary.level === "critical"
      ? "crit"
      : summary.level === "warning"
        ? "warn"
        : "ok";

  return (
    <div className="cl-page-wrap">
      <div className="cl-page-head">
        <div>
          <h1 className="cl-page-title">
            <span className="cl-page-title-icon">
              <ShieldAlert size={22} />
            </span>
            My strikes
          </h1>
          <p className="cl-page-sub">
            Strikes are how we track reliability. They roll off automatically —
            here&apos;s exactly where you stand.
          </p>
        </div>
      </div>

      {/* Standing */}
      <div className={`fx-standing ${standingClass}`}>
        {summary.level === "none" ? (
          <ShieldCheck size={18} className="ico" />
        ) : (
          <ShieldAlert size={18} className="ico" />
        )}
        <div>
          <strong>
            {summary.activeCount} of {STRIKE_THRESHOLD} active strike
            {summary.activeCount === 1 ? "" : "s"}.
          </strong>{" "}
          {summary.level === "critical"
            ? "You've reached the limit, so an admin will review your account. Your existing schedule doesn't change while that review happens — they'll contact you."
            : summary.activeCount === 0
              ? "Nothing active. Keep it that way and there's nothing to do here."
              : `${remaining} more would trigger an admin review.`}
        </div>
      </div>

      {/* What happens next */}
      <div className="fx-explain">
        <h2>How strikes work</h2>
        <ul>
          <li>
            A strike stays active for <strong>{STRIKE_WINDOW_DAYS} days</strong>,
            then rolls off on its own. Nothing to apply for.
          </li>
          <li>
            At <strong>{STRIKE_THRESHOLD} active strikes</strong> an admin reviews
            your account. That&apos;s a conversation, not an automatic removal.
          </li>
          <li>
            Think a strike is wrong — running late for a reason you told us about,
            for example? Message dispatch in{" "}
            <Link href="/chat" className="fx-link">
              Messages
            </Link>{" "}
            and an admin can excuse it.
          </li>
        </ul>
      </div>

      {/* History */}
      {summary.strikes.length === 0 ? (
        <div className="cl-empty-block">
          <div className="icon-bubble">
            <ShieldCheck size={28} />
          </div>
          <div>
            <p
              style={{
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: 4,
              }}>
              No strikes on your record.
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              Show up on time and finish your checklists and it stays that way.
            </p>
          </div>
        </div>
      ) : (
        <div className="cl-table-wrap">
          <div className="cl-table-scroll">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Job</th>
                  <th>Applied</th>
                  <th>Status</th>
                  <th>Rolls off</th>
                </tr>
              </thead>
              <tbody>
                {summary.strikes.map((s) => {
                  const active =
                    s.status === "ACTIVE" && s.countsTowardThreshold;
                  const pill = active
                    ? { cls: "low", label: "Active" }
                    : s.status === "ACTIVE"
                      ? { cls: "created", label: "Rolled off" }
                      : s.status === "EXCUSED"
                        ? { cls: "ok", label: "Excused" }
                        : s.status === "REMOVED"
                          ? { cls: "ok", label: "Removed" }
                          : { cls: "created", label: s.status };
                  const rollsOff = new Date(
                    new Date(s.createdAt).getTime() +
                      STRIKE_WINDOW_DAYS * DAY_MS
                  );
                  return (
                    <tr key={s.id}>
                      <td
                        style={{
                          whiteSpace: "normal",
                          minWidth: 240,
                          color: "var(--ink)",
                        }}>
                        {reasonLabel(s.reason)}
                        {s.note ? (
                          <div className="fx-note">{s.note}</div>
                        ) : null}
                      </td>
                      <td>
                        {s.jobId ? (
                          <Link
                            href={`/my-jobs/${s.jobId}`}
                            className="cl-action-btn">
                            View job
                          </Link>
                        ) : (
                          <span style={{ color: "var(--primary-40)" }}>—</span>
                        )}
                      </td>
                      <td>{fmtDate(s.createdAt, DATE_OPTS)}</td>
                      <td>
                        <span className={`cl-pill ${pill.cls}`}>
                          {pill.label}
                        </span>
                      </td>
                      <td style={{ color: "var(--primary-60)" }}>
                        {active ? fmtDate(rollsOff, DATE_OPTS) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        .fx-standing {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 14px;
          margin-bottom: 18px;
          font-size: 13.5px;
          line-height: 1.55;
          border: 1px solid var(--primary-15);
          background: #fff;
          color: var(--primary-70);
        }
        .fx-standing .ico {
          flex: 0 0 auto;
          margin-top: 1px;
        }
        .fx-standing.ok .ico {
          color: var(--accent);
        }
        .fx-standing.warn {
          border-color: rgba(217, 119, 6, 0.45);
          background: rgba(217, 119, 6, 0.06);
          color: var(--amber-800);
        }
        .fx-standing.crit {
          border-color: var(--accent);
          background: rgba(232, 93, 4, 0.07);
          color: var(--accent-hover);
        }
        .fx-explain {
          border: 1px solid var(--primary-10);
          border-radius: 14px;
          background: #fff;
          padding: 16px 18px;
          margin-bottom: 18px;
        }
        .fx-explain h2 {
          font-size: 13px;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 8px;
        }
        .fx-explain ul {
          margin: 0;
          padding-left: 18px;
          font-size: 13px;
          line-height: 1.7;
          color: var(--primary-70);
        }
        .fx-link {
          color: var(--accent);
          font-weight: 600;
        }
        .fx-note {
          font-size: 12px;
          color: var(--primary-60);
          margin-top: 4px;
          white-space: normal;
        }
      `}</style>
    </div>
  );
}
