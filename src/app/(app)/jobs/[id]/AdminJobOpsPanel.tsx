"use client";

import { useState, useTransition } from "react";
import { Paintbrush, Receipt, Loader2 } from "lucide-react";
import { StatusChip, paintingStatusVisual } from "@/lib/status-icons";
import { sendPaintingOffer } from "../../actions/sendPaintingOffer";
import { overridePaintingProvider } from "../../actions/overridePaintingProvider";
import { cancelPaintingNoAnswer } from "../../actions/cancelPaintingNoAnswer";
import { adjustMaterialsDeposit } from "../../actions/adjustMaterialsDeposit";

export interface OpsBilling {
  hoursWorked: number | null;
  labourRate: number;
  labourFromClock: number | null;
  materialsAmount: number;
  materialsType: string | null;
  materialsApplied: number;
  materialsRefunded: boolean;
  depositCollected: number;
  cancellationFee: number;
  discount: number;
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
  refunded: number;
  amountDueNow: number;
}

export interface OpsPainting {
  status: string | null;
  finalAmount: number | null;
  acceptedBidAmount: number | null;
  quoteRangeMin: number | null;
  quoteRangeMax: number | null;
  surplusRate: number;
  bids: { id: string; bidderName: string; amount: number; isWinning: boolean }[];
}

export default function AdminJobOpsPanel({
  jobId,
  billing,
  painting,
  providerOptions,
}: {
  jobId: string;
  billing: OpsBilling;
  painting: OpsPainting | null;
  providerOptions: { id: string; name: string }[];
}) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {painting ? (
        <PaintingOps jobId={jobId} painting={painting} providerOptions={providerOptions} />
      ) : null}
      <BillingReview jobId={jobId} billing={billing} />
    </div>
  );
}

function money(n: number | null | undefined) {
  return `$${(n ?? 0).toFixed(2)}`;
}

function PaintingOps({
  jobId,
  painting,
  providerOptions,
}: {
  jobId: string;
  painting: OpsPainting;
  providerOptions: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [reason, setReason] = useState("");
  const [reprice, setReprice] = useState("");
  // SOP §6 — "No phone answer → cancel appointment".
  const [noAnswerOpen, setNoAnswerOpen] = useState(false);
  const [callNote, setCallNote] = useState("");

  function send() {
    setMsg(null);
    start(async () => {
      const res = await sendPaintingOffer(jobId);
      setMsg(res.success ? { ok: true, text: `Offer sent — ${money(res.finalAmount)}` } : { ok: false, text: res.error ?? "Failed" });
    });
  }

  function doOverride() {
    if (!providerId || !reason.trim()) {
      setMsg({ ok: false, text: "Pick a provider and give a reason." });
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await overridePaintingProvider({
        jobId,
        newProviderId: providerId,
        reason,
        newBidAmount: reprice ? parseFloat(reprice) : undefined,
      });
      setMsg(res.success ? { ok: true, text: res.repriced ? "Provider changed + re-priced (client re-notified)" : "Provider changed (price kept)" } : { ok: false, text: res.error ?? "Failed" });
      if (res.success) setOverrideOpen(false);
    });
  }

  // Ops phoned the client inside the 24h window and got no answer: cancel the
  // appointment and refund the captured $119 materials/equipment charge (SOP §6).
  function doNoAnswerCancel() {
    if (!callNote.trim()) {
      setMsg({ ok: false, text: "Log the call attempt before cancelling." });
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await cancelPaintingNoAnswer({ jobId, reason: callNote });
      setMsg(
        res.success
          ? { ok: true, text: `Appointment cancelled — ${money(res.refunded ?? 0)} refunded` }
          : { ok: false, text: res.error ?? "Failed" }
      );
      if (res.success) setNoAnswerOpen(false);
    });
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="font-semibold flex items-center gap-2 mb-3">
        <Paintbrush size={18} /> Painting workflow
      </h3>
      <div className="text-sm text-neutral-500 mb-1 flex items-center gap-2 flex-wrap">
        <StatusChip visual={paintingStatusVisual(painting.status)} />
        {painting.quoteRangeMin != null ? (
          <span>· estimate {money(painting.quoteRangeMin)}–{money(painting.quoteRangeMax)}</span>
        ) : null}
      </div>
      {painting.finalAmount != null ? (
        <p className="text-sm text-neutral-500 mb-2">
          Accepted bid {money(painting.acceptedBidAmount)} × {painting.surplusRate} ={" "}
          <span className="font-medium text-neutral-800">{money(painting.finalAmount)}</span>
        </p>
      ) : null}

      {painting.bids.length > 0 ? (
        <div className="text-sm border-t border-neutral-100 pt-2 mb-3">
          <p className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Bids</p>
          {painting.bids.map((b) => (
            <div key={b.id} className="flex justify-between py-0.5">
              <span>{b.bidderName}{b.isWinning ? " · winner" : ""}</span>
              <span className="font-medium">{money(b.amount)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-400 mb-3">No bids yet.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {painting.status === "BIDDING" ? (
          <button
            type="button"
            disabled={pending || painting.bids.length === 0}
            onClick={send}
            className="rounded-lg bg-neutral-900 text-white px-3 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            Accept lowest &amp; send offer
          </button>
        ) : null}
        {(painting.status === "OFFER_SENT" || painting.status === "ACCEPTED") ? (
          <button
            type="button"
            onClick={() => setOverrideOpen((v) => !v)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium">
            Override provider
          </button>
        ) : null}
        {/* SOP §6: the client never answered the follow-up call inside 24h. */}
        {painting.status === "OFFER_SENT" ? (
          <button
            type="button"
            onClick={() => setNoAnswerOpen((v) => !v)}
            className="rounded-lg border border-red-300 text-red-700 px-3 py-2 text-sm font-medium">
            No phone answer — cancel
          </button>
        ) : null}
      </div>

      {noAnswerOpen ? (
        <div className="mt-3 border-t border-neutral-100 pt-3 space-y-2">
          <p className="text-xs text-neutral-500">
            Cancels the booking and refunds the captured $119 materials/equipment charge.
            The call attempt, reason and refund status are audit-logged.
          </p>
          <input
            value={callNote}
            onChange={(e) => setCallNote(e.target.value)}
            placeholder="Call attempt — e.g. called twice at 09:10 and 14:30, no answer, voicemail left"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending}
            onClick={doNoAnswerCancel}
            className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            Cancel appointment &amp; refund
          </button>
        </div>
      ) : null}

      {overrideOpen ? (
        <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
            <option value="">Select new provider…</option>
            {providerOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            value={reprice}
            onChange={(e) => setReprice(e.target.value)}
            placeholder="New bid amount (optional — only if re-pricing)"
            type="number"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-neutral-400">
            Leave the amount blank to keep the client's agreed price (no re-notification).
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={doOverride}
            className="rounded-lg bg-neutral-900 text-white px-3 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
            {pending ? <Loader2 size={14} className="animate-spin" /> : null} Confirm override
          </button>
        </div>
      ) : null}

      {msg ? <p className={`text-xs mt-2 ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p> : null}
    </section>
  );
}

function BillingReview({ jobId, billing }: { jobId: string; billing: OpsBilling }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [applied, setApplied] = useState(String(billing.materialsApplied || ""));
  const [refund, setRefund] = useState("");

  const hasMaterialsDeposit = billing.materialsType === "deposit" && billing.depositCollected > 0;

  function saveDeposit() {
    setMsg(null);
    start(async () => {
      const res = await adjustMaterialsDeposit({
        jobId,
        appliedAmount: parseFloat(applied) || 0,
        refundAmount: refund ? parseFloat(refund) : undefined,
      });
      setMsg(res.success ? { ok: true, text: "Deposit updated." } : { ok: false, text: res.error ?? "Failed" });
    });
  }

  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className={`flex justify-between py-1 text-sm ${strong ? "font-semibold border-t border-neutral-200 mt-1 pt-2" : ""}`}>
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900">{value}</span>
    </div>
  );

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="font-semibold flex items-center gap-2 mb-3">
        <Receipt size={18} /> Charge review (SOP §10)
      </h3>
      <div>
        {billing.labourFromClock != null ? (
          <Row label={`Labour (${billing.hoursWorked}h × $${billing.labourRate}/hr)`} value={money(billing.labourFromClock)} />
        ) : (
          <Row label="Labour (no clock record)" value="—" />
        )}
        {/* Only true deposits are labelled as such. A "charge" (painting's flat
            $119) is a materials/equipment line item, never a deposit — SOP §5. */}
        {billing.materialsAmount > 0 ? (
          <Row label={billing.materialsType === "deposit" ? "Materials deposit" : "Materials & equipment"} value={money(billing.materialsAmount)} />
        ) : null}
        <Row label="Subtotal (booked)" value={money(billing.subtotal)} />
        {billing.discount > 0 ? <Row label="Discount" value={`−${money(billing.discount)}`} /> : null}
        <Row label="GST" value={money(billing.gst)} />
        <Row label="QST" value={money(billing.qst)} />
        {billing.cancellationFee > 0 ? <Row label="Cancellation fee" value={money(billing.cancellationFee)} /> : null}
        {billing.depositCollected > 0 ? <Row label="Deposit paid" value={`−${money(billing.depositCollected)}`} /> : null}
        {billing.refunded > 0 ? <Row label="Refunded" value={`−${money(billing.refunded)}`} /> : null}
        <Row label="Total" value={money(billing.total)} />
        <Row label="Amount due now" value={money(billing.amountDueNow)} strong />
      </div>

      {hasMaterialsDeposit ? (
        <div className="mt-4 border-t border-neutral-100 pt-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-neutral-400">
            Materials deposit reconciliation (${billing.depositCollected.toFixed(2)} collected)
          </p>
          <div className="flex gap-2">
            <label className="flex flex-col text-xs text-neutral-500 flex-1">
              Apply to bill
              <input value={applied} onChange={(e) => setApplied(e.target.value)} type="number" placeholder="0.00"
                className="mt-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col text-xs text-neutral-500 flex-1">
              Refund unused {billing.materialsRefunded ? "(already refunded)" : ""}
              <input value={refund} onChange={(e) => setRefund(e.target.value)} type="number" placeholder="0.00"
                disabled={billing.materialsRefunded}
                className="mt-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm disabled:bg-neutral-100" />
            </label>
          </div>
          <button type="button" disabled={pending} onClick={saveDeposit}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
            {pending ? <Loader2 size={14} className="animate-spin" /> : null} Save deposit split
          </button>
        </div>
      ) : null}

      {msg ? <p className={`text-xs mt-2 ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p> : null}
    </section>
  );
}
