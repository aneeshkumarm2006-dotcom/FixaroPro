"use client";

import { useState, useTransition } from "react";
import { Paintbrush, MapPin, Loader2, Check } from "lucide-react";
import { placeBid } from "../actions/placeBid";

interface PaintingJob {
  id: string;
  jobNumber: number;
  startTime: string;
  isFlexible: boolean;
  location: string | null;
  scopeLabel: string;
  quoteRangeMin: number | null;
  quoteRangeMax: number | null;
  notes: string | null;
  myBidAmount: number | null;
  myBidNote: string | null;
}

export default function PaintingBidsClient({
  jobs,
  eligible,
}: {
  jobs: PaintingJob[];
  eligible: boolean;
}) {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Paintbrush size={22} /> Painting Bids
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Submit your lowest bid to win the job. The software automatically accepts the lowest
          valid bid when bidding closes. Final customer price = your bid + 35%.
        </p>
      </header>

      {!eligible ? (
        <p className="text-sm text-neutral-500">
          You're not approved for painting jobs yet. Ask an admin to add Painting to your
          approved services.
        </p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-neutral-500">No painting jobs are open for bids right now.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <BidCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function BidCard({ job }: { job: PaintingJob }) {
  const [amount, setAmount] = useState(job.myBidAmount ? String(job.myBidAmount) : "");
  const [note, setNote] = useState(job.myBidNote ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit() {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setMsg({ ok: false, text: "Enter a valid bid amount." });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await placeBid({ jobId: job.id, amount: value, note });
      setMsg(
        res.success
          ? { ok: true, text: "Bid submitted." }
          : { ok: false, text: res.error ?? "Failed to submit bid." }
      );
    });
  }

  const date = new Date(job.startTime).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rounded-xl border border-neutral-200 p-4 bg-white">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-medium">
            {job.scopeLabel} · #{job.jobNumber}
          </p>
          <p className="text-sm text-neutral-500 flex items-center gap-1 mt-0.5">
            <MapPin size={13} /> {job.location ?? "—"} · {date}
            {job.isFlexible ? " (flexible)" : ""}
          </p>
          {job.quoteRangeMin != null && job.quoteRangeMax != null ? (
            <p className="text-xs text-neutral-400 mt-1">
              Customer estimate: ${job.quoteRangeMin.toFixed(0)}–${job.quoteRangeMax.toFixed(0)}
            </p>
          ) : null}
        </div>
        {job.myBidAmount != null ? (
          <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 inline-flex items-center gap-1">
            <Check size={12} /> Your bid: ${job.myBidAmount.toFixed(2)}
          </span>
        ) : null}
      </div>

      {job.notes ? (
        <p className="text-sm text-neutral-600 mt-2 whitespace-pre-wrap">{job.notes}</p>
      ) : null}

      <div className="flex items-end gap-2 mt-3 flex-wrap">
        <label className="flex flex-col text-xs text-neutral-500">
          Your bid (CAD)
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-neutral-500 flex-1 min-w-[140px]">
          Note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything ops should know"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-60">
          {pending ? <Loader2 size={14} className="animate-spin" /> : null}
          {job.myBidAmount != null ? "Update bid" : "Submit bid"}
        </button>
      </div>

      {msg ? (
        <p className={`text-xs mt-2 ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
      ) : null}
    </div>
  );
}
