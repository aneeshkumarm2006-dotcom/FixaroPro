"use client";

import { useState } from "react";
import { MapPin, Clock, Briefcase, Users, CheckCircle2, Loader2 } from "lucide-react";
import { claimJob } from "./claimJob";

interface AvailableJob {
  id: string;
  jobNumber: number;
  startTime: string;
  isFlexible: boolean;
  location: string | null;
  jobType: string | null;
  price: number | null;
  bedCount: number | null;
  bathCount: number | null;
  requiredCleaners: number;
  claimedCount: number;
  notes: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function AvailableJobsClient({ jobs }: { jobs: AvailableJob[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleClaim(jobId: string) {
    setBusyId(jobId);
    setErrors((e) => { const n = { ...e }; delete n[jobId]; return n; });
    const res = await claimJob(jobId);
    setBusyId(null);
    if (res.success) {
      setClaimed((s) => new Set(s).add(jobId));
    } else {
      setErrors((e) => ({ ...e, [jobId]: res.error ?? "Failed to claim" }));
    }
  }

  const visible = jobs.filter((j) => !claimed.has(j.id));

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <CheckCircle2 className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500 font-medium">No available jobs right now.</p>
        <p className="text-gray-400 text-sm">Check back later — new jobs are posted as bookings come in.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {visible.map((job) => {
        const spotsLeft = job.requiredCleaners - job.claimedCount;
        const isBusy = busyId === job.id;

        return (
          <div
            key={job.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#005F6A]/60 uppercase tracking-wide mb-1">
                  Job #{job.jobNumber}
                </p>
                <p className="text-lg font-semibold text-[#005F6A]">
                  {fmtDate(job.startTime)}
                  {!job.isFlexible && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      · {fmtTime(job.startTime)}
                    </span>
                  )}
                </p>
                {job.isFlexible && (
                  <span className="inline-block mt-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                    Flexible time
                  </span>
                )}
              </div>
              {job.price != null && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">Est. pay</p>
                  <p className="text-lg font-bold text-[#005F6A]">
                    ${(job.price / 2).toFixed(0)}
                    <span className="text-xs font-normal text-gray-400">+</span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 text-sm text-gray-600">
              {job.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{job.location}</span>
                </div>
              )}
              {job.jobType && (
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{job.jobType}</span>
                  {(job.bedCount || job.bathCount) && (
                    <span className="text-gray-400">
                      · {job.bedCount ?? 0}bd / {job.bathCount ?? 0}ba
                    </span>
                  )}
                </div>
              )}
              {job.isFlexible && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-400">Time TBD by admin</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>
                  <span className="font-medium text-[#005F6A]">{spotsLeft}</span> spot{spotsLeft !== 1 ? "s" : ""} remaining
                </span>
              </div>
            </div>

            {job.notes && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 italic">
                {job.notes}
              </p>
            )}

            {errors[job.id] && (
              <p className="text-xs text-red-600">{errors[job.id]}</p>
            )}

            <button
              onClick={() => handleClaim(job.id)}
              disabled={isBusy}
              className="mt-auto w-full py-2.5 rounded-xl bg-[#005F6A] text-white text-sm font-semibold hover:bg-[#00424a] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {isBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claiming…
                </>
              ) : (
                "Claim this job"
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
