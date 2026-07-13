"use client";

import { useEffect, useState, useTransition } from "react";
import { Paintbrush, Receipt, Loader2 } from "lucide-react";
import { StatusChip, paintingStatusVisual } from "@/lib/status-icons";
import { isUpfrontMaterials } from "@/app/(book)/book/types";
import { sendPaintingOffer } from "../../actions/sendPaintingOffer";
import { overridePaintingProvider } from "../../actions/overridePaintingProvider";
import { cancelPaintingNoAnswer } from "../../actions/cancelPaintingNoAnswer";
import { adjustMaterialsDeposit } from "../../actions/adjustMaterialsDeposit";
import { adjustClockTimes, getJobClockTimes } from "../../actions/adjustClockTimes";

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
        <PaintingOps
          jobId={jobId}
          painting={painting}
          providerOptions={providerOptions}
          // SOP §6.6 — surface the flat $119 materials/equipment charge already
          // captured at booking next to the bid × surplus breakdown.
          materialsCollected={
            isUpfrontMaterials(billing.materialsType) && billing.depositCollected > 0
              ? billing.depositCollected
              : 0
          }
        />
      ) : null}
      <BillingReview jobId={jobId} billing={billing} />
    </div>
  );
}

function money(n: number | null | undefined) {
  return `$${(n ?? 0).toFixed(2)}`;
}

// ISO timestamp → value for a datetime-local input, in the admin's timezone.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtClock(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function PaintingOps({
  jobId,
  painting,
  providerOptions,
  materialsCollected,
}: {
  jobId: string;
  painting: OpsPainting;
  providerOptions: { id: string; name: string }[];
  materialsCollected: number;
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
          <span>
            · estimate {money(painting.quoteRangeMin)}
            {painting.quoteRangeMax != null && painting.quoteRangeMax !== painting.quoteRangeMin
              ? <>–{money(painting.quoteRangeMax)}</>
              : null}
          </span>
        ) : null}
      </div>
      {painting.finalAmount != null ? (
        <p className="text-sm text-neutral-500 mb-2">
          Accepted bid {money(painting.acceptedBidAmount)} × {painting.surplusRate} ={" "}
          <span className="font-medium text-neutral-800">{money(painting.finalAmount)}</span>
        </p>
      ) : null}
      {/* SOP §6.6 — the flat materials/equipment charge captured at booking is
          separate from the bid; show it so ops sees the client's full outlay. */}
      {materialsCollected > 0 ? (
        <p className="text-sm text-neutral-500 mb-2">
          Materials &amp; equipment{" "}
          <span className="font-medium text-neutral-800">{money(materialsCollected)}</span>{" "}
          already collected at booking — not part of the bid.
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
  const [depositReason, setDepositReason] = useState("");

  // Manual clock-time correction (SOP §10.2). Current values are loaded via
  // the admin-guarded read action; edits require a reason and are audit-logged.
  const [clockLoaded, setClockLoaded] = useState(false);
  const [origClockIn, setOrigClockIn] = useState<string | null>(null);
  const [origClockOut, setOrigClockOut] = useState<string | null>(null);
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [clockReason, setClockReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    getJobClockTimes(jobId).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setOrigClockIn(res.clockInTime);
        setOrigClockOut(res.clockOutTime);
        setClockIn(toLocalInput(res.clockInTime));
        setClockOut(toLocalInput(res.clockOutTime));
      }
      setClockLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const editedHours =
    clockIn && clockOut
      ? (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000
      : null;

  const hasMaterialsDeposit = billing.materialsType === "deposit" && billing.depositCollected > 0;

  function saveDeposit() {
    // SOP §10.5 — deposit adjustments require a reason (also enforced server-side).
    if (!depositReason.trim()) {
      setMsg({ ok: false, text: "A reason is required for deposit adjustments." });
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await adjustMaterialsDeposit({
        jobId,
        appliedAmount: parseFloat(applied) || 0,
        refundAmount: refund ? parseFloat(refund) : undefined,
        reason: depositReason,
      });
      setMsg(res.success ? { ok: true, text: "Deposit updated." } : { ok: false, text: res.error ?? "Failed" });
    });
  }

  function saveClock() {
    const inChanged = clockIn !== toLocalInput(origClockIn) && clockIn !== "";
    const outChanged = clockOut !== toLocalInput(origClockOut) && clockOut !== "";
    if (!inChanged && !outChanged) {
      setMsg({ ok: false, text: "No clock changes to save." });
      return;
    }
    if (!clockReason.trim()) {
      setMsg({ ok: false, text: "A reason is required for clock corrections." });
      return;
    }
    if (clockIn && clockOut && new Date(clockOut).getTime() <= new Date(clockIn).getTime()) {
      setMsg({ ok: false, text: "Clock-out must be after clock-in." });
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await adjustClockTimes({
        jobId,
        clockInTime: inChanged ? new Date(clockIn).toISOString() : undefined,
        clockOutTime: outChanged ? new Date(clockOut).toISOString() : undefined,
        reason: clockReason,
      });
      if (res.success) {
        setOrigClockIn(res.clockInTime ?? null);
        setOrigClockOut(res.clockOutTime ?? null);
        setClockIn(toLocalInput(res.clockInTime ?? null));
        setClockOut(toLocalInput(res.clockOutTime ?? null));
        setClockReason("");
        setMsg({ ok: true, text: "Clock times corrected." });
      } else {
        setMsg({ ok: false, text: res.error ?? "Failed" });
      }
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

      {/* SOP §10.2 — manual clock-time correction. Labour on the bill is
          derived from these times; every edit needs a reason and is
          audit-logged with the old and new timestamps. */}
      <div className="mt-4 border-t border-neutral-100 pt-3 space-y-2">
        <p className="text-xs uppercase tracking-wide text-neutral-400">
          Clock correction (SOP §10.2)
        </p>
        {clockLoaded ? (
          <>
            <p className="text-xs text-neutral-500">
              Current: in {fmtClock(origClockIn)} → out {fmtClock(origClockOut)}
              {billing.hoursWorked != null ? ` (${billing.hoursWorked}h)` : ""}
            </p>
            <div className="flex gap-2">
              <label className="flex flex-col text-xs text-neutral-500 flex-1">
                Clock-in
                <input value={clockIn} onChange={(e) => setClockIn(e.target.value)} type="datetime-local"
                  className="mt-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="flex flex-col text-xs text-neutral-500 flex-1">
                Clock-out
                <input value={clockOut} onChange={(e) => setClockOut(e.target.value)} type="datetime-local"
                  className="mt-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
              </label>
            </div>
            {editedHours != null && editedHours > 0 ? (
              <p className="text-xs text-neutral-400">Edited duration: {editedHours.toFixed(2)}h</p>
            ) : null}
            <input
              value={clockReason}
              onChange={(e) => setClockReason(e.target.value)}
              placeholder="Reason (required) — e.g. provider forgot to clock out"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <button type="button" disabled={pending} onClick={saveClock}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
              {pending ? <Loader2 size={14} className="animate-spin" /> : null} Save clock correction
            </button>
          </>
        ) : (
          <p className="text-xs text-neutral-400">Loading clock record…</p>
        )}
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
          {/* SOP §10.5 — the adjustment reason is mandatory and audit-logged. */}
          <input
            value={depositReason}
            onChange={(e) => setDepositReason(e.target.value)}
            placeholder="Reason (required) — e.g. $60 of supplies used, rest refunded"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button type="button" disabled={pending || !depositReason.trim()} onClick={saveDeposit}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
            {pending ? <Loader2 size={14} className="animate-spin" /> : null} Save deposit split
          </button>
        </div>
      ) : null}

      {msg ? <p className={`text-xs mt-2 ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p> : null}
    </section>
  );
}
