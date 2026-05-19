"use client";

import { useState } from "react";
import { Banner, Button } from "@/components/customer/Field";
import { requestCancellation } from "../../../actions/requestCancellation";
import { requestReschedule } from "../../../actions/requestReschedule";

export default function RequestActions({ jobId }: { jobId: string }) {
  const [busy, setBusy] = useState<"cancel" | "reschedule" | null>(null);
  const [msg, setMsg] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function onCancel() {
    if (
      !confirm(
        "Submit a cancellation request? Our team will reach out to confirm."
      )
    )
      return;
    setBusy("cancel");
    const res = await requestCancellation(jobId);
    setBusy(null);
    setMsg(
      res.success
        ? {
            kind: "success",
            text: "Cancellation requested — awaiting confirmation.",
          }
        : { kind: "error", text: res.error || "Failed" }
    );
  }

  async function onReschedule() {
    const note = prompt(
      "When would you like to reschedule? Give us your preferred date and any notes."
    );
    if (!note) return;
    setBusy("reschedule");
    const res = await requestReschedule({ jobId, notes: note });
    setBusy(null);
    setMsg(
      res.success
        ? { kind: "success", text: "Reschedule requested — we'll be in touch." }
        : { kind: "error", text: res.error || "Failed" }
    );
  }

  return (
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
          onClick={onReschedule}
          disabled={busy !== null}>
          Request reschedule
        </Button>
        <Button
          variant="dangerGhost"
          block
          onClick={onCancel}
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
  );
}
