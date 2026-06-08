"use client";

import { useState } from "react";
import { CalendarX } from "lucide-react";
import { cancelRecurringService } from "../../actions/cancelRecurringService";

const FREQ_LABEL: Record<string, string> = {
  WEEKLY: "weekly",
  BIWEEKLY: "every 2 weeks",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
};

export default function CancelRecurringCard({ frequency }: { frequency: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ offerSent: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await cancelRecurringService({ reason });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error ?? "Something went wrong");
      return;
    }
    setDone({ offerSent: res.offerSent ?? false });
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white border border-[#1c1917]/10 p-6 text-sm text-[#1c1917]/80">
        <p className="font-medium text-[#1c1917]">Your recurring service is cancelled.</p>
        <p className="mt-1">
          {done.offerSent
            ? "We've emailed you a special offer in case you'd like to come back — no pressure."
            : "You can rebook any time from the booking page."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-[#1c1917]/10 p-6">
      <div className="flex items-start gap-3">
        <CalendarX className="w-5 h-5 text-[#1c1917]/50 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-[#1c1917]">
            Recurring service — {FREQ_LABEL[frequency] ?? frequency.toLowerCase()}
          </p>
          <p className="text-sm text-[#1c1917]/60 mt-0.5">
            Cancelling stops all upcoming visits in your series. You can rebook
            any time.
          </p>

          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 text-sm font-medium text-red-600 hover:underline"
            >
              Cancel recurring service
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Mind sharing why? (optional)"
                rows={2}
                className="w-full rounded-lg border border-[#1c1917]/15 px-3 py-2 text-sm"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm disabled:opacity-50"
                >
                  {submitting ? "Cancelling…" : "Confirm cancellation"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="rounded-lg border border-[#1c1917]/15 px-3 py-2 text-sm"
                >
                  Keep my plan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
