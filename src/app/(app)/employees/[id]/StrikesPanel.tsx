"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldCheck, Plus } from "lucide-react";
import { manageStrikes } from "@/app/(app)/actions/manageStrikes";
import {
  STRIKE_THRESHOLD,
  STRIKE_WINDOW_DAYS,
  STRIKE_REASON_LABELS,
  STRIKE_STATUS_LABELS,
  type StrikeReasonKey,
  type StrikeStatusKey,
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

interface StrikesPanelProps {
  cleanerId: string;
  summary: {
    activeCount: number;
    level: "none" | "warning" | "critical";
    strikes: StrikeRow[];
  };
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: "#fee2e2", color: "#991b1b" },
  EXCUSED: { bg: "#e0e7ff", color: "#3730a3" },
  REMOVED: { bg: "#f3f4f6", color: "#6b7280" },
};

export default function StrikesPanel({ cleanerId, summary }: StrikesPanelProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addNote, setAddNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reasonLabel = (r: string) =>
    STRIKE_REASON_LABELS[r as StrikeReasonKey] ?? r;
  const statusLabel = (s: string) =>
    STRIKE_STATUS_LABELS[s as StrikeStatusKey] ?? s;

  async function run(
    action: "remove" | "excuse" | "reactivate",
    strikeId: string
  ) {
    const note = window.prompt(
      `Add a note explaining why you are choosing to ${action} this strike (required):`
    );
    if (note == null) return;
    if (!note.trim()) {
      setError("A note is required.");
      return;
    }
    setBusyId(strikeId);
    setError(null);
    const res = await manageStrikes({ action, strikeId, note });
    setBusyId(null);
    if (!res.success) setError(res.error ?? "Action failed");
    else router.refresh();
  }

  async function add() {
    if (!addNote.trim()) {
      setError("A note is required to add a manual strike.");
      return;
    }
    setAdding(true);
    setError(null);
    const res = await manageStrikes({ action: "add", cleanerId, note: addNote });
    setAdding(false);
    if (!res.success) setError(res.error ?? "Failed to add strike");
    else {
      setAddNote("");
      router.refresh();
    }
  }

  const atThreshold = summary.activeCount >= STRIKE_THRESHOLD;

  return (
    <div className="space-y-5">
      {/* Summary banner */}
      <div
        className="flex items-center gap-3 rounded-xl p-4"
        style={
          summary.level === "critical"
            ? { background: "#fee2e2", color: "#991b1b" }
            : summary.level === "warning"
            ? { background: "#fffbeb", color: "#92400e" }
            : { background: "#ecfdf5", color: "#065f46" }
        }
      >
        {summary.level === "none" ? (
          <ShieldCheck className="w-5 h-5 shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 shrink-0" />
        )}
        <div>
          <div className="font-semibold">
            {summary.activeCount} active strike{summary.activeCount === 1 ? "" : "s"}{" "}
            (last {STRIKE_WINDOW_DAYS} days)
          </div>
          <div className="text-sm opacity-80">
            {atThreshold
              ? `At or above the ${STRIKE_THRESHOLD}-strike threshold — review required.`
              : `${STRIKE_THRESHOLD - summary.activeCount} more before the ${STRIKE_THRESHOLD}-strike threshold.`}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {/* Add manual strike */}
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Add a manual strike
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={addNote}
            onChange={(e) => setAddNote(e.target.value)}
            placeholder="Reason / note (required)"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={add}
            disabled={adding}
            className="flex items-center gap-1 rounded-lg bg-gray-900 text-white px-3 py-2 text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="space-y-2">
        {summary.strikes.length === 0 && (
          <div className="text-sm text-gray-400 py-6 text-center">
            No strikes on record.
          </div>
        )}
        {summary.strikes.map((s) => {
          const style = STATUS_STYLE[s.status] ?? STATUS_STYLE.REMOVED;
          return (
            <div
              key={s.id}
              className="rounded-xl border border-gray-200 p-3 flex items-start justify-between gap-3"
              style={{ opacity: s.status === "ACTIVE" ? 1 : 0.7 }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800">
                    {reasonLabel(s.reason)}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: style.bg, color: style.color }}
                  >
                    {statusLabel(s.status)}
                  </span>
                  {!s.countsTowardThreshold && s.status === "ACTIVE" && (
                    <span className="text-xs text-gray-400">(outside window)</span>
                  )}
                </div>
                {s.note && (
                  <div className="text-xs text-gray-500 mt-1 whitespace-pre-line">
                    {s.note}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(s.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {s.status === "ACTIVE" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => run("excuse", s.id)}
                      disabled={busyId === s.id}
                      className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Excuse
                    </button>
                    <button
                      type="button"
                      onClick={() => run("remove", s.id)}
                      disabled={busyId === s.id}
                      className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => run("reactivate", s.id)}
                    disabled={busyId === s.id}
                    className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
