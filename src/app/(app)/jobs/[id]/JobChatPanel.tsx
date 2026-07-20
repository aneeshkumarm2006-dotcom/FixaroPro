"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import useSWR from "swr";
import {
  listJobChatMessages,
  markJobChatRead,
  sendJobChatMessage,
  type JobChatPayload,
  type JobChatMessageDTO,
  type JobChatRole,
} from "@/app/(app)/actions/jobChatActions";
import { fmtDate, fmtTime } from "@/lib/timezone";

interface JobChatPanelProps {
  jobId: string;
  /** Current viewer's display name (used for optimistic bubbles). */
  viewerName?: string;
  /** Who the viewer is talking to — display only (placeholder + empty copy). */
  audienceLabel?: string;
  /** Card heading. */
  title?: string;
  /** When false, the composer is hidden (read-only). Defaults to true. */
  canSend?: boolean;
  /** Height for the scrollable message area. */
  height?: number;
}

// User-facing wording: the CLEANER enum is surfaced as "Pro"; ADMIN as the
// Fixaro office/brand.
const ROLE_LABEL: Record<JobChatRole, string> = {
  CLEANER: "Pro",
  CLIENT: "Client",
  ADMIN: "Fixaro",
};

function timeOnly(iso: string) {
  return fmtTime(iso);
}

/** Calendar day in the business timezone, as "MM/DD/YYYY" — stable group key. */
function businessDayKey(d: Date) {
  return fmtDate(d, { year: "numeric", month: "2-digit", day: "2-digit" });
}

function dayLabel(d: Date) {
  // Compare Toronto calendar days, not the viewer's local days.
  const todayKey = businessDayKey(new Date());
  const thisKey = businessDayKey(d);
  const diff = Math.round(
    (Date.parse(todayKey) - Date.parse(thisKey)) / 86400000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return fmtDate(d, { weekday: "long" });
  return fmtDate(d, { month: "short", day: "numeric" });
}

function groupByDay(messages: JobChatMessageDTO[]) {
  const groups: { label: string; messages: JobChatMessageDTO[] }[] = [];
  let currentKey = "";
  for (const m of messages) {
    const d = new Date(m.createdAt);
    const key = businessDayKey(d);
    if (key !== currentKey) {
      currentKey = key;
      groups.push({ label: dayLabel(d), messages: [m] });
    } else {
      groups[groups.length - 1].messages.push(m);
    }
  }
  return groups;
}

export default function JobChatPanel({
  jobId,
  viewerName,
  audienceLabel = "the team",
  title = "Job chat",
  canSend = true,
  height = 360,
}: JobChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, mutate } = useSWR<JobChatPayload>(
    ["job-chat", jobId],
    async () => {
      const res = await listJobChatMessages(jobId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    { refreshInterval: 4000, revalidateOnFocus: true }
  );

  const messages = useMemo(() => data?.messages ?? [], [data]);
  const grouped = useMemo(() => groupByDay(messages), [messages]);

  // Mark the other parties' messages as read for THIS surface's role whenever
  // the thread loads or grows. The read column is chosen server-side from the
  // session role, so every surface only stamps its own timestamp.
  const incomingCount = useMemo(
    () => messages.filter((m) => !m.mine).length,
    [messages]
  );
  useEffect(() => {
    if (incomingCount === 0) return;
    markJobChatRead(jobId).catch(() => {});
  }, [jobId, incomingCount]);

  // Keep the thread pinned to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSendError(null);
    setSending(true);
    setDraft("");

    const optimistic: JobChatMessageDTO = {
      id: `optimistic-${Date.now()}`,
      jobId,
      senderId: "me",
      senderRole: data?.viewerRole ?? "ADMIN",
      senderName: viewerName ?? "You",
      body,
      createdAt: new Date().toISOString(),
      mine: true,
    };
    await mutate(
      (current) =>
        current
          ? { ...current, messages: [...current.messages, optimistic] }
          : current,
      { revalidate: false }
    );

    const res = await sendJobChatMessage(jobId, body);
    setSending(false);
    if (!res.success) {
      setDraft(body);
      setSendError(res.error);
      await mutate();
      return;
    }
    await mutate();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    const t = e.target;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 120) + "px";
  }

  return (
    <div className="jc-card">
      <div className="jc-head">
        <span className="jc-head-icon">
          <MessageSquare size={16} />
        </span>
        <div>
          <h3 className="jc-head-title">{title}</h3>
          <p className="jc-head-sub">Office, Pro &amp; client — one thread per job</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="jc-scroll" style={{ height }}>
        {grouped.length === 0 ? (
          <div className="jc-empty">
            <div className="jc-empty-icon">
              <MessageSquare size={20} />
            </div>
            <p className="jc-empty-title">No messages yet</p>
            <p className="jc-empty-sub">
              {canSend
                ? `Send a message about this job to ${audienceLabel}.`
                : "No messages have been exchanged for this job."}
            </p>
          </div>
        ) : (
          grouped.map((group, gi) => (
            <div key={gi}>
              <div className="jc-day-divider">{group.label}</div>
              {group.messages.map((m) => (
                <div
                  key={m.id}
                  className={`jc-msg ${m.mine ? "mine" : "theirs"}`}>
                  <div className="jc-bubble">
                    {!m.mine && (
                      <div className="jc-sender">
                        {m.senderName}
                        <span className="jc-role-pill">
                          {ROLE_LABEL[m.senderRole]}
                        </span>
                      </div>
                    )}
                    {m.body && <div className="jc-body">{m.body}</div>}
                    <div className="jc-time">{timeOnly(m.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* Composer */}
      {canSend && (
        <div className="jc-composer">
          {sendError && (
            <div className="jc-error">Failed to send: {sendError}</div>
          )}
          <div className="jc-composer-row">
            <textarea
              rows={1}
              value={draft}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${audienceLabel}…`}
              maxLength={4000}
            />
            <button
              className="jc-send"
              onClick={handleSend}
              disabled={sending || draft.trim().length === 0}
              aria-label="Send">
              <Send size={14} />
            </button>
          </div>
          <div className="jc-composer-hint">⏎ to send · ⇧⏎ for new line</div>
        </div>
      )}

      <style jsx>{`
        .jc-card {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--primary-15);
          border-radius: 14px;
          overflow: hidden;
          background: #fff;
        }
        .jc-head {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border-bottom: 1px solid var(--primary-10);
          background: #fff;
        }
        .jc-head-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(232, 93, 4, 0.1);
          color: #e85d04;
          flex: 0 0 auto;
        }
        .jc-head-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
        }
        .jc-head-sub {
          margin: 2px 0 0;
          font-size: 12px;
          color: var(--primary-50);
        }
        .jc-scroll {
          overflow-y: auto;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          background: var(--cream);
        }
        .jc-empty {
          margin: auto;
          text-align: center;
        }
        .jc-empty-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--primary-5);
          color: var(--primary-40);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }
        .jc-empty-title {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--primary-70);
          margin: 0 0 4px;
        }
        .jc-empty-sub {
          font-size: 12px;
          color: var(--primary-50);
          margin: 0;
        }
        .jc-day-divider {
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: var(--primary-50);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 14px 0 8px;
        }
        .jc-msg {
          display: flex;
          margin-top: 4px;
        }
        .jc-msg.mine {
          justify-content: flex-end;
        }
        .jc-msg.theirs {
          justify-content: flex-start;
        }
        .jc-bubble {
          max-width: 78%;
          padding: 8px 12px;
          border-radius: 14px;
          font-size: 14px;
          line-height: 1.45;
          word-break: break-word;
        }
        .jc-msg.mine .jc-bubble {
          background: #e85d04;
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .jc-msg.theirs .jc-bubble {
          background: #fff;
          color: var(--ink);
          border: 1px solid var(--primary-15);
          border-bottom-left-radius: 4px;
        }
        .jc-body {
          white-space: pre-wrap;
        }
        .jc-sender {
          font-size: 10.5px;
          font-weight: 600;
          color: var(--primary-70);
          margin-bottom: 2px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .jc-role-pill {
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          border-radius: 999px;
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          background: var(--primary-10);
          color: var(--primary-70);
        }
        .jc-time {
          font-size: 10px;
          opacity: 0.65;
          margin-top: 3px;
          text-align: right;
        }
        .jc-composer {
          padding: 12px 16px 14px;
          border-top: 1px solid var(--primary-10);
          background: #fff;
        }
        .jc-error {
          font-size: 12px;
          color: #b42318;
          background: #fef3f2;
          border: 1px solid #fecdca;
          border-radius: 8px;
          padding: 6px 12px;
          margin-bottom: 10px;
        }
        .jc-composer-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }
        .jc-composer-row textarea {
          flex: 1;
          resize: none;
          border: 1px solid var(--primary-15);
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 14px;
          font-family: inherit;
          line-height: 1.4;
          color: var(--ink);
          background: #fff;
          max-height: 120px;
          outline: none;
        }
        .jc-composer-row textarea:focus {
          border-color: #e85d04;
          box-shadow: 0 0 0 3px rgba(232, 93, 4, 0.12);
        }
        .jc-composer-row textarea::placeholder {
          color: var(--primary-40);
        }
        .jc-send {
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          border: none;
          border-radius: 10px;
          background: #e85d04;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, opacity 0.15s ease;
        }
        .jc-send:hover:not(:disabled) {
          background: #cf5203;
        }
        .jc-send:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .jc-composer-hint {
          font-size: 11px;
          color: var(--primary-40);
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}
