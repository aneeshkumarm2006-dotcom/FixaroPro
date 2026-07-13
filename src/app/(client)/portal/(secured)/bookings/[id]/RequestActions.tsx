"use client";

import { useState } from "react";
import { Banner, Button, Field, Textarea } from "@/components/customer/Field";
import CustomerModal from "@/components/customer/Modal";
import DatePicker from "@/components/customer/DatePicker";
import { requestCancellation } from "../../../actions/requestCancellation";
import { requestReschedule } from "../../../actions/requestReschedule";

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function RequestActions({
  jobId,
  startTime,
  feeUsd,
  feeWindowHours,
  depositUsd,
}: {
  jobId: string;
  /** ISO booking start — used to decide whether the late-cancellation fee applies. */
  startTime: string;
  /** Late-cancellation fee (from CANCELLATION_FEE_USD). */
  feeUsd: number;
  /** Hours before start inside which the fee applies (CANCELLATION_FEE_WINDOW_HOURS). */
  feeWindowHours: number;
  /** Amount collected at booking that is refunded on cancellation (0 if none). */
  depositUsd: number;
}) {
  // Mirror the server rule in requestCancellation.ts: a cancellation inside the
  // fee window incurs the late fee. This block only renders for upcoming
  // bookings, so start is always in the future.
  const msUntilStart = new Date(startTime).getTime() - Date.now();
  const withinFeeWindow = msUntilStart < feeWindowHours * 60 * 60 * 1000;
  const money = (n: number) =>
    Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;

  const [busy, setBusy] = useState<"cancel" | "reschedule" | null>(null);
  const [msg, setMsg] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  // Cancel modal
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Reschedule modal
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [rescheduleNotes, setRescheduleNotes] = useState("");

  async function submitCancel() {
    setBusy("cancel");
    const res = await requestCancellation(jobId);
    setBusy(null);
    setCancelOpen(false);
    setCancelReason("");
    setMsg(
      res.success
        ? {
            kind: "success",
            text: "Cancellation requested — awaiting confirmation.",
          }
        : { kind: "error", text: res.error || "Failed" }
    );
  }

  async function submitReschedule() {
    if (!preferredDate && !rescheduleNotes.trim()) {
      setMsg({
        kind: "error",
        text: "Please pick a date or add a note for our team.",
      });
      return;
    }
    setBusy("reschedule");
    const notesParts: string[] = [];
    if (preferredDate) notesParts.push(`Preferred: ${preferredDate}`);
    if (rescheduleNotes.trim()) notesParts.push(rescheduleNotes.trim());
    const res = await requestReschedule({
      jobId,
      preferredDate: preferredDate || undefined,
      notes: notesParts.join(" — "),
    });
    setBusy(null);
    setRescheduleOpen(false);
    setPreferredDate("");
    setRescheduleNotes("");
    setMsg(
      res.success
        ? { kind: "success", text: "Reschedule requested — we'll be in touch." }
        : { kind: "error", text: res.error || "Failed" }
    );
  }

  return (
    <>
      <section className="cl-tile cl-tile-pad-lg">
        <h2 className="cl-title-md" style={{ marginBottom: 14 }}>
          Need to change this?
        </h2>
        {msg ? (
          <div style={{ marginBottom: 12 }}>
            <Banner kind={msg.kind}>{msg.text}</Banner>
          </div>
        ) : null}
        <div className="cl-stack-8">
          <Button
            variant="secondary"
            block
            onClick={() => setRescheduleOpen(true)}
            disabled={busy !== null}>
            Request reschedule
          </Button>
          <Button
            variant="dangerGhost"
            block
            onClick={() => setCancelOpen(true)}
            disabled={busy !== null}>
            Request cancellation
          </Button>
        </div>
        <p
          style={{
            fontSize: 11,
            color: "var(--primary-50)",
            margin: "12px 0 0",
            lineHeight: 1.5,
          }}>
          Requests are reviewed by our team — your booking won't be changed
          automatically.
        </p>
      </section>

      <CustomerModal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title="Request a reschedule"
        description="Tell us when you'd like to move this booking to. Our team will reach out to confirm.">
        <div className="cl-stack-16">
          <Field label="Preferred new date (optional)">
            <DatePicker
              value={preferredDate}
              onChange={setPreferredDate}
              min={tomorrowISO()}
              placeholder="Choose a date"
            />
          </Field>
          <Field label="Notes (optional)" htmlFor="rs-notes">
            <Textarea
              id="rs-notes"
              rows={3}
              value={rescheduleNotes}
              onChange={(e) => setRescheduleNotes(e.target.value)}
              placeholder="Any preferred times, reasons, or constraints…"
            />
          </Field>
          <div className="cl-modal-actions">
            <Button
              variant="ghost"
              onClick={() => setRescheduleOpen(false)}
              disabled={busy !== null}>
              Cancel
            </Button>
            <Button
              onClick={submitReschedule}
              loading={busy === "reschedule"}
              disabled={busy !== null}>
              Submit request
            </Button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this booking?"
        description="Our team reviews every cancellation and will reach out to confirm. Your booking won't be cancelled automatically.">
        <div className="cl-stack-16">
          {withinFeeWindow ? (
            <Banner kind="amber">
              Cancelling less than {feeWindowHours} hours before your booking
              incurs a {money(feeUsd)} late-cancellation fee, charged to the card
              on file.
            </Banner>
          ) : null}
          {depositUsd > 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "var(--primary-70)",
                background: "var(--primary-5, rgba(28,25,23,0.04))",
                border: "1px solid var(--primary-10)",
                borderRadius: 12,
                padding: "12px 14px",
                lineHeight: 1.5,
              }}>
              Your {money(depositUsd)} deposit will be refunded once your
              cancellation is confirmed by our team.
            </div>
          ) : null}
          <Field label="Reason (optional)" htmlFor="cn-reason">
            <Textarea
              id="cn-reason"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Help us improve — why are you cancelling?"
            />
          </Field>
          <div className="cl-modal-actions">
            <Button
              variant="ghost"
              onClick={() => setCancelOpen(false)}
              disabled={busy !== null}>
              Keep booking
            </Button>
            <Button
              variant="amber"
              onClick={submitCancel}
              loading={busy === "cancel"}
              disabled={busy !== null}>
              Request cancellation
            </Button>
          </div>
        </div>
      </CustomerModal>
    </>
  );
}
