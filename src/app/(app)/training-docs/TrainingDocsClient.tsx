"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Star,
  FileText,
  Lock,
  Play,
  ExternalLink,
} from "lucide-react";
import { initials } from "@/lib/avatar";
import { updateTrainingProgress } from "@/app/(app)/actions/updateTrainingProgress";

type TrainingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
type SignatureStatus = "SIGNED" | "PENDING" | "REVOKED" | "NONE";

interface ModuleItem {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  isRequired: boolean;
  hasQuiz: boolean;
  status: TrainingStatus;
  videoProgress: number;
  quizScore: number | null;
}
interface DocItem {
  id: string;
  title: string;
  description: string | null;
  version: string;
  status: SignatureStatus;
  signedAt: string | null;
}
interface ActivityItem {
  id: string;
  who: string;
  title: string;
  action: "signed" | "completed";
  at: string;
}

interface Props {
  modules: ModuleItem[];
  documents: DocItem[];
  activity: ActivityItem[];
}

const ACTION_TINT: Record<ActivityItem["action"], { bg: string; fg: string; label: string }> = {
  signed: { bg: "var(--emerald-100)", fg: "var(--emerald-800)", label: "signed" },
  completed: { bg: "var(--blue-100)", fg: "var(--blue-800)", label: "completed" },
};

function formatAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) {
    const h = Math.round(mins / 60);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.round(mins / 1440);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function formatDuration(mins: number | null) {
  if (mins == null || mins <= 0) return "Video";
  return `${mins} min`;
}

function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        border: 0,
        background: "var(--primary)",
      }}>
      {initials(name)}
    </span>
  );
}

const isWatched = (m: ModuleItem) => m.videoProgress >= 0.9 || m.status === "COMPLETED";
const isModuleComplete = (m: ModuleItem) => m.status === "COMPLETED";

export default function TrainingDocsClient({ modules, documents, activity }: Props) {
  const router = useRouter();
  const [showLog, setShowLog] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Onboarding gate is derived from REAL progress. Required modules define the
  // gate; if nothing is marked required, fall back to all active modules.
  const requiredModules = modules.filter((m) => m.isRequired);
  const gateModules = requiredModules.length ? requiredModules : modules;

  const watchedCount = gateModules.filter(isWatched).length;
  const completedCount = gateModules.filter(isModuleComplete).length;
  const videosDone = gateModules.length > 0 && watchedCount === gateModules.length;
  // Vacuously unlocked when there is nothing to gate (empty DB).
  const unlocked =
    gateModules.length === 0 || completedCount === gateModules.length;

  const signedCount = documents.filter((d) => d.status === "SIGNED").length;

  const steps = [
    {
      label: "Watch videos",
      sub:
        gateModules.length === 0
          ? "No videos assigned"
          : `${watchedCount} / ${gateModules.length} complete`,
      done: videosDone,
      active: gateModules.length > 0 && !videosDone,
    },
    {
      label: "Pass the quiz",
      sub: unlocked
        ? "All required modules passed"
        : videosDone
        ? "Ready to take"
        : "Locked",
      done: unlocked && gateModules.length > 0,
      active: videosDone && !unlocked,
    },
    {
      label: "Documents unlocked",
      sub: unlocked
        ? documents.length === 0
          ? "No documents yet"
          : `${signedCount}/${documents.length} signed`
        : "Locked",
      done: unlocked,
      active: false,
    },
  ];

  async function markWatched(m: ModuleItem) {
    if (pendingId) return;
    setPendingId(m.id);
    setError(null);
    // Reuse the SAME progress mechanism as /training (updateTrainingProgress).
    // A full watch sets videoProgress to 1; modules without a quiz complete
    // immediately, modules with a quiz move to IN_PROGRESS pending the quiz.
    const res = await updateTrainingProgress({
      moduleId: m.id,
      videoProgress: 1,
      markComplete: !m.hasQuiz,
    });
    setPendingId(null);
    if (!res.success) {
      setError(res.error || "Could not update progress. Please try again.");
      return;
    }
    // Re-fetch the server component so derived gate/state reflect the DB.
    startTransition(() => router.refresh());
  }

  return (
    <div className="admin-font">
      <header
        className="row-between"
        style={{ marginBottom: 24, alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div className="stack-8">
          <p className="eyebrow">Onboarding · Compliance</p>
          <h1 className="display" style={{ fontSize: "clamp(30px, 3.6vw, 42px)" }}>
            Training &amp; documents
          </h1>
        </div>
        <button
          className={`td-viewtoggle ${showLog ? "on" : ""}`}
          onClick={() => setShowLog((s) => !s)}>
          {showLog ? "Hide activity log" : "Show activity log"}
        </button>
      </header>

      {error ? (
        <div
          className="td-error"
          role="alert">
          {error}
        </div>
      ) : null}

      {/* Unlock-gate stepper — read-only summary derived from real progress */}
      <div className="td-stepper">
        {steps.map((s, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div className={`td-step ${s.done ? "done" : s.active ? "active" : ""}`}>
              <span className="td-step-dot">{s.done ? <Check size={15} /> : i + 1}</span>
              <div>
                <div className="td-step-label">{s.label}</div>
                <div className="td-step-sub">{s.sub}</div>
              </div>
            </div>
            {i < steps.length - 1 ? (
              <span className={`td-step-bar ${steps[i].done ? "done" : ""}`} />
            ) : null}
          </div>
        ))}
      </div>

      <div className="td-grid">
        {/* Left: videos + quiz */}
        <div className="td-col">
          <div className="td-seclabel">Required videos</div>
          {modules.length === 0 ? (
            <div className="td-empty">
              No training modules have been published yet.
            </div>
          ) : (
            <div className="td-cards">
              {modules.map((m) => {
                const done = isWatched(m);
                const busy = pendingId === m.id;
                return (
                  <div className={`td-video ${done ? "done" : ""}`} key={m.id}>
                    <span className="td-video-thumb">
                      {done ? <Check size={16} /> : <Play size={14} fill="currentColor" />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="td-video-title">
                        {m.title}
                        {m.isRequired ? <span className="td-req">Required</span> : null}
                      </div>
                      <div className="td-video-meta">
                        {formatDuration(m.duration)} ·{" "}
                        {m.status === "COMPLETED"
                          ? "Completed"
                          : done
                          ? m.hasQuiz
                            ? "Watched · quiz pending"
                            : "Watched"
                          : "Not watched"}
                      </div>
                    </div>
                    {m.status === "COMPLETED" ? (
                      <span className="td-check" title="Completed">
                        <CheckCircle2 size={18} />
                      </span>
                    ) : done ? (
                      <Link href={`/training/${m.id}`} className="btn btn-secondary btn-sm">
                        Open
                      </Link>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={busy || !!pendingId}
                        onClick={() => markWatched(m)}>
                        {busy ? "Saving…" : "Mark watched"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="td-seclabel" style={{ marginTop: 22 }}>
            Knowledge quiz
          </div>
          {(() => {
            const quizModules = modules.filter((m) => m.hasQuiz);
            if (quizModules.length === 0) {
              return (
                <div className="td-quiz locked">
                  <span className="td-quiz-icon">
                    <Lock size={18} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="td-quiz-title">No quizzes</div>
                    <div className="td-quiz-sub">
                      None of the current modules include a knowledge quiz.
                    </div>
                  </div>
                </div>
              );
            }
            const allQuizPassed = quizModules.every((m) => m.status === "COMPLETED");
            const anyReady = quizModules.some(
              (m) => isWatched(m) && m.status !== "COMPLETED"
            );
            const state = allQuizPassed ? "passed" : anyReady ? "ready" : "locked";
            const nextModule =
              quizModules.find((m) => isWatched(m) && m.status !== "COMPLETED") ??
              quizModules.find((m) => m.status !== "COMPLETED");
            return (
              <div className={`td-quiz ${state}`}>
                <span className="td-quiz-icon">
                  {state === "passed" ? (
                    <CheckCircle2 size={20} />
                  ) : state === "ready" ? (
                    <Star size={20} />
                  ) : (
                    <Lock size={18} />
                  )}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="td-quiz-title">
                    {state === "passed"
                      ? "All quizzes passed"
                      : state === "ready"
                      ? "Quiz ready"
                      : "Quiz locked"}
                  </div>
                  <div className="td-quiz-sub">
                    {state === "passed"
                      ? "Every module quiz has been completed."
                      : state === "ready"
                      ? "Watch a module, then take its quiz to finish."
                      : "Watch the required videos to unlock the quiz."}
                  </div>
                </div>
                {state === "ready" && nextModule ? (
                  <Link
                    href={`/training/${nextModule.id}`}
                    className="btn btn-primary btn-sm">
                    Take quiz
                  </Link>
                ) : null}
              </div>
            );
          })()}
        </div>

        {/* Right: documents (gated by real training completion) */}
        <div className="td-col">
          <div className="td-seclabel">
            Documents
            <span className={`td-lockpill ${unlocked ? "open" : ""}`}>
              {unlocked ? (
                <>
                  <Check size={11} /> Unlocked
                </>
              ) : (
                <>
                  <Lock size={11} /> Locked
                </>
              )}
            </span>
          </div>

          {documents.length === 0 ? (
            <div className="td-empty">No documents have been published yet.</div>
          ) : !unlocked ? (
            <div className="td-lockedcard">
              <span className="td-lockedcard-icon">
                <Lock size={26} />
              </span>
              <h3 className="td-lockedcard-title">
                {documents.length} document{documents.length === 1 ? "" : "s"} locked
              </h3>
              <p className="td-lockedcard-sub">
                Complete the required videos and pass the quiz to unlock the document
                library. Titles are listed, but content stays withheld until the gate is
                cleared.
              </p>
              <div className="td-lockedcard-prog">
                <div className="td-lockedcard-progrow">
                  <span>Videos watched</span>
                  <strong>
                    {watchedCount}/{gateModules.length}
                  </strong>
                </div>
                <div className="score-bar">
                  <span
                    className="score-fill"
                    style={{
                      width: `${
                        gateModules.length
                          ? (watchedCount / gateModules.length) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="td-lockedcard-progrow" style={{ marginTop: 12 }}>
                  <span>Modules completed</span>
                  <strong
                    style={{
                      color: videosDone ? "var(--amber-700)" : "var(--primary-50)",
                    }}>
                    {completedCount}/{gateModules.length}
                  </strong>
                </div>
              </div>
              <div className="td-lockedlist">
                {documents.map((d) => (
                  <div className="td-lockedlist-item" key={d.id}>
                    <Lock size={13} />
                    <span>{d.title}</span>
                    <span className="td-lockedlist-meta">v{d.version}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="td-cards">
              {documents.map((d) => (
                <div className="td-doc" key={d.id}>
                  <span className="td-doc-icon">
                    <FileText size={17} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="td-doc-title">{d.title}</div>
                    <div className="td-doc-meta">
                      v{d.version} ·{" "}
                      {d.status === "SIGNED"
                        ? "Signed"
                        : d.status === "REVOKED"
                        ? "Revoked"
                        : d.status === "PENDING"
                        ? "Awaiting your signature"
                        : "Not assigned to you"}
                    </div>
                  </div>
                  <Link
                    href={`/documents/${d.id}`}
                    className="btn btn-secondary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    View <ExternalLink size={13} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity log — real signings + completions. Route is admin-gated. */}
      {showLog ? (
        <div style={{ marginTop: 26 }}>
          <div className="td-seclabel">
            Recent activity{" "}
            <span
              style={{
                color: "var(--primary-50)",
                fontWeight: 400,
                textTransform: "none",
                letterSpacing: 0,
              }}>
              · admin only
            </span>
          </div>
          {activity.length === 0 ? (
            <div className="td-empty">No signings or completions recorded yet.</div>
          ) : (
            <div className="atable-wrap">
              <div className="atable-scroll">
                <table className="atable">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Item</th>
                      <th>Action</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((a) => {
                      const cfg = ACTION_TINT[a.action];
                      return (
                        <tr key={a.id} style={{ cursor: "default" }}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Avatar name={a.who} size={30} />
                              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                                {a.who}
                              </span>
                            </div>
                          </td>
                          <td style={{ color: "var(--ink-soft)" }}>{a.title}</td>
                          <td>
                            <span className="pill" style={{ background: cfg.bg, color: cfg.fg }}>
                              {cfg.label}
                            </span>
                          </td>
                          <td style={{ color: "var(--primary-60)", fontSize: 12.5 }}>
                            {formatAgo(a.at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <style jsx>{`
        /* td-grid and td-seclabel are defined globally in globals.css — reused, not
           redefined here. Everything below fills the previously-undefined classes. */
        .td-viewtoggle {
          appearance: none;
          border: 1px solid var(--primary-15);
          background: var(--surface);
          color: var(--primary-60);
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          padding: 9px 16px;
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .td-viewtoggle:hover {
          border-color: var(--primary-30);
          color: var(--ink);
        }
        .td-viewtoggle.on {
          background: var(--primary);
          border-color: var(--primary);
          color: #fff;
        }

        .td-error {
          margin-bottom: 18px;
          padding: 11px 15px;
          border-radius: 12px;
          background: var(--amber-50);
          border: 1px solid var(--amber-200);
          color: var(--amber-800);
          font-size: 13px;
          font-weight: 500;
        }

        /* Stepper */
        .td-stepper {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
          padding: 18px 20px;
          margin-bottom: 22px;
          border: 1px solid var(--primary-10);
          border-radius: 18px;
          background: var(--surface);
        }
        .td-step {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .td-step-dot {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
          background: var(--primary-10);
          color: var(--primary-50);
        }
        .td-step.active .td-step-dot {
          background: var(--amber-50);
          color: var(--amber-700);
          box-shadow: 0 0 0 3px var(--amber-50);
        }
        .td-step.done .td-step-dot {
          background: var(--emerald-600);
          color: #fff;
        }
        .td-step-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }
        .td-step-sub {
          font-size: 12px;
          color: var(--primary-50);
          margin-top: 1px;
        }
        .td-step-bar {
          flex: 1 1 24px;
          min-width: 24px;
          height: 2px;
          background: var(--primary-15);
          border-radius: 2px;
        }
        .td-step-bar.done {
          background: var(--emerald-600);
        }

        .td-col {
          min-width: 0;
        }
        .td-cards {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .td-empty {
          padding: 22px;
          border: 1px dashed var(--primary-15);
          border-radius: 14px;
          background: var(--surface);
          color: var(--primary-50);
          font-size: 13.5px;
          text-align: center;
        }

        /* Video cards */
        .td-video {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 13px 15px;
          border: 1px solid var(--primary-10);
          border-radius: 14px;
          background: var(--surface);
        }
        .td-video.done {
          border-color: var(--emerald-100);
          background: color-mix(in srgb, var(--emerald-100) 32%, var(--surface));
        }
        .td-video-thumb {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          flex-shrink: 0;
          background: var(--primary-10);
          color: var(--primary-60);
        }
        .td-video.done .td-video-thumb {
          background: var(--emerald-600);
          color: #fff;
        }
        .td-video-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .td-video-meta {
          font-size: 12px;
          color: var(--primary-50);
          margin-top: 2px;
        }
        .td-req {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 7px;
          border-radius: 999px;
          background: var(--amber-50);
          color: var(--amber-700);
        }
        .td-check {
          color: var(--emerald-600);
          display: inline-flex;
          flex-shrink: 0;
        }

        /* Quiz card */
        .td-quiz {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 15px 16px;
          border-radius: 14px;
          border: 1px solid var(--primary-10);
          background: var(--surface);
        }
        .td-quiz.ready {
          border-color: var(--amber-200);
          background: var(--amber-50);
        }
        .td-quiz.passed {
          border-color: var(--emerald-100);
          background: color-mix(in srgb, var(--emerald-100) 32%, var(--surface));
        }
        .td-quiz-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 11px;
          flex-shrink: 0;
          background: var(--primary-10);
          color: var(--primary-50);
        }
        .td-quiz.ready .td-quiz-icon {
          background: #fff;
          color: var(--amber-700);
        }
        .td-quiz.passed .td-quiz-icon {
          background: var(--emerald-600);
          color: #fff;
        }
        .td-quiz-title {
          font-size: 14.5px;
          font-weight: 600;
          color: var(--ink);
        }
        .td-quiz-sub {
          font-size: 12.5px;
          color: var(--primary-50);
          margin-top: 2px;
        }

        /* Documents */
        .td-lockpill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-left: 8px;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: none;
          background: var(--primary-10);
          color: var(--primary-50);
          vertical-align: middle;
        }
        .td-lockpill.open {
          background: var(--emerald-100);
          color: var(--emerald-800);
        }
        .td-doc {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 13px 15px;
          border: 1px solid var(--primary-10);
          border-radius: 14px;
          background: var(--surface);
        }
        .td-doc-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          flex-shrink: 0;
          background: var(--primary-10);
          color: var(--primary-60);
        }
        .td-doc-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .td-doc-meta {
          font-size: 12px;
          color: var(--primary-50);
          margin-top: 2px;
        }

        /* Locked document card */
        .td-lockedcard {
          border: 1px solid var(--primary-10);
          border-radius: 18px;
          background: var(--surface);
          padding: 26px 22px;
          text-align: center;
        }
        .td-lockedcard-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          border-radius: 999px;
          background: var(--primary-10);
          color: var(--primary-50);
          margin-bottom: 14px;
        }
        .td-lockedcard-title {
          font-size: 17px;
          font-weight: 600;
          color: var(--ink);
          margin: 0 0 6px;
        }
        .td-lockedcard-sub {
          font-size: 13px;
          line-height: 1.5;
          color: var(--primary-50);
          max-width: 340px;
          margin: 0 auto 18px;
        }
        .td-lockedcard-prog {
          text-align: left;
          max-width: 340px;
          margin: 0 auto 18px;
        }
        .td-lockedcard-progrow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12.5px;
          color: var(--primary-60);
          margin-bottom: 7px;
        }
        .td-lockedcard-progrow strong {
          color: var(--ink);
          font-weight: 600;
        }
        .td-lockedlist {
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: left;
          max-width: 340px;
          margin: 0 auto;
        }
        .td-lockedlist-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 10px;
          background: var(--primary-5);
          color: var(--primary-60);
          font-size: 13px;
        }
        .td-lockedlist-item > span:first-of-type {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .td-lockedlist-meta {
          font-size: 11.5px;
          color: var(--primary-50);
          flex-shrink: 0;
        }

        /* Score bar (shared visual for the video-progress meter) */
        .score-bar {
          width: 100%;
          height: 7px;
          border-radius: 999px;
          background: var(--primary-10);
          overflow: hidden;
        }
        .score-fill {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: var(--emerald-600);
          transition: width 0.3s ease;
        }
      `}</style>
    </div>
  );
}
