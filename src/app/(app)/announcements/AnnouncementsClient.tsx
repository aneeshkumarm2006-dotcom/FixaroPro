"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  AlertCircle,
  Sparkles,
  Plus,
  Check,
  Pin,
  Trash2,
} from "lucide-react";
import { initials } from "@/lib/avatar";
import AdminModal from "@/components/ui/AdminModal";
import {
  createAnnouncement,
  togglePin as togglePinAction,
  deleteAnnouncement as deleteAnnouncementAction,
  toggleReaction as toggleReactionAction,
  acknowledgeAnnouncement as acknowledgeAction,
} from "./actions";

// Shape produced by page.tsx (server). Reaction counts are pre-aggregated and
// `youReacted` / `youAcked` are computed for the current viewer server-side.
export interface AnnouncementDTO {
  id: string;
  title: string;
  body: string;
  authorLabel: string;
  audience: string;
  pinned: boolean;
  createdAt: string; // ISO
  reactions: Record<string, number>;
  youReacted: string[];
  acked: number;
  total: number;
  youAcked: boolean;
}

// Must mirror the AnnouncementAudience enum (ALL / PROVIDERS / ADMINS).
const AUDIENCE = [
  { id: "ALL", label: "Everyone" },
  { id: "PROVIDERS", label: "Providers" },
  { id: "ADMINS", label: "Admins only" },
];
const audienceLabel = (id: string) =>
  (AUDIENCE.find((a) => a.id === id) || AUDIENCE[0]).label;

const REACTION_SET = ["👍", "🎉", "❤️"];

function formatAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const h = Math.floor((Date.now() - then) / 3_600_000);
  if (h <= 0) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.34, border: 0, background: "var(--primary)" }}>
      {initials(name)}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field" style={{ marginBottom: 14 }}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  up,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  up?: boolean;
}) {
  return (
    <div className="astat">
      <div className="astat-head">
        <span>{label}</span>
        <span className="astat-icon">{icon}</span>
      </div>
      <div className="astat-value">{value}</div>
      <div className={`astat-delta ${up ? "up" : ""}`}>{hint}</div>
    </div>
  );
}

function ComposeModal({
  onClose,
  onPublish,
}: {
  onClose: () => void;
  onPublish: (a: {
    title: string;
    body: string;
    pinned: boolean;
    audience: string;
  }) => Promise<{ success: boolean; error?: string }>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [audience, setAudience] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = title.trim() && body.trim();

  async function publish() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await onPublish({ title: title.trim(), body: body.trim(), pinned, audience });
    setSubmitting(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || "Failed to publish");
    }
  }

  return (
    <AdminModal
      open
      title="New announcement"
      subtitle="Posts to the team hub for the chosen audience."
      onClose={onClose}
      width={540}
      footer={
        <>
          <label className="an-pin-toggle" onClick={() => setPinned((p) => !p)}>
            <span className={`an-pin-check ${pinned ? "on" : ""}`}>
              {pinned ? <Check size={12} /> : null}
            </span>
            <Pin size={13} /> Pin to top
          </label>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-primary btn-sm" onClick={publish} disabled={!valid || submitting}>
            {submitting ? "Publishing…" : "Publish"}
          </button>
        </>
      }>
      {error ? <div className="an-error">{error}</div> : null}
      <Field label="Title">
        <input
          className="input aselect"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Holiday schedule changes"
          maxLength={200}
          autoFocus
        />
      </Field>
      <Field label="Message">
        <textarea
          className="an-textarea"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          placeholder="Write your announcement…"
        />
      </Field>
      <Field label="Audience">
        <select className="aselect" value={audience} onChange={(e) => setAudience(e.target.value)}>
          {AUDIENCE.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>
    </AdminModal>
  );
}

function AnnouncementCard({
  a,
  canManage,
  busy,
  onTogglePin,
  onDelete,
  onReact,
  onAck,
}: {
  a: AnnouncementDTO;
  canManage: boolean;
  busy: boolean;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onAck: (id: string) => void;
}) {
  const unread = !a.youAcked;
  return (
    <article className={`an-card ${a.pinned ? "pinned" : ""}`}>
      <div className="an-card-head">
        <Avatar name={a.authorLabel} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="an-author">{a.authorLabel}</span>
            <span className="an-aud">{audienceLabel(a.audience)}</span>
            {unread ? <span className="an-new">New</span> : null}
          </div>
          <div className="an-time">{formatAgo(a.createdAt)}</div>
        </div>
        {a.pinned ? (
          <span className="an-pinned-badge">
            <Pin size={12} /> Pinned
          </span>
        ) : null}
        {canManage ? (
          <>
            <button
              className="icon-btn"
              style={{ width: 30, height: 30 }}
              title={a.pinned ? "Unpin" : "Pin"}
              disabled={busy}
              onClick={() => onTogglePin(a.id)}>
              <Pin size={13} />
            </button>
            <button
              className="icon-btn an-del"
              style={{ width: 30, height: 30 }}
              title="Delete"
              disabled={busy}
              onClick={() => onDelete(a.id)}>
              <Trash2 size={13} />
            </button>
          </>
        ) : null}
      </div>

      <h3 className="an-title">{a.title}</h3>
      <p className="an-body">{a.body}</p>

      <div className="an-foot">
        <div className="an-reactions">
          {REACTION_SET.map((e) => {
            const n = a.reactions[e] || 0;
            const mine = a.youReacted.includes(e);
            return (
              <button
                key={e}
                className={`an-react ${n ? "has" : ""} ${mine ? "mine" : ""}`}
                disabled={busy}
                onClick={() => onReact(a.id, e)}>
                <span style={{ fontSize: 14 }}>{e}</span>
                {n ? <span className="an-react-n">{n}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="an-ack">
          <span className="an-ack-count">
            {a.acked}/{a.total} read
          </span>
          <button
            className={`btn btn-sm ${a.youAcked ? "btn-secondary" : "btn-primary"}`}
            disabled={a.youAcked || busy}
            onClick={() => onAck(a.id)}>
            {a.youAcked ? (
              <>
                <Check size={13} /> Acknowledged
              </>
            ) : (
              "Mark as read"
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function AnnouncementsClient({
  announcements,
  canManage,
}: {
  announcements: AnnouncementDTO[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const items = announcements; // already ordered pinned-first, newest-first
  const unread = items.filter((a) => !a.youAcked).length;
  const pinnedCount = items.filter((a) => a.pinned).length;

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function publish(input: {
    title: string;
    body: string;
    pinned: boolean;
    audience: string;
  }) {
    const res = await createAnnouncement(input);
    if (res.success) refresh();
    return res;
  }

  async function run(id: string, fn: () => Promise<{ success: boolean }>) {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fn();
      if (res.success) refresh();
    } finally {
      setBusyId(null);
    }
  }

  const togglePin = (id: string) => run(id, () => togglePinAction({ id }));
  const remove = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this announcement?")) return;
    run(id, () => deleteAnnouncementAction({ id }));
  };
  const react = (id: string, emoji: string) => run(id, () => toggleReactionAction({ id, emoji }));
  const ack = (id: string) => run(id, () => acknowledgeAction({ id }));

  return (
    <div className="admin-font">
      <header
        className="row-between"
        style={{ marginBottom: 24, alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div className="stack-8">
          <p className="eyebrow">Team hub</p>
          <h1 className="display" style={{ fontSize: "clamp(30px, 3.6vw, 42px)", whiteSpace: "nowrap" }}>
            Announcements
          </h1>
        </div>
        {canManage ? (
          <button className="btn btn-primary" onClick={() => setComposing(true)}>
            <Plus size={15} /> New announcement
          </button>
        ) : null}
      </header>

      <div
        className="astat-grid"
        style={{ marginBottom: 26, gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <Stat icon={<MessageCircle size={16} />} label="Posts" value={items.length} hint="visible to you" />
        <Stat icon={<AlertCircle size={16} />} label="Unread" value={unread} hint="not yet acknowledged" up={unread > 0} />
        <Stat icon={<Sparkles size={16} />} label="Pinned" value={pinnedCount} hint="kept at the top" />
      </div>

      {items.length === 0 ? (
        <div className="an-empty-state">
          <MessageCircle size={28} />
          <p className="an-empty-title">No announcements yet</p>
          <p className="an-empty-sub">
            {canManage
              ? "Publish the first update to reach the team."
              : "Check back soon — team updates will appear here."}
          </p>
          {canManage ? (
            <button className="btn btn-primary btn-sm" onClick={() => setComposing(true)}>
              <Plus size={14} /> New announcement
            </button>
          ) : null}
        </div>
      ) : (
        <div className="an-feed" aria-busy={pending}>
          {items.map((a) => (
            <AnnouncementCard
              key={a.id}
              a={a}
              canManage={canManage}
              busy={busyId === a.id || pending}
              onTogglePin={togglePin}
              onDelete={remove}
              onReact={react}
              onAck={ack}
            />
          ))}
        </div>
      )}

      {composing ? <ComposeModal onClose={() => setComposing(false)} onPublish={publish} /> : null}

      <style>{`
        .an-feed { display: flex; flex-direction: column; gap: 16px; }
        .an-card {
          background: #fff; border-radius: 16px; padding: 22px;
          box-shadow: var(--shadow-soft);
          border: 1px solid var(--primary-10);
          display: flex; flex-direction: column; gap: 12px;
        }
        .an-card.pinned {
          border-color: var(--primary-40);
          box-shadow: 0 0 0 1px var(--primary-20), var(--shadow-soft);
        }
        .an-card-head { display: flex; align-items: center; gap: 12px; }
        .an-author { font-weight: 700; color: var(--ink); font-size: 14px; }
        .an-aud {
          font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
          text-transform: uppercase; color: var(--primary-70);
          background: var(--primary-10); padding: 2px 8px; border-radius: 999px;
        }
        .an-new {
          font-size: 11px; font-weight: 700; color: #fff;
          background: var(--primary); padding: 2px 8px; border-radius: 999px;
        }
        .an-time { font-size: 12px; color: var(--primary-50); margin-top: 2px; }
        .an-pinned-badge {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 700; color: var(--primary-70);
          background: var(--primary-10); padding: 3px 9px; border-radius: 999px;
        }
        .an-del:hover { color: var(--error); }
        .an-title { font-size: 17px; font-weight: 700; color: var(--ink); margin: 2px 0 0; }
        .an-body { font-size: 14px; line-height: 1.6; color: var(--ink-soft, #4a4a4a); margin: 0; white-space: pre-wrap; }
        .an-foot {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap; margin-top: 6px;
          padding-top: 12px; border-top: 1px solid var(--primary-10);
        }
        .an-reactions { display: flex; align-items: center; gap: 8px; }
        .an-react {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 999px; cursor: pointer;
          background: var(--primary-5); border: 1px solid var(--primary-10);
          color: var(--ink); transition: background .12s, border-color .12s;
        }
        .an-react:hover { background: var(--primary-10); }
        .an-react.mine { background: var(--primary-15); border-color: var(--primary-40); }
        .an-react:disabled { opacity: .55; cursor: default; }
        .an-react-n { font-size: 12px; font-weight: 700; color: var(--primary-70); }
        .an-ack { display: flex; align-items: center; gap: 12px; }
        .an-ack-count { font-size: 12px; font-weight: 600; color: var(--primary-60); }
        .an-textarea {
          width: 100%; border: 1px solid var(--primary-20); border-radius: 10px;
          padding: 10px 12px; font: inherit; color: var(--ink); resize: vertical;
          background: #fff; min-height: 96px;
        }
        .an-textarea:focus { outline: none; border-color: var(--primary); }
        .an-pin-toggle {
          display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
          font-size: 13px; font-weight: 600; color: var(--primary-70); user-select: none;
        }
        .an-pin-check {
          width: 18px; height: 18px; border-radius: 5px; display: inline-flex;
          align-items: center; justify-content: center;
          border: 1.5px solid var(--primary-30); color: #fff;
        }
        .an-pin-check.on { background: var(--primary); border-color: var(--primary); }
        .an-error {
          background: var(--error-bg, #fdecea); color: var(--error-text, #b3261e);
          border: 1px solid var(--error, #e5484d); border-radius: 10px;
          padding: 9px 12px; font-size: 13px; font-weight: 600; margin-bottom: 14px;
        }
        .an-empty-state {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          text-align: center; padding: 56px 24px; color: var(--primary-50);
          background: #fff; border-radius: 16px; box-shadow: var(--shadow-soft);
          border: 1px dashed var(--primary-20);
        }
        .an-empty-title { font-size: 16px; font-weight: 700; color: var(--ink); margin: 4px 0 0; }
        .an-empty-sub { font-size: 13px; color: var(--primary-60); margin: 0 0 8px; max-width: 340px; }
      `}</style>
    </div>
  );
}
