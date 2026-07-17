"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { saveClientPaymentMethod } from "./actions/clientPaymentMethods";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface Props {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  /** Fires after the card is attached in Stripe and mirrored locally. */
  onSaved: () => void;
}

/**
 * Client-profile "Add card" panel. Reuses Fixaro's existing SetupIntent route
 * (/api/stripe/setup-intent) and the client's Stripe customer, so no card data
 * ever touches our server — Stripe Elements collects the card, and on success
 * `saveClientPaymentMethod` mirrors the resulting `pm_…` into ClientPaymentMethod.
 */
export default function AddClientCard({
  clientId,
  clientName,
  clientEmail,
  onSaved,
}: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setClientSecret(null);
    fetch("/api/stripe/setup-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        name: clientName,
        email: clientEmail ?? `${clientId}@fixaro.placeholder`,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setError(data.error ?? "Could not initialize card form.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not initialize card form.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, clientName, clientEmail]);

  return (
    <div className="acc-add">
      <div className="acc-add-title">Add a card</div>
      <p className="acc-add-sub">
        The card is stored securely with Stripe. We only keep the brand, last 4
        digits and expiry.
      </p>

      {loading && <p className="acc-add-note">Loading secure card form…</p>}
      {error && <p className="acc-add-err">{error}</p>}

      {clientSecret && (
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance: { theme: "stripe" } }}>
          <Inner
            clientId={clientId}
            setupIntentId={clientSecret.split("_secret_")[0]}
            onSaved={onSaved}
          />
        </Elements>
      )}

      <style jsx>{`
        .acc-add {
          margin-top: 12px;
          padding: 14px;
          background: rgba(232, 93, 4, 0.05);
          border: 1px dashed rgba(232, 93, 4, 0.3);
          border-radius: 10px;
        }
        .acc-add-title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #e85d04;
          margin-bottom: 6px;
        }
        .acc-add-sub {
          margin: 0 0 12px;
          font-size: 12px;
          color: rgba(232, 93, 4, 0.75);
          line-height: 1.5;
        }
        .acc-add-note {
          font-size: 13px;
          color: rgba(232, 93, 4, 0.6);
          margin: 0;
        }
        .acc-add-err {
          font-size: 13px;
          color: #dc2626;
          font-weight: 600;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

function Inner({
  clientId,
  setupIntentId,
  onSaved,
}: {
  clientId: string;
  setupIntentId: string;
  onSaved: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!stripe || !elements) return;
    setBusy(true);
    setErr(null);
    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    if (result.error) {
      setErr(result.error.message ?? "Could not save card.");
      setBusy(false);
      return;
    }
    const persisted = await saveClientPaymentMethod({ clientId, setupIntentId });
    if (!persisted.success) {
      setErr(persisted.error ?? "Card saved with Stripe but not linked.");
      setBusy(false);
      return;
    }
    onSaved();
    setBusy(false);
  }

  return (
    <div className="acc-inner">
      <PaymentElement options={{ layout: "tabs" }} />
      {err && <p className="acc-inner-err">{err}</p>}
      <button type="button" onClick={save} disabled={busy} className="acc-inner-btn">
        {busy ? "Saving…" : "Save card on file"}
      </button>

      <style jsx>{`
        .acc-inner {
          margin-top: 12px;
        }
        .acc-inner-err {
          margin-top: 8px;
          font-size: 12px;
          color: #dc2626;
          font-weight: 600;
        }
        .acc-inner-btn {
          margin-top: 12px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          background: ${busy ? "rgba(232,93,4,0.5)" : "#e85d04"};
          border: none;
          border-radius: 8px;
          cursor: ${busy ? "default" : "pointer"};
        }
      `}</style>
    </div>
  );
}
