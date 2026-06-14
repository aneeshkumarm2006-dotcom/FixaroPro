"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  FileText,
  Check,
} from "lucide-react";

type DocStatus = "PENDING" | "SIGNED" | "EXPIRED" | "REVOKED";

interface SignatureRow {
  id: string;
  status: DocStatus;
  signedAt: string | null;
  document: {
    id: string;
    title: string;
    description: string | null;
    version: string;
    dueDate: string | null;
    createdAt: string;
    hasFile: boolean;
  };
}

interface DocumentsClientProps {
  signatures: SignatureRow[];
}

// Status pill colors. Fixaro defines amber/emerald/error-text vars; slate +
// error-bg aren't in the theme, so those use literal fallbacks.
const STATUS: Record<DocStatus, { label: string; dot: string; bg: string; fg: string }> = {
  PENDING: { label: "Pending", dot: "#d97706", bg: "var(--amber-50)", fg: "var(--amber-800)" },
  SIGNED: { label: "Signed", dot: "#059669", bg: "var(--emerald-100)", fg: "var(--emerald-800)" },
  EXPIRED: { label: "Expired", dot: "#64748b", bg: "#f1f5f9", fg: "#334155" },
  REVOKED: { label: "Revoked", dot: "#dc2626", bg: "#fef2f2", fg: "var(--error-text)" },
};

function fmtDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function DocStatusPill({ status }: { status: DocStatus }) {
  const m = STATUS[status];
  return (
    <span className="pill" style={{ background: m.bg, color: m.fg }}>
      <span className="pill-dot" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function AStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="astat">
      <div className="astat-head">
        <span>{label}</span>
        <span className="astat-icon"><Icon size={15} /></span>
      </div>
      <div className="astat-value">{value}</div>
      {hint && <div className="astat-delta">{hint}</div>}
    </div>
  );
}

export default function DocumentsClient({ signatures }: DocumentsClientProps) {
  const pending = useMemo(() => signatures.filter((s) => s.status === "PENDING"), [signatures]);
  const signed = useMemo(() => signatures.filter((s) => s.status === "SIGNED"), [signatures]);
  const other = useMemo(
    () => signatures.filter((s) => s.status === "EXPIRED" || s.status === "REVOKED"),
    [signatures]
  );

  const SECTIONS: { title: string; rows: SignatureRow[]; accent?: boolean }[] = [
    { title: "Pending signature", rows: pending, accent: true },
    { title: "Signed", rows: signed },
    { title: "Other", rows: other },
  ];

  return (
    <div className="admin-font stack-24">
      <DocsStyles />

      <header>
        <p className="eyebrow">HR &amp; Compliance</p>
        <h1 className="display" style={{ fontSize: "clamp(32px, 4.2vw, 46px)", marginTop: 6 }}>
          Documents.
        </h1>
        <p className="subtitle" style={{ marginTop: 10, fontSize: 15.5 }}>
          Review, sign, and keep your compliance paperwork up to date.
        </p>
      </header>

      <div className="astat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <AStat icon={AlertCircle} label="Pending" value={pending.length} hint={pending.length ? "awaiting your signature" : "all caught up"} />
        <AStat icon={CheckCircle2} label="Signed" value={signed.length} hint="on file" />
        <AStat icon={FileText} label="Total" value={signatures.length} hint="documents" />
      </div>

      {SECTIONS.map((sec) => (
        <section key={sec.title}>
          <div className="doc-sec-head">
            <h2 className="doc-sec-title">{sec.title}</h2>
            <span className="doc-sec-count">{sec.rows.length}</span>
          </div>
          {sec.rows.length === 0 ? (
            <div className="doc-empty">
              {sec.title === "Pending signature"
                ? "Nothing waiting on you — nice."
                : `No ${sec.title.toLowerCase()} documents.`}
            </div>
          ) : (
            <div className="doc-list">
              {sec.rows.map((row) => (
                <DocumentRow key={row.id} row={row} accent={sec.accent} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function DocumentRow({ row, accent }: { row: SignatureRow; accent?: boolean }) {
  const d = row.document;
  const left = d.dueDate ? daysUntil(d.dueDate) : null;
  const overdue = row.status === "PENDING" && left !== null && left < 0;
  const dueSoon = row.status === "PENDING" && left !== null && left >= 0 && left <= 3;

  return (
    <Link href={`/documents/${d.id}`} className={`jcard doc-card ${accent ? "accent" : ""}`}>
      <span className="doc-card-icon"><FileText size={18} /></span>
      <div className="doc-card-body">
        <div className="doc-card-toprow">
          <span className="jcard-client">{d.title}</span>
          <span className="doc-ver">v{d.version}</span>
        </div>
        {d.description && <div className="doc-card-sub">{d.description}</div>}
        <div className="doc-card-meta">
          <DocStatusPill status={row.status} />
          {row.status === "PENDING" && d.dueDate ? (
            <span className={`doc-due ${overdue ? "overdue" : dueSoon ? "soon" : ""}`}>
              <Clock size={13} /> Due {fmtDate(d.dueDate)}
              {overdue ? " · overdue" : dueSoon ? " · soon" : ""}
            </span>
          ) : row.signedAt ? (
            <span className="doc-due">
              <Check size={13} /> Signed {fmtDate(row.signedAt)}
            </span>
          ) : null}
        </div>
      </div>
      <span className="doc-card-chev"><ChevronRight size={18} /></span>
    </Link>
  );
}

function DocsStyles() {
  return (
    <style>{`
    .doc-sec-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .doc-sec-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.09em; color: var(--primary-60); font-weight: 700; margin: 0; }
    .doc-sec-count { font-size: 11px; font-weight: 700; color: var(--primary-60); background: var(--primary-5); padding: 2px 9px; border-radius: 999px; }
    .doc-empty { padding: 26px; text-align: center; font-size: 13.5px; color: var(--primary-50); background: var(--primary-5); border-radius: 14px; }

    .doc-list { display: flex; flex-direction: column; gap: 10px; }
    .doc-card { display: flex; flex-direction: row; align-items: center; gap: 16px; width: 100%; text-align: left; cursor: pointer; padding: 18px; text-decoration: none; }
    .doc-card.accent { border-left: 3px solid var(--amber-600); }
    .doc-card-icon { width: 44px; height: 44px; border-radius: 11px; flex: 0 0 auto; background: var(--primary-5); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; }
    .doc-card.accent .doc-card-icon { background: var(--amber-50); color: var(--amber-700); }
    .doc-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .doc-card-toprow { display: flex; align-items: center; gap: 10px; }
    .doc-card-toprow .jcard-client { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .doc-ver { font-family: var(--font-mono); font-size: 11px; color: var(--primary-60); background: var(--primary-5); padding: 2px 7px; border-radius: 6px; flex: 0 0 auto; }
    .doc-card-sub { font-size: 13px; color: var(--primary-60); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .doc-card-meta { display: flex; align-items: center; gap: 12px; margin-top: 10px; flex-wrap: wrap; }
    .doc-due { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--primary-60); }
    .doc-due.soon { color: var(--amber-700); font-weight: 600; }
    .doc-due.overdue { color: var(--error-text); font-weight: 600; }
    .doc-card-chev { color: var(--primary-30); flex: 0 0 auto; }
    .doc-card:hover .doc-card-chev { color: var(--primary); }
    `}</style>
  );
}
