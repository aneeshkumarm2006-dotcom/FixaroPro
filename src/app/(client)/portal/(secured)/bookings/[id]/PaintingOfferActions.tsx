"use client";

import { useState, useTransition } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { respondPaintingOffer } from "../../../actions/respondPaintingOffer";

export default function PaintingOfferActions({
  jobId,
  finalAmount,
}: {
  jobId: string;
  finalAmount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmReject, setConfirmReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function respond(response: "ACCEPT" | "REJECT") {
    setError(null);
    startTransition(async () => {
      const res = await respondPaintingOffer({ jobId, response });
      if (!res.success) setError(res.error ?? "Something went wrong");
      // On success the page revalidates and re-renders with the new status.
    });
  }

  return (
    <section className="cl-tile cl-tile-pad-lg cl-stack-12">
      <h2 className="cl-title-md">Your painting quote</h2>
      <p style={{ fontSize: 14, color: "var(--primary-70)", margin: 0, lineHeight: 1.55 }}>
        Your final painting price is <strong>${finalAmount.toFixed(2)}</strong>. Accept to confirm
        your booking, or reject to cancel and have your $799 deposit refunded in full.
      </p>
      {error ? (
        <p style={{ fontSize: 13, color: "var(--red, #dc2626)", margin: 0 }}>{error}</p>
      ) : null}

      {!confirmReject ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={pending}
            onClick={() => respond("ACCEPT")}
            className="cl-btn cl-btn-primary"
            style={{ flex: 1 }}>
            {pending ? <Loader2 size={14} className="cl-spin" /> : <Check size={14} />} Accept
            ${finalAmount.toFixed(2)}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmReject(true)}
            className="cl-btn cl-btn-secondary"
            style={{ flex: 1 }}>
            <X size={14} /> Reject
          </button>
        </div>
      ) : (
        <div className="cl-stack-8">
          <p style={{ fontSize: 13, color: "var(--ink)", margin: 0 }}>
            Reject this quote? Your booking will be cancelled and your $799 deposit refunded.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={pending}
              onClick={() => respond("REJECT")}
              className="cl-btn cl-btn-secondary"
              style={{ flex: 1 }}>
              {pending ? <Loader2 size={14} className="cl-spin" /> : null} Confirm rejection
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmReject(false)}
              className="cl-btn cl-btn-ghost"
              style={{ flex: 1 }}>
              Keep booking
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
