"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, AlertCircle, ChevronRight, FileText } from "lucide-react";

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

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export default function DocumentsClient({ signatures }: DocumentsClientProps) {
  const pending = useMemo(() => signatures.filter((s) => s.status === "PENDING"), [signatures]);
  const signed = useMemo(() => signatures.filter((s) => s.status === "SIGNED"), [signatures]);
  const other = useMemo(() => signatures.filter((s) => s.status !== "PENDING" && s.status !== "SIGNED"), [signatures]);

  return (
    <>
      <div className="cl-page-head">
        <div>
          <h1 className="cl-page-title">Documents</h1>
          <p className="cl-page-sub">Review and sign documents assigned to you.</p>
        </div>
      </div>

      <div className="cl-doc-stats">
        <div className="cl-doc-tile pending">
          <span className="icon-bubble"><Clock className="w-5 h-5" /></span>
          <div>
            <div className="cl-doc-tile-label">Pending</div>
            <div className="cl-doc-tile-val">{pending.length}</div>
          </div>
        </div>
        <div className="cl-doc-tile signed">
          <span className="icon-bubble"><CheckCircle2 className="w-5 h-5" /></span>
          <div>
            <div className="cl-doc-tile-label">Signed</div>
            <div className="cl-doc-tile-val">{signed.length}</div>
          </div>
        </div>
        <div className="cl-doc-tile">
          <span className="icon-bubble"><FileText className="w-5 h-5" /></span>
          <div>
            <div className="cl-doc-tile-label">Total</div>
            <div className="cl-doc-tile-val">{signatures.length}</div>
          </div>
        </div>
      </div>

      <section className="cl-doc-section">
        <h2>Pending signature</h2>
        {pending.length === 0 ? (
          <div className="cl-doc-empty">You have no pending documents.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((row) => <DocumentRow key={row.id} row={row} />)}
          </div>
        )}
      </section>

      <section className="cl-doc-section">
        <h2>Signed</h2>
        {signed.length === 0 ? (
          <div className="cl-doc-empty">No signed documents yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {signed.map((row) => <DocumentRow key={row.id} row={row} />)}
          </div>
        )}
      </section>

      {other.length > 0 && (
        <section className="cl-doc-section">
          <h2>Other</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {other.map((row) => <DocumentRow key={row.id} row={row} />)}
          </div>
        </section>
      )}
    </>
  );
}

function DocumentRow({ row }: { row: SignatureRow }) {
  const overdue = row.status === "PENDING" && isOverdue(row.document.dueDate);
  const due = formatDate(row.document.dueDate);
  const signedDate = formatDate(row.signedAt);

  const statusPill = () => {
    if (row.status === "PENDING") {
      return (
        <span className={`cl-pill ${overdue ? "cancelled" : "pending"}`}>
          {overdue ? <><AlertCircle className="w-3 h-3" style={{ marginRight: 4 }} /> Overdue</> : <><Clock className="w-3 h-3" style={{ marginRight: 4 }} /> Pending</>}
        </span>
      );
    }
    if (row.status === "SIGNED") return <span className="cl-pill passed"><CheckCircle2 className="w-3 h-3" style={{ marginRight: 4 }} /> Signed</span>;
    if (row.status === "EXPIRED") return <span className="cl-pill pending">Expired</span>;
    if (row.status === "REVOKED") return <span className="cl-pill cancelled">Revoked</span>;
    return null;
  };

  return (
    <Link
      href={`/documents/${row.document.id}`}
      className="cl-module">
      <div className="cl-module-meta">
        <div className="cl-module-head">
          <span className="cl-module-title">{row.document.title}</span>
          <span className="cl-pill" style={{ background: "var(--primary-5)", color: "var(--primary-60)" }}>v{row.document.version}</span>
          {statusPill()}
        </div>
        {row.document.description && (
          <div className="cl-module-summary">{row.document.description}</div>
        )}
        <div style={{ fontSize: 11.5, color: "var(--primary-50)", marginTop: 6, display: "flex", gap: 12 }}>
          {due && row.status === "PENDING" && <span>Due {due}</span>}
          {signedDate && <span>Signed {signedDate}</span>}
        </div>
      </div>
      <div className="cl-module-chev">
        <ChevronRight className="w-5 h-5" />
      </div>
    </Link>
  );
}
