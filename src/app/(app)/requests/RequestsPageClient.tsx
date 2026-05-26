"use client";

import { useMemo, useState } from "react";
import { Inbox, Check, X, ExternalLink } from "lucide-react";
import Card from "@/components/ui/Card";
import { ConfirmActionModal } from "@/components/common/ConfirmActionModal";
import { resolveJobRequest } from "../actions/resolveJobRequest";

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
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  cleaners: { id: string; name: string }[];
}

type Filter = "all" | "cancellation" | "reschedule";

export default function RequestsPageClient({ jobs }: { jobs: JobRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "cancellation")
      return jobs.filter((j) => j.cancellationRequestedAt);
    if (filter === "reschedule")
      return jobs.filter((j) => j.rescheduleRequestedAt);
    return jobs;
  }, [jobs, filter]);

  const counts = {
    all: jobs.length,
    cancellation: jobs.filter((j) => j.cancellationRequestedAt).length,
    reschedule: jobs.filter((j) => j.rescheduleRequestedAt).length,
  };

  const [pending, setPending] = useState<{
    jobId: string;
    kind: "cancellation" | "reschedule";
    decision: "approve" | "deny";
    msg: string;
  } | null>(null);

  function handle(
    jobId: string,
    kind: "cancellation" | "reschedule",
    decision: "approve" | "deny"
  ) {
    const msg =
      kind === "cancellation" && decision === "approve"
        ? "Approve this cancellation? The job will be marked as CANCELLED."
        : `Mark this ${kind} request as ${decision === "approve" ? "approved" : "denied"}?`;
    setPending({ jobId, kind, decision, msg });
  }

  async function confirmHandle() {
    if (!pending) return;
    const { jobId, kind, decision } = pending;
    setPending(null);
    setBusyId(jobId);
    setError(null);
    const res = await resolveJobRequest({ jobId, kind, decision });
    setBusyId(null);
    if (!res.success) setError(res.error || "Failed to resolve");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl !font-light tracking-tight text-[#005F6A] flex items-center gap-3">
          <Inbox className="w-7 h-7" /> Pending Requests
        </h1>
        <p className="text-sm text-[#005F6A]/70 mt-1">
          Customer-initiated cancellation and reschedule requests that need a
          decision from you.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card variant="default" className="p-5">
        <div className="flex flex-wrap gap-1 mb-5">
          {([
            ["all", `All (${counts.all})`],
            ["cancellation", `Cancellation (${counts.cancellation})`],
            ["reschedule", `Reschedule (${counts.reschedule})`],
          ] as [Filter, string][]).map(([k, label]) => {
            const active = filter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                  active
                    ? "bg-[#005F6A] text-white"
                    : "bg-[#005F6A]/5 text-[#005F6A] hover:bg-[#005F6A]/10"
                }`}>
                {label}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center text-sm text-[#005F6A]/60 py-12">
            No pending requests. 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((j) => {
              const kinds: ("cancellation" | "reschedule")[] = [];
              if (j.cancellationRequestedAt) kinds.push("cancellation");
              if (j.rescheduleRequestedAt) kinds.push("reschedule");
              const requestedAt =
                j.cancellationRequestedAt ?? j.rescheduleRequestedAt;
              const startStr = new Date(j.startTime).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <article
                  key={j.id}
                  className="rounded-xl border border-[#005F6A]/10 bg-white p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-[#005F6A]/60 font-medium">
                        Job #{j.jobNumber}
                      </div>
                      <div className="text-lg font-medium text-[#005F6A] mt-0.5">
                        {startStr}
                        {j.isFlexible ? (
                          <span className="ml-2 text-xs text-[#005F6A]/60 font-normal">
                            (flexible)
                          </span>
                        ) : null}
                      </div>
                      {j.location ? (
                        <div className="text-xs text-[#005F6A]/60 mt-1">
                          {j.location}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-1.5">
                      {kinds.map((k) => (
                        <span
                          key={k}
                          className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                            k === "cancellation"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                          }`}>
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-[#005F6A]/70">
                    {j.client ? (
                      <span>
                        {j.client.name}
                        {j.client.email ? ` · ${j.client.email}` : ""}
                        {j.client.phone ? ` · ${j.client.phone}` : ""}
                      </span>
                    ) : null}
                    {j.cleaners.length ? (
                      <span>
                        with {j.cleaners.map((c) => c.name).join(", ")}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[#005F6A]/10">
                    <a
                      href={`/jobs/${j.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[#005F6A]/70 hover:bg-[#005F6A]/5">
                      <ExternalLink className="w-3.5 h-3.5" /> Open job
                    </a>
                    <div className="flex-1" />
                    {kinds.map((k) => (
                      <div key={k} className="inline-flex gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === j.id}
                          onClick={() => handle(j.id, k, "approve")}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white disabled:opacity-50 ${
                            k === "cancellation"
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }`}>
                          <Check className="w-3.5 h-3.5" />
                          Approve {k}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === j.id}
                          onClick={() => handle(j.id, k, "deny")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[#005F6A] bg-[#005F6A]/5 hover:bg-[#005F6A]/10 disabled:opacity-50">
                          <X className="w-3.5 h-3.5" /> Deny
                        </button>
                      </div>
                    ))}
                  </div>

                  {requestedAt ? (
                    <div className="text-[10px] text-[#005F6A]/40">
                      Requested {new Date(requestedAt).toLocaleString()}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <ConfirmActionModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        onConfirm={confirmHandle}
        title={
          pending?.decision === "approve"
            ? `Approve ${pending?.kind}?`
            : `Deny ${pending?.kind}?`
        }
        message={pending?.msg ?? ""}
        confirmLabel={pending?.decision === "approve" ? "Approve" : "Deny"}
      />
    </div>
  );
}
