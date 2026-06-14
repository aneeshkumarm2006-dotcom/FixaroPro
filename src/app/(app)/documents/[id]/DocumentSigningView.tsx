"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  PenLine,
  Check,
} from "lucide-react";
import { signDocument } from "../../actions/signDocument";

type DocStatus = "PENDING" | "SIGNED" | "EXPIRED" | "REVOKED";

interface DocumentData {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  fileUrl: string | null;
  version: string;
  dueDate: string | null;
}

interface SignatureData {
  status: DocStatus;
  signedAt: string | null;
  signatureUrl: string | null;
}

interface SignerData {
  name: string;
}

interface DocumentSigningViewProps {
  document: DocumentData;
  signature: SignatureData;
  signer: SignerData;
}

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

function DocStatusPill({ status }: { status: DocStatus }) {
  const m = STATUS[status];
  return (
    <span className="pill" style={{ background: m.bg, color: m.fg }}>
      <span className="pill-dot" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

export default function DocumentSigningView({
  document: doc,
  signature,
  signer,
}: DocumentSigningViewProps) {
  const router = useRouter();
  const sigRef = useRef<SignatureCanvas>(null);
  const [agreed, setAgreed] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const signable = signature.status === "PENDING";

  function clear() {
    sigRef.current?.clear();
    setHasInk(false);
  }

  async function submit() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setMessage({ type: "error", text: "Please draw your signature." });
      return;
    }
    if (!agreed) {
      setMessage({ type: "error", text: "You must agree before signing." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const dataUrl = sigRef.current.toDataURL("image/png");
    const res = await signDocument({ documentId: doc.id, signatureDataUrl: dataUrl });
    if (res.success) {
      setMessage({ type: "success", text: "Document signed successfully." });
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error || "Failed to sign document." });
    }
    setSaving(false);
  }

  return (
    <div className="admin-font">
      <DocsDetailStyles />

      <button className="jdetail-back" onClick={() => router.push("/documents")}>
        <ArrowLeft size={14} /> Back to Documents
      </button>

      <div className="doc-detail">
        {/* Document content */}
        <div className="doc-paper-wrap">
          <div className="doc-paper-head">
            <div>
              <p className="eyebrow">HR &amp; Compliance</p>
              <h1 className="title" style={{ fontSize: 28, marginTop: 4 }}>{doc.title}</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="doc-ver">v{doc.version}</span>
              <DocStatusPill status={signature.status} />
            </div>
          </div>
          <div className="doc-paper">
            {doc.fileUrl ? (
              <div className="doc-pdf-frame">
                <iframe src={doc.fileUrl} title={doc.title} />
                <a className="link" href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, marginTop: 10 }}>
                  Open in new tab <ExternalLink size={13} />
                </a>
              </div>
            ) : doc.content ? (
              <div className="doc-text" style={{ whiteSpace: "pre-wrap" }}>{doc.content}</div>
            ) : (
              <div className="doc-pdf-placeholder">
                <Download size={40} />
                <div style={{ fontWeight: 600 }}>{doc.title} · v{doc.version}</div>
                <div style={{ fontSize: 13, color: "var(--primary-50)" }}>No content attached.</div>
              </div>
            )}
          </div>
        </div>

        {/* Sign or signed view */}
        {signable ? (
          <div className="dcard doc-sign">
            <div className="dcard-head"><h3>Your signature</h3></div>
            <p style={{ fontSize: 13.5, color: "var(--primary-60)", margin: 0 }}>
              Draw your signature in the box below.
            </p>
            <div className="doc-canvas-wrap">
              <SignatureCanvas
                ref={sigRef}
                penColor="#1c1917"
                canvasProps={{ className: "doc-canvas" }}
                onEnd={() => setHasInk(true)}
              />
              {!hasInk && <span className="doc-canvas-hint">Sign here</span>}
              <span className="doc-canvas-x">✕</span>
            </div>
            <div className="doc-canvas-actions">
              <button
                className="link-muted"
                style={{ background: "none", border: 0, cursor: "pointer", fontSize: 13 }}
                onClick={clear}
                disabled={!hasInk}>
                Clear
              </button>
            </div>
            <label className="doc-agree">
              <span className={`doc-check ${agreed ? "on" : ""}`} onClick={() => setAgreed((a) => !a)}>
                {agreed ? <Check size={13} /> : null}
              </span>
              <span onClick={() => setAgreed((a) => !a)}>
                I have read and agree to the terms set out in <strong>{doc.title}</strong>, and I am
                signing this document electronically.
              </span>
            </label>
            {message && (
              <div
                style={{
                  fontSize: 13,
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: message.type === "success" ? "var(--emerald-100)" : "#fef2f2",
                  color: message.type === "success" ? "var(--emerald-800)" : "var(--error-text)",
                }}>
                {message.text}
              </div>
            )}
            <button className="btn btn-primary btn-block" disabled={!agreed || !hasInk || saving} onClick={submit}>
              <PenLine size={16} /> {saving ? "Signing…" : "Sign document"}
            </button>
            <p style={{ fontSize: 11.5, color: "var(--primary-40)", textAlign: "center", margin: 0 }}>
              Your signature and a timestamp will be recorded.
            </p>
          </div>
        ) : (
          <div className="dcard doc-sign">
            <div className="dcard-head"><h3>Signature on file</h3></div>
            {signature.status === "SIGNED" ? (
              <>
                <div className="doc-signed-box">
                  {signature.signatureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signature.signatureUrl} alt="signature" style={{ maxWidth: "100%", maxHeight: 90 }} />
                  ) : (
                    <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 30, color: "var(--ink)" }}>
                      {signer.name}
                    </span>
                  )}
                </div>
                <div className="banner" style={{ marginTop: 4, background: "var(--emerald-100)", color: "var(--emerald-800)" }}>
                  <CheckCircle2 size={16} /> Signed by {signer.name} on {fmtDate(signature.signedAt)} · v{doc.version}
                </div>
              </>
            ) : (
              <div className="banner banner-amber">
                <AlertCircle size={16} /> This document is {signature.status.toLowerCase()} and can no
                longer be signed.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DocsDetailStyles() {
  return (
    <style>{`
    .doc-detail { display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: start; margin-top: 16px; }
    @media (max-width: 1000px) { .doc-detail { grid-template-columns: 1fr; } }
    .doc-paper-wrap { background: #fff; border-radius: 18px; box-shadow: var(--shadow-soft); overflow: hidden; }
    .doc-paper-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 24px 28px; border-bottom: 1px solid var(--primary-10); flex-wrap: wrap; }
    .doc-paper { padding: 8px; }
    .doc-ver { font-family: var(--font-mono); font-size: 11px; color: var(--primary-60); background: var(--primary-5); padding: 2px 7px; border-radius: 6px; flex: 0 0 auto; }
    .doc-pdf-frame { margin: 12px; }
    .doc-pdf-frame iframe { width: 100%; height: 62vh; border: 1px solid var(--primary-10); border-radius: 12px; background: #fff; }
    .doc-pdf-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 6px; padding: 70px 24px; color: var(--primary-40); background: var(--primary-5); border-radius: 12px; margin: 16px; }
    .doc-text { padding: 24px 28px; font-size: 14.5px; line-height: 1.7; color: var(--ink-soft); }

    .doc-sign { position: sticky; top: 20px; display: flex; flex-direction: column; gap: 14px; }
    .doc-canvas-wrap { position: relative; border: 1.5px dashed var(--primary-20); border-radius: 12px; background: var(--primary-5); height: 150px; overflow: hidden; }
    .doc-canvas { width: 100%; height: 150px; display: block; cursor: crosshair; touch-action: none; }
    .doc-canvas-hint { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--primary-30); font-family: var(--font-serif); font-style: italic; font-size: 24px; pointer-events: none; }
    .doc-canvas-x { position: absolute; left: 16px; bottom: 14px; color: var(--primary-30); font-size: 13px; pointer-events: none; }
    .doc-canvas-actions { display: flex; justify-content: flex-end; margin-top: -4px; }
    .doc-agree { display: flex; gap: 11px; align-items: flex-start; font-size: 13px; line-height: 1.5; color: var(--ink-soft); cursor: pointer; }
    .doc-agree strong { color: var(--ink); }
    .doc-check { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid var(--primary-20); flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; color: #fff; transition: background .12s, border-color .12s; margin-top: 1px; }
    .doc-check.on { background: var(--primary); border-color: var(--primary); }
    .doc-signed-box { border: 1px solid var(--primary-10); border-radius: 12px; background: var(--primary-5); height: 110px; display: flex; align-items: center; justify-content: center; padding: 10px; }
    `}</style>
  );
}
