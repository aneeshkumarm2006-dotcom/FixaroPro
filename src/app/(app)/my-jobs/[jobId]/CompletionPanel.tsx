"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { completeJobAsProvider } from "../../actions/completeJobAsProvider";

// Provider job completion (SOP §8 "Job completion tools: notes, photos, status
// updates, completed marker").
//
// Clock-out is the normal way a job completes and it already collects the
// write-up, so this panel is deliberately quiet in the common case. It exists
// for the two things clock-out can't do: close out a job that has no clock
// record at all, and add or fix the notes afterwards.
export default function CompletionPanel({
  jobId,
  status,
  completionNotes,
  hasClockIn,
  hasClockOut,
  completedAt,
}: {
  jobId: string;
  status: string;
  completionNotes: string | null;
  hasClockIn: boolean;
  hasClockOut: boolean;
  completedAt: string | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(completionNotes ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isComplete = status === "COMPLETED" || status === "PAID";
  // Paid = financially closed. The write-up is part of the billing record now,
  // so it becomes read-only rather than something a provider can revise.
  const isLocked = status === "PAID";
  // An open clock must be closed by clocking out — that's what bills the hours.
  const clockOpen = hasClockIn && !hasClockOut;
  const canMarkComplete = !isComplete;

  const dirty = notes.trim() !== (completionNotes ?? "").trim();

  function submit() {
    setMsg(null);
    start(async () => {
      // Always send the string, even when empty — that's how the provider
      // clears notes they'd rather not have said.
      const res = await completeJobAsProvider({ jobId, completionNotes: notes });
      if (res.success) {
        setMsg({
          ok: true,
          text: isComplete ? "Notes saved." : "Job marked complete.",
        });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "Failed" });
      }
    });
  }

  // A cancelled job has nothing to complete and nothing to write up.
  if (status === "CANCELLED") return null;

  // The clock is open. The only correct next action is Clock Out — which is
  // already on this page, and collects the write-up itself. Rendering a "mark
  // complete" here would be a button the server is bound to refuse: completing
  // a job with an open clock would strand clockOutTime as null and silently
  // destroy the provider's billable hours.
  if (clockOpen) return null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 mt-4">
      <h3 className="font-semibold flex items-center gap-2 mb-2">
        <ClipboardCheck size={18} /> Job completion
      </h3>

      {isComplete && (
        <div className="flex items-center gap-2 text-sm text-green-700 mb-3">
          <CheckCircle2 size={15} />
          <span>
            Completed
            {completedAt
              ? ` on ${new Date(completedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : ""}
            .
          </span>
        </div>
      )}

      {canMarkComplete && !hasClockIn && (
        <div className="cl-eq-warn" style={{ marginBottom: 12 }}>
          <strong>
            <AlertTriangle size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "-2px" }} />
            No clock record on this job
          </strong>
          <span>
            You never clocked in, so there are no hours to bill. Marking it complete closes the
            job — ops will need to add your time before the client is charged.
          </span>
        </div>
      )}

      {isLocked ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
            Completion notes
          </div>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">
            {completionNotes || <span className="text-neutral-400 italic">None recorded.</span>}
          </p>
          <p className="text-xs text-neutral-400 mt-2">
            This job has been paid — notes are locked.
          </p>
        </div>
      ) : (
        <>
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
            Completion notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="What did you do? Anything ops or the client should know?"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="text-xs text-neutral-400 mt-1 mb-3">Optional · {notes.length}/4000</div>

          <button
            type="button"
            disabled={pending || (isComplete && !dirty)}
            onClick={submit}
            className="rounded-lg bg-neutral-900 text-white px-3 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            {isComplete ? "Save notes" : "Mark complete"}
          </button>
        </>
      )}

      {msg ? (
        <p className={`text-xs mt-2 ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
      ) : null}
    </div>
  );
}
