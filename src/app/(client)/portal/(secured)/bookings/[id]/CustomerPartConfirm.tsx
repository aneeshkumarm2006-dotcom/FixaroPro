"use client";

// Phase 2C — pre-appointment "the part is here" confirmation.
//
// Shown only for services the admin catalog flags with `requiresCustomerPart`.
// The wording is deliberately kept apart from the materials & equipment line on
// the invoice: THAT is about Fixaro supplying consumables for a surcharge, THIS
// is the replacement item the customer bought themselves. Nothing here changes
// the price.

import { useState } from "react";
import { Banner, Button } from "@/components/customer/Field";
import CustomerModal from "@/components/customer/Modal";
import { customerPartConfirm } from "@/app/(app)/actions/customerPartConfirm";

export default function CustomerPartConfirm({
  jobId,
  partNote,
  confirmedAt,
  startTime,
}: {
  jobId: string;
  /**
   * Noun phrase for the item, e.g. "the replacement lock". Resolved on the
   * server from the live catalog via customerPartFor(cfg, job.jobType) — the
   * portal is not wrapped in ServiceConfigProvider, so it arrives as a prop.
   */
  partNote: string;
  /** ISO stamp of an existing confirmation, or null if not yet confirmed. */
  confirmedAt: string | null;
  /** ISO booking start — drives the "before Tuesday" urgency line. */
  startTime: string;
}) {
  const [stamp, setStamp] = useState<string | null>(confirmedAt);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayLabel = new Date(startTime).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await customerPartConfirm(jobId);
    setBusy(false);
    if (res.success) {
      setStamp(res.confirmedAt ?? new Date().toISOString());
      setOpen(false);
    } else {
      setError(res.error || "Could not save your confirmation.");
    }
  }

  return (
    <>
      <section className="cl-tile cl-tile-pad-lg">
        <h2 className="cl-title-md" style={{ marginBottom: 14 }}>
          You supply the part
        </h2>

        {stamp ? (
          <>
            <Banner kind="success">
              Thanks — you confirmed {partNote} is on site.
            </Banner>
            <p
              style={{
                fontSize: 11,
                color: "var(--primary-50)",
                margin: "12px 0 0",
                lineHeight: 1.5,
              }}>
              Confirmed{" "}
              {new Date(stamp).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              . If anything changes before your visit, contact us so we can
              reschedule rather than send a Pro who can&apos;t start.
            </p>
          </>
        ) : (
          <>
            <p
              style={{
                fontSize: 14,
                color: "var(--ink)",
                margin: "0 0 10px",
                lineHeight: 1.55,
                fontWeight: 600,
              }}>
              This booking needs {partNote}, supplied by you.
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--primary-70)",
                margin: "0 0 14px",
                lineHeight: 1.55,
              }}>
              Fixaro doesn&apos;t purchase or source it — please have it on site
              before your visit on {dayLabel}. This is separate from any
              materials &amp; equipment charge on your booking, which covers the
              supplies and tools your Pro brings.
            </p>
            {error ? (
              <div style={{ marginBottom: 12 }}>
                <Banner kind="error">{error}</Banner>
              </div>
            ) : null}
            <Button block onClick={() => setOpen(true)} disabled={busy}>
              Confirm the part is on site
            </Button>
            <p
              style={{
                fontSize: 11,
                color: "var(--primary-50)",
                margin: "12px 0 0",
                lineHeight: 1.5,
              }}>
              If it hasn&apos;t arrived yet, leave this — you can confirm any
              time before your appointment.
            </p>
          </>
        )}
      </section>

      <CustomerModal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Is the part on site?"
        description={`Confirm you have ${partNote} at the property and ready for your Pro. We'll let the crew know they can start on arrival.`}>
        <div className="cl-stack-16">
          {error ? <Banner kind="error">{error}</Banner> : null}
          <div className="cl-modal-actions">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Not yet
            </Button>
            <Button onClick={submit} loading={busy} disabled={busy}>
              Yes, it&apos;s on site
            </Button>
          </div>
        </div>
      </CustomerModal>
    </>
  );
}
