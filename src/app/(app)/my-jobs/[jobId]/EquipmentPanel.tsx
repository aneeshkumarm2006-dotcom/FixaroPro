"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Wrench, Loader2, AlertTriangle, Check } from "lucide-react";
import { requestEquipmentReimbursement } from "../../actions/requestEquipmentReimbursement";

// Handyman equipment for a job (SOP §8): the required-equipment list, which of
// those items this provider is short of, a link to the locker for pickup, and a
// "I bought equipment → request reimbursement" flow.
//
// `missing` only ever contains items we can positively prove they hold none of
// (see src/lib/equipment-readiness.ts). Everything else renders as a plain chip
// — an item nobody tracks is never held against anyone, so the panel stays
// quiet rather than nagging about tools it knows nothing about.
export default function EquipmentPanel({
  jobId,
  equipment,
  missing = [],
}: {
  jobId: string;
  equipment: string[];
  missing?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const missingSet = new Set(missing);

  function openForm() {
    // Pre-fill with what they're short of — the reimbursement request is almost
    // always for exactly these items.
    if (!description && missing.length > 0) setDescription(missing.join(", "));
    setOpen(true);
  }

  function submit() {
    const value = parseFloat(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0) {
      setMsg({ ok: false, text: "Add a description and a valid amount." });
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await requestEquipmentReimbursement({
        jobId,
        description,
        amount: value,
        receiptUrl: receiptUrl.trim() || undefined,
      });
      setMsg(res.success ? { ok: true, text: "Sent to ops for compensation." } : { ok: false, text: res.error ?? "Failed" });
      if (res.success) {
        setDescription("");
        setAmount("");
        setReceiptUrl("");
        setOpen(false);
      }
    });
  }

  return (
    <div id="equipment" className="rounded-xl border border-neutral-200 bg-white p-4 mt-4" style={{ scrollMarginTop: 80 }}>
      <h3 className="font-semibold flex items-center gap-2 mb-2">
        <Wrench size={18} /> Required equipment
      </h3>

      {missing.length > 0 && (
        <div className="cl-eq-warn" style={{ marginBottom: 12 }}>
          <strong>
            <AlertTriangle size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "-2px" }} />
            You appear to be missing {missing.length} item{missing.length === 1 ? "" : "s"}
          </strong>
          <span>{missing.join(", ")}</span>
          <span className="cl-eq-warn-fix">
            Visit the locker before this job, or buy the item{missing.length === 1 ? "" : "s"} and request
            reimbursement below.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {equipment.map((item) => {
          const isMissing = missingSet.has(item);
          return (
            <span
              key={item}
              title={isMissing ? "You don't have this — pick it up or expense it" : undefined}
              className={`text-sm rounded-full px-3 py-1 inline-flex items-center gap-1 ${
                isMissing
                  ? "bg-amber-100 text-amber-800 font-semibold"
                  : "bg-neutral-100 text-neutral-700"
              }`}>
              {isMissing ? <AlertTriangle size={12} /> : <Check size={12} className="text-neutral-400" />}
              {item}
            </span>
          );
        })}
      </div>

      <p className="text-sm text-neutral-500 mb-3">
        Don&apos;t have an item? Pick it up from the{" "}
        <Link href="/my-inventory/checkout" className="underline">locker</Link>, or buy it and request
        reimbursement below.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={openForm}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium">
          I bought equipment — request reimbursement
        </button>
      ) : (
        <div className="space-y-2">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you buy?"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount (CAD)"
              className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="Receipt link (optional)"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="rounded-lg bg-neutral-900 text-white px-3 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
              {pending ? <Loader2 size={14} className="animate-spin" /> : null} Submit request
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg ? <p className={`text-xs mt-2 ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p> : null}
    </div>
  );
}
