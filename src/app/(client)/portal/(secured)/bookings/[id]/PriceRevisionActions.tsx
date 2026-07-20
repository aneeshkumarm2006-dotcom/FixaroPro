"use client";

import { useState, useTransition } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { respondToPriceRevision } from "@/app/(app)/actions/priceRevision";

// Phase 2B — the customer's side of an on-site scope change. The Pro found work
// outside the booked scope and proposed a new all-in price; the customer
// approves or rejects it here. Nothing on the bill has moved yet.
//
// Rejecting is a plain, safe choice and is presented as one: the job simply
// continues at the original price.

export interface PriceRevisionActionsProps {
  /** The PENDING JobPriceRevision. Render nothing (don't mount) when there isn't one. */
  revisionId: string;
  /** Price the job is at today. */
  previousPrice: number;
  /** New all-in price the Pro is proposing. */
  proposedPrice: number;
  /** The Pro's own words — shown verbatim. */
  reason: string;
  /** Display name of the Pro who raised it, if known. */
  requestedByName?: string | null;
}

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

export default function PriceRevisionActions({
  revisionId,
  previousPrice,
  proposedPrice,
  reason,
  requestedByName,
}: PriceRevisionActionsProps) {
  const [pending, startTransition] = useTransition();
  const [confirmReject, setConfirmReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const difference = proposedPrice - previousPrice;
  const isIncrease = difference > 0;

  function respond(response: "APPROVE" | "REJECT") {
    setError(null);
    startTransition(async () => {
      const res = await respondToPriceRevision({ revisionId, response });
      if (!res.success) setError(res.error ?? "Something went wrong");
      // On success the page revalidates and re-renders without this panel.
    });
  }

  return (
    <section className="cl-tile cl-tile-pad-lg cl-stack-12">
      <h2 className="cl-title-md">Approval needed — updated price</h2>
      <p style={{ fontSize: 14, color: "var(--primary-70)", margin: 0, lineHeight: 1.55 }}>
        {requestedByName ? `${requestedByName}, your Pro,` : "Your Pro"} has found work on your
        job that falls outside the original scope and is asking you to approve an updated
        price. <strong>Nothing is charged until you approve.</strong>
      </p>

      <div className="cl-stack-8">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ color: "var(--primary-70)" }}>Current price</span>
          <span>{money(previousPrice)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ color: "var(--primary-70)" }}>Proposed price</span>
          <strong>{money(proposedPrice)}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ color: "var(--primary-70)" }}>
            {isIncrease ? "Increase" : "Decrease"}
          </span>
          <span style={{ fontWeight: 600 }}>
            {isIncrease ? "+" : "−"}
            {money(Math.abs(difference))}
          </span>
        </div>
      </div>

      <div className="cl-stack-8">
        <p style={{ fontSize: 13, color: "var(--primary-70)", margin: 0, fontWeight: 600 }}>
          Why the price is changing
        </p>
        <p style={{ fontSize: 14, color: "var(--ink)", margin: 0, lineHeight: 1.55 }}>{reason}</p>
      </div>

      {error ? (
        <p style={{ fontSize: 13, color: "var(--red, #dc2626)", margin: 0 }}>{error}</p>
      ) : null}

      {!confirmReject ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={pending}
            onClick={() => respond("APPROVE")}
            className="cl-btn cl-btn-primary"
            style={{ flex: 1 }}>
            {pending ? <Loader2 size={14} className="cl-spin" /> : <Check size={14} />} Approve{" "}
            {money(proposedPrice)}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmReject(true)}
            className="cl-btn cl-btn-secondary"
            style={{ flex: 1 }}>
            <X size={14} /> Decline
          </button>
        </div>
      ) : (
        <div className="cl-stack-8">
          <p style={{ fontSize: 13, color: "var(--ink)", margin: 0 }}>
            Decline this change? Your job continues at {money(previousPrice)} and your Pro will
            be told to stick to the original scope.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={pending}
              onClick={() => respond("REJECT")}
              className="cl-btn cl-btn-secondary"
              style={{ flex: 1 }}>
              {pending ? <Loader2 size={14} className="cl-spin" /> : null} Confirm decline
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmReject(false)}
              className="cl-btn cl-btn-ghost"
              style={{ flex: 1 }}>
              Go back
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
