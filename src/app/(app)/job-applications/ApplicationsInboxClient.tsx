"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Mail, Phone, ExternalLink } from "lucide-react";
import { updateApplicationStatus } from "../actions/updateApplicationStatus";

type Status =
  | "NEW"
  | "REVIEWING"
  | "INTERVIEW"
  | "HIRED"
  | "REJECTED"
  | "ARCHIVED";

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  experience: string | null;
  coverLetter: string | null;
  resumeUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

const STATUSES: Status[] = [
  "NEW",
  "REVIEWING",
  "INTERVIEW",
  "HIRED",
  "REJECTED",
  "ARCHIVED",
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  NEW: { bg: "#dbeafe", color: "#1e40af" },
  REVIEWING: { bg: "#fef3c7", color: "#92400e" },
  INTERVIEW: { bg: "#e0e7ff", color: "#3730a3" },
  HIRED: { bg: "#d1fae5", color: "#065f46" },
  REJECTED: { bg: "#fee2e2", color: "#991b1b" },
  ARCHIVED: { bg: "#f3f4f6", color: "#6b7280" },
};

export default function ApplicationsInboxClient({
  applications,
}: {
  applications: Application[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | Status>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  const shown = applications.filter(
    (a) => filter === "ALL" || a.status === filter
  );

  async function setStatus(id: string, status: Status) {
    setBusyId(id);
    await updateApplicationStatus({ applicationId: id, status });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Job applications</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "ALL" | Status)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All ({applications.length})</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 && (
        <div className="text-center text-gray-400 py-16">
          No applications{filter === "ALL" ? "" : ` with status ${filter}`}.
        </div>
      )}

      <div className="space-y-3">
        {shown.map((a) => {
          const style = STATUS_STYLE[a.status] ?? STATUS_STYLE.ARCHIVED;
          return (
            <div
              key={a.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{a.name}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {a.status}
                    </span>
                    {a.position && (
                      <span className="text-xs text-gray-500">{a.position}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {a.email}
                    </span>
                    {a.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" /> {a.phone}
                      </span>
                    )}
                    {a.resumeUrl && (
                      <a
                        href={a.resumeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[#c44c03] hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" /> Résumé
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-400 shrink-0">
                  {new Date(a.createdAt).toLocaleDateString()}
                </div>
              </div>

              {(a.experience || a.coverLetter) && (
                <div className="mt-3 text-sm text-gray-600 space-y-1">
                  {a.experience && (
                    <p>
                      <span className="font-medium">Experience:</span>{" "}
                      {a.experience}
                    </p>
                  )}
                  {a.coverLetter && (
                    <p>
                      <span className="font-medium">Note:</span> {a.coverLetter}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">Move to:</span>
                {STATUSES.filter((s) => s !== a.status).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(a.id, s)}
                    disabled={busyId === a.id}
                    className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
