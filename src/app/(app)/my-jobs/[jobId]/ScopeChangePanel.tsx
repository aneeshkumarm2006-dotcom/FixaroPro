"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, ClipboardEdit, AlertTriangle, Check, X, Clock } from "lucide-react";
import {
  requestPriceRevision,
  cancelPriceRevision,
} from "../../actions/priceRevision";

// On-site scope change (Phase 2B). The Pro finds work outside the booked scope,
// proposes a new ALL-IN price with a mandatory reason, and the customer approves
// or rejects it in their portal. The job price does not move until they answer.
//
// Deliberately blunt about pay: approving a higher price does NOT increase the
// Pro's payout on its own. Pay is hourly rate × clocked hours, so the extra
// scope pays out through the extra time they clock — the panel says so, in the
// place where they'd otherwise assume otherwise.

export type ScopeChangeStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface ScopeChangeRevision {
  id: string;
  previousPrice: number;
  proposedPrice: number;
  reason: string;
  status: ScopeChangeStatus;
  requestedByName: string | null;
  /** ISO string. */
  createdAt: string;
  /** ISO string, or null while PENDING. */
  respondedAt: string | null;
  resolutionNote: string | null;
}

export interface ScopeChangePanelProps {
  jobId: string;
  /** The job's current all-in price (job.price). */
  currentPrice: number | null;
  /** Job status — a revision may only be raised while IN_PROGRESS. */
  jobStatus: string;
  /** job.paymentReceived — a settled job is closed to revisions. */
  paymentReceived: boolean;
  /** Newest first. Pass the job's priceRevisions, serialized. */
  revisions: ScopeChangeRevision[];
  /** Set true when the viewer is the one who raised the pending request (or an
   *  admin) so the withdraw button shows. Defaults to true. */
  canWithdraw?: boolean;
}

const MIN_REASON = 10;
const MAX_REASON = 2000;

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_CHIP: Record<ScopeChangeStatus, { label: string; cls: string }> = {
  PENDING: { label: "Awaiting customer", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Approved", cls: "bg-green-100 text-green-800" },
  REJECTED: { label: "Declined", cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Withdrawn", cls: "bg-neutral-100 text-neutral-600" },
};

export default function ScopeChangePanel({
  jobId,
  currentPrice,
  jobStatus,
  paymentReceived,
  revisions,
  canWithdraw = true,
}: ScopeChangePanelProps) {
  const [open, setOpen] = useState(false);
  const [proposed, setProposed] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const price = currentPrice ?? 0;
  const pendingRevision = useMemo(
    () => revisions.find((r) => r.status === "PENDING") ?? null,
    [revisions]
  );
  const history = useMemo(
    () => revisions.filter((r) => r.status !== "PENDING"),
    [revisions]
  );

  const settled = paymentReceived || jobStatus === "PAID" || jobStatus === "CANCELLED";
  const inProgress = jobStatus === "IN_PROGRESS";
  // Mirrors the server-side gate. The server re-checks all of this — this only
  // decides what to render.
  const canRequest = !settled && inProgress && !pendingRevision && price > 0;

  const proposedValue = Number(proposed);
  const delta =
    Number.isFinite(proposedValue) && proposed.trim() !== ""
      ? proposedValue - price
      : null;

  function submit() {
    if (!Number.isFinite(proposedValue) || proposedValue <= 0) {
      setMsg({ ok: false, text: "Enter the new all-in price for the job." });
      return;
    }
    if (reason.trim().length < MIN_REASON) {
      setMsg({
        ok: false,
        text: `Explain the extra work in at least ${MIN_REASON} characters — the customer reads this.`,
      });
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await requestPriceRevision({
        jobId,
        proposedPrice: proposedValue,
        reason: reason.trim(),
      });
      if (res.success) {
        setProposed("");
        setReason("");
        setOpen(false);
        setMsg({ ok: true, text: "Sent to the customer for approval." });
      } else {
        setMsg({ ok: false, text: res.error ?? "Failed to send the request." });
      }
    });
  }

  function withdraw(revisionId: string) {
    setMsg(null);
    start(async () => {
      const res = await cancelPriceRevision({ revisionId });
      setMsg(
        res.success
          ? { ok: true, text: "Request withdrawn." }
          : { ok: false, text: res.error ?? "Failed to withdraw." }
      );
    });
  }

  return (
    <div
      id="scope-change"
      className="rounded-xl border border-neutral-200 bg-white p-4 mt-4"
      style={{ scrollMarginTop: 80 }}>
      <h3 className="font-semibold flex items-center gap-2 mb-1">
        <ClipboardEdit size={18} /> Scope change &amp; price revision
      </h3>
      <p className="text-sm text-neutral-500 mb-3">
        Found work outside the booked scope? Propose a new all-in price. The customer
        approves or declines it — nothing changes on their bill until they do.
      </p>

      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-neutral-500">Current job price</span>
        <span className="font-semibold">{money(price)}</span>
      </div>

      {pendingRevision ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-semibold text-amber-900 inline-flex items-center gap-1">
              <Clock size={14} /> Awaiting the customer&apos;s response
            </span>
            <span className="text-xs text-amber-800">{when(pendingRevision.createdAt)}</span>
          </div>
          <p className="text-sm text-amber-900 m-0">
            {money(pendingRevision.previousPrice)} → <strong>{money(pendingRevision.proposedPrice)}</strong>
          </p>
          <p className="text-xs text-amber-800 mt-1 mb-0">{pendingRevision.reason}</p>
          {canWithdraw ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => withdraw(pendingRevision.id)}
              className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50">
              {pending ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
              Withdraw request
            </button>
          ) : null}
        </div>
      ) : null}

      {canRequest ? (
        !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium">
            Request a price revision
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <input
                value={proposed}
                onChange={(e) => setProposed(e.target.value)}
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                placeholder="New all-in price (CAD)"
                className="w-48 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              {delta !== null && delta !== 0 ? (
                <span
                  className={`text-xs font-semibold ${delta > 0 ? "text-amber-700" : "text-green-700"}`}>
                  {delta > 0 ? "+" : "−"}
                  {money(Math.abs(delta))} vs current
                </span>
              ) : null}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
              rows={3}
              placeholder="What extra work is needed, and why? The customer sees this word for word."
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-neutral-500 m-0">
              {reason.trim().length}/{MAX_REASON} · minimum {MIN_REASON} characters
            </p>
            <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-2.5">
              <p className="text-xs text-neutral-600 m-0 flex gap-1.5">
                <AlertTriangle size={13} className="shrink-0 mt-0.5 text-neutral-400" />
                <span>
                  This changes what the <strong>customer</strong> pays. Your own pay stays
                  hourly rate × the hours you clock — so make sure the extra time is on the
                  clock. Talk to ops if the scope needs a different pay rate.
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="rounded-lg bg-neutral-900 text-white px-3 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
                {pending ? <Loader2 size={14} className="animate-spin" /> : null}
                Send to customer
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setMsg(null);
                }}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )
      ) : !pendingRevision ? (
        <p className="text-xs text-neutral-500 m-0">
          {settled
            ? "This job is closed for price changes — contact ops."
            : !inProgress
              ? "You can raise a price revision once the job is in progress."
              : "This job has no price on file yet — ops must set one first."}
        </p>
      ) : null}

      {msg ? (
        <p className={`text-xs mt-2 ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
      ) : null}

      {history.length > 0 ? (
        <div className="mt-4 border-t border-neutral-200 pt-3">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            History
          </p>
          <ul className="space-y-2 list-none p-0 m-0">
            {history.map((r) => {
              const chip = STATUS_CHIP[r.status];
              return (
                <li key={r.id} className="text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${chip.cls}`}>
                      {r.status === "APPROVED" ? (
                        <Check size={11} className="inline mr-1" />
                      ) : r.status === "REJECTED" ? (
                        <X size={11} className="inline mr-1" />
                      ) : null}
                      {chip.label}
                    </span>
                    <span className="text-neutral-700">
                      {money(r.previousPrice)} → {money(r.proposedPrice)}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {when(r.respondedAt ?? r.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5 mb-0">{r.reason}</p>
                  {r.resolutionNote ? (
                    <p className="text-xs text-neutral-500 mt-0.5 mb-0">
                      Note: {r.resolutionNote}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
