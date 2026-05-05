"use client";

import { useMemo } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  FileSignature,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
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

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
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
  const pending = useMemo(
    () => signatures.filter((s) => s.status === "PENDING"),
    [signatures]
  );
  const signed = useMemo(
    () => signatures.filter((s) => s.status === "SIGNED"),
    [signatures]
  );
  const other = useMemo(
    () =>
      signatures.filter(
        (s) => s.status !== "PENDING" && s.status !== "SIGNED"
      ),
    [signatures]
  );

  return (
    <div className="max-w-[80rem] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl !font-light tracking-tight text-[#005F6A]">
          Documents
        </h1>
        <p className="text-sm text-[#005F6A]/70 !font-light mt-1">
          Review and sign documents assigned to you
        </p>
      </div>

      <Card variant="cleano_light" className="p-6">
        <div className="grid grid-cols-3 gap-6">
          <Stat
            label="Pending"
            value={pending.length}
            icon={Clock}
            tone="warning"
          />
          <Stat
            label="Signed"
            value={signed.length}
            icon={CheckCircle2}
            tone="success"
          />
          <Stat
            label="Total"
            value={signatures.length}
            icon={FileSignature}
            tone="default"
          />
        </div>
      </Card>

      <Section
        title="Pending Signature"
        rows={pending}
        emptyText="You have no pending documents."
      />

      <Section
        title="Signed"
        rows={signed}
        emptyText="No signed documents yet."
      />

      {other.length > 0 && (
        <Section
          title="Other"
          rows={other}
          emptyText=""
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof FileSignature;
  tone: "default" | "success" | "warning";
}) {
  const toneClasses = {
    default: "bg-[#005F6A]/10 text-[#005F6A]",
    success: "bg-green-50 text-green-700",
    warning: "bg-yellow-50 text-yellow-700",
  }[tone];

  return (
    <div className="flex items-center gap-3">
      <div className={`p-3 rounded-2xl ${toneClasses}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-[#005F6A]/70">
          {label}
        </p>
        <p className="text-2xl font-[400] text-[#005F6A]">{value}</p>
      </div>
    </div>
  );
}

function Section({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: SignatureRow[];
  emptyText: string;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-[350] tracking-tight text-[#005F6A]">
        {title}
      </h2>
      {rows.length === 0 ? (
        <Card variant="ghost" className="p-8">
          <p className="text-sm text-[#005F6A]/60 text-center">{emptyText}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <DocumentRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ row }: { row: SignatureRow }) {
  const overdue = row.status === "PENDING" && isOverdue(row.document.dueDate);
  const due = formatDate(row.document.dueDate);
  const signedDate = formatDate(row.signedAt);

  return (
    <Link
      href={`/documents/${row.document.id}`}
      className="block p-4 border border-[#005F6A]/10 rounded-2xl bg-white hover:bg-[#005F6A]/3 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-[400] text-[#005F6A]">
              {row.document.title}
            </h3>
            <Badge variant="default" size="sm">
              v{row.document.version}
            </Badge>
            {row.status === "PENDING" && (
              <Badge variant={overdue ? "error" : "warning"} size="sm">
                {overdue ? (
                  <>
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Overdue
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </>
                )}
              </Badge>
            )}
            {row.status === "SIGNED" && (
              <Badge variant="success" size="sm">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Signed
              </Badge>
            )}
            {row.status === "EXPIRED" && (
              <Badge variant="default" size="sm">
                Expired
              </Badge>
            )}
            {row.status === "REVOKED" && (
              <Badge variant="error" size="sm">
                Revoked
              </Badge>
            )}
          </div>
          {row.document.description && (
            <p className="text-xs text-[#005F6A]/60 mt-1 line-clamp-2">
              {row.document.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-[#005F6A]/60">
            {due && row.status === "PENDING" && (
              <span>Due {due}</span>
            )}
            {signedDate && <span>Signed {signedDate}</span>}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#005F6A]/40 flex-shrink-0" />
      </div>
    </Link>
  );
}
