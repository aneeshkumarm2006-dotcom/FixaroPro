"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eraser,
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

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DocumentSigningView({
  document,
  signature,
  signer,
}: DocumentSigningViewProps) {
  const router = useRouter();
  const sigRef = useRef<SignatureCanvas>(null);
  const [agreed, setAgreed] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isSigned = signature.status === "SIGNED";
  const isReadOnly =
    signature.status === "SIGNED" ||
    signature.status === "EXPIRED" ||
    signature.status === "REVOKED";

  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  function clearSignature() {
    sigRef.current?.clear();
    setHasDrawn(false);
  }

  async function handleSubmit() {
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
    const res = await signDocument({
      documentId: document.id,
      signatureDataUrl: dataUrl,
    });

    if (res.success) {
      setMessage({ type: "success", text: "Document signed successfully." });
      router.refresh();
    } else {
      setMessage({
        type: "error",
        text: res.error || "Failed to sign document.",
      });
    }
    setSaving(false);
  }

  return (
    <div className="max-w-[60rem] mx-auto space-y-6">
      <Button
        variant="default"
        size="sm"
        border={false}
        onClick={() => router.push("/documents")}
        className="mb-2 px-6 py-3">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Documents
      </Button>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-3xl !font-light tracking-tight text-[#005F6A]">
            {document.title}
          </h1>
          <Badge variant="default" size="md">
            v{document.version}
          </Badge>
          {isSigned && (
            <Badge variant="success" size="md">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Signed
            </Badge>
          )}
          {signature.status === "REVOKED" && (
            <Badge variant="error" size="md">
              <AlertCircle className="w-3 h-3 mr-1" />
              Revoked
            </Badge>
          )}
        </div>
        {document.description && (
          <p className="text-sm text-[#005F6A]/70 !font-light mt-2 max-w-3xl">
            {document.description}
          </p>
        )}
        {document.dueDate && !isSigned && (
          <p className="text-xs text-[#005F6A]/60 mt-1">
            Due {formatDate(document.dueDate)}
          </p>
        )}
      </div>

      <Card variant="default" className="p-6">
        <h2 className="text-sm font-[400] text-[#005F6A] mb-4 uppercase tracking-wide">
          Document
        </h2>
        {document.fileUrl ? (
          <div className="space-y-4">
            <iframe
              src={document.fileUrl}
              className="w-full h-[60vh] rounded-xl border border-[#005F6A]/10 bg-white"
              title={document.title}
            />
            <a
              href={document.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#005F6A] hover:underline">
              Open in new tab
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : document.content ? (
          <div className="prose prose-sm max-w-none text-[#005F6A] whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-[#005F6A]/10">
            {document.content}
          </div>
        ) : (
          <p className="text-sm text-[#005F6A]/60">
            This document has no content.
          </p>
        )}
      </Card>

      {isSigned ? (
        <Card variant="default" className="p-6">
          <h2 className="text-sm font-[400] text-[#005F6A] mb-4 uppercase tracking-wide">
            Your Signature
          </h2>
          <div className="space-y-3">
            {signature.signatureUrl && (
              <div className="border border-[#005F6A]/10 rounded-xl bg-white p-4 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signature.signatureUrl}
                  alt="Signature"
                  className="max-h-32"
                />
              </div>
            )}
            <p className="text-xs text-[#005F6A]/70">
              Signed by {signer.name} on {formatDate(signature.signedAt)}
            </p>
          </div>
        </Card>
      ) : isReadOnly ? (
        <Card variant="alert" className="p-6">
          <p className="text-sm">
            This document can no longer be signed.
          </p>
        </Card>
      ) : (
        <Card variant="default" className="p-6">
          <h2 className="text-sm font-[400] text-[#005F6A] mb-4 uppercase tracking-wide">
            Sign
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-[#005F6A]/70 block mb-1">
                Name
              </label>
              <div className="px-4 py-2.5 rounded-xl bg-[#005F6A]/5 text-sm text-[#005F6A]">
                {signer.name}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-[#005F6A]/70 block mb-1">
                Date
              </label>
              <div className="px-4 py-2.5 rounded-xl bg-[#005F6A]/5 text-sm text-[#005F6A]">
                {today}
              </div>
            </div>
          </div>

          <label className="text-xs uppercase tracking-wide text-[#005F6A]/70 block mb-2">
            Signature
          </label>
          <div className="border border-[#005F6A]/15 rounded-xl bg-white relative">
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{
                className: "w-full h-48 rounded-xl",
              }}
              onEnd={() => setHasDrawn(true)}
              penColor="#005F6A"
            />
            <button
              type="button"
              onClick={clearSignature}
              disabled={!hasDrawn}
              className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-[#005F6A]/5 text-[#005F6A] hover:bg-[#005F6A]/10 disabled:opacity-30">
              <Eraser className="w-3 h-3" />
              Clear
            </button>
          </div>
          <p className="text-xs text-[#005F6A]/60 mt-2">
            Sign with your finger, mouse, or stylus above.
          </p>

          <label className="flex items-start gap-2 mt-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-[#005F6A]"
            />
            <span className="text-sm text-[#005F6A]">
              I have read and agree to the contents of this document. I
              understand my electronic signature is legally binding.
            </span>
          </label>

          {message && (
            <div
              className={`p-3 rounded-xl text-sm mt-4 ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-end mt-4">
            <Button
              variant="action"
              size="md"
              border={false}
              onClick={handleSubmit}
              disabled={saving || !agreed || !hasDrawn}
              className="px-6 py-3">
              {saving ? "Signing..." : "Sign Document"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
