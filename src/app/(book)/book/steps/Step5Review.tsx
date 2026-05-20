"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard, Loader2, ShieldCheck, Tag, CheckCircle2 } from "lucide-react";
import { applyPromoCode } from "../../actions/applyPromoCode";
import { BookingDraft, SERVICE_TYPES, FREQUENCIES } from "../types";
import { calculateTax } from "@/lib/tax";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Props {
  draft: BookingDraft;
  basePrice: number;
  onChange: (patch: Partial<BookingDraft>) => void;
}

export default function Step5Review({ draft, basePrice, onChange }: Props) {
  const breakdown = useMemo(() => {
    const addOnTotal = draft.addOns
      .filter((a) => a.selected)
      .reduce((s, a) => s + a.price, 0);
    const subtotal = basePrice + addOnTotal + draft.travelFee;
    const tax = calculateTax(subtotal);
    return {
      addOnTotal,
      subtotal: tax.subtotal,
      gstAmount: tax.gstAmount,
      qstAmount: tax.qstAmount,
      total: tax.total,
    };
  }, [draft, basePrice]);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  // Promo code
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startPromoTransition] = useTransition();

  function handleApplyPromo() {
    if (!draft.promoCode?.trim()) return;
    startPromoTransition(async () => {
      const res = await applyPromoCode(draft.promoCode!, breakdown.subtotal);
      if (res.valid) {
        onChange({ promoDiscount: res.discountAmount, promoApplied: true });
        setPromoMsg({ ok: true, text: `Code applied — ${res.discountAmount! < 1 ? "" : "-"}$${res.discountAmount!.toFixed(2)} off` });
      } else {
        onChange({ promoDiscount: 0, promoApplied: false });
        setPromoMsg({ ok: false, text: res.message ?? "Invalid code" });
      }
    });
  }

  // Fetch a SetupIntent when contact info is known
  useEffect(() => {
    if (!draft.email || !draft.name) return;
    setStripeLoading(true);
    setStripeError(null);
    fetch("/api/stripe/setup-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: draft.email, name: draft.name }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          onChange({ stripeCustomerId: data.customerId });
        } else {
          setStripeError("Could not initialise payment. Please refresh.");
        }
      })
      .catch(() => setStripeError("Could not initialise payment. Please refresh."))
      .finally(() => setStripeLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.email, draft.name]);

  const service = SERVICE_TYPES.find((s) => s.value === draft.serviceType);
  const freq = FREQUENCIES.find((f) => f.value === draft.frequency);

  const propertyLine = [
    `${draft.bedCount} bed`,
    `${draft.bathCount} bath${draft.halfBathCount ? ` + ${draft.halfBathCount} half` : ""}`,
    draft.squareFootage > 0 ? `${draft.squareFootage} sq ft` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const dateLine = draft.date
    ? `${new Date(draft.date).toLocaleDateString("en-US", { weekday: "long" })} · ${
        draft.isFlexible ? "Flexible time" : formatSlot(draft.timeSlot)
      }`
    : "—";

  return (
    <div className="cl-stack-32">
      <header className="cl-stack-8">
        <p className="cl-eyebrow">Step 5 · Final</p>
        <h1 className="cl-display" style={{ fontSize: "clamp(34px, 4.4vw, 52px)" }}>
          Review your
          <br />
          <em>booking.</em>
        </h1>
        <p className="cl-subtitle">
          Your card won't be charged today — only after your cleaning is complete.
        </p>
      </header>

      <div className="cl-card-soft">
        <span className="cl-label" style={{ display: "block", marginBottom: 14 }}>
          Service
        </span>
        <dl className="cl-dlist">
          <Row dt="Type" dd={service?.label ?? "—"} />
          <Row dt="Frequency" dd={freq?.label ?? "—"} />
          <Row dt="Address" dd={draft.address || "—"} />
          <Row dt="Property" dd={propertyLine} />
          <Row dt="Date" dd={dateLine} />
        </dl>
      </div>

      <div className="cl-card-soft">
        <span className="cl-label" style={{ display: "block", marginBottom: 14 }}>
          Price breakdown
        </span>
        <dl className="cl-dlist">
          <Row dt="Base service" dd={`$${basePrice.toFixed(2)}`} />
          {draft.addOns
            .filter((a) => a.selected)
            .map((a) => (
              <Row key={a.name} dt={a.name} dd={`+$${a.price.toFixed(2)}`} />
            ))}
          {draft.travelFee > 0 ? (
            <Row dt="Travel fee" dd={`+$${draft.travelFee.toFixed(2)}`} />
          ) : null}
          <RowBorder dt="Subtotal" dd={`$${breakdown.subtotal.toFixed(2)}`} />
          {draft.promoApplied && draft.promoDiscount ? (
            <Row dt={`Promo (${draft.promoCode})`} dd={`-$${draft.promoDiscount.toFixed(2)}`} />
          ) : null}
          <Row dt="GST (5%)" dd={`$${breakdown.gstAmount.toFixed(2)}`} />
          <Row dt="QST (9.975%)" dd={`$${breakdown.qstAmount.toFixed(2)}`} />
          <RowBorder total dt="Total" dd={`$${(breakdown.total - (draft.promoDiscount ?? 0)).toFixed(2)}`} />
        </dl>
      </div>

      {/* Promo code apply */}
      {draft.promoCode && !draft.promoApplied && (
        <div className="cl-card-soft cl-stack-8">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Tag size={16} style={{ color: "var(--primary)" }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
              Promo code: <code style={{ fontFamily: "monospace" }}>{draft.promoCode}</code>
            </span>
          </div>
          {promoMsg && !promoMsg.ok && (
            <p style={{ fontSize: 13, color: "var(--red, #dc2626)" }}>{promoMsg.text}</p>
          )}
          <button
            type="button"
            onClick={handleApplyPromo}
            style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: 8, background: "var(--primary)", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}>
            Apply code
          </button>
        </div>
      )}
      {draft.promoApplied && promoMsg?.ok && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--primary)" }}>
          <CheckCircle2 size={16} /> {promoMsg.text}
        </div>
      )}

      {/* Stripe card save */}
      <div className="cl-card-soft cl-stack-12">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <CreditCard size={20} style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>
            Save your card
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--primary-70)", margin: "0 0 16px", lineHeight: 1.55 }}>
          We save your card now but only charge it after your cleaning is complete.
        </p>

        {stripeLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--primary-60)", fontSize: 14 }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            Loading payment form…
          </div>
        )}

        {stripeError && (
          <p style={{ color: "var(--red, #dc2626)", fontSize: 13 }}>{stripeError}</p>
        )}

        {clientSecret && !stripeLoading && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <CardForm onChange={onChange} />
          </Elements>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, color: "var(--primary-50)", fontSize: 12 }}>
          <ShieldCheck size={13} />
          Secured by Stripe · 256-bit encryption
        </div>
      </div>
    </div>
  );
}

function CardForm({ onChange }: { onChange: (p: Partial<BookingDraft>) => void }) {
  const stripe = useStripe();
  const elements = useElements();

  async function confirm() {
    if (!stripe || !elements) return null;
    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    if (result.error) return null;
    return (result.setupIntent as any).payment_method as string;
  }

  // Expose confirm handle via a data attribute so the parent page can call it before submit
  useEffect(() => {
    (window as any).__stripeConfirmCard = confirm;
    return () => { delete (window as any).__stripeConfirmCard; };
  });

  return (
    <PaymentElement
      options={{ layout: "tabs" }}
      onChange={(e) => {
        if (e.complete) {
          onChange({ stripeCardReady: true });
        } else {
          onChange({ stripeCardReady: false });
        }
      }}
    />
  );
}

function Row({ dt, dd }: { dt: string; dd: React.ReactNode }) {
  return (
    <div className="cl-dlist-row">
      <dt>{dt}</dt>
      <dd>{dd}</dd>
    </div>
  );
}

function RowBorder({ dt, dd, total }: { dt: string; dd: React.ReactNode; total?: boolean }) {
  return (
    <div className={`cl-dlist-row with-border ${total ? "total" : ""}`}>
      <dt>{dt}</dt>
      <dd>{dd}</dd>
    </div>
  );
}

function formatSlot(slot: string): string {
  if (!slot) return "—";
  const [h] = slot.split(":");
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? "PM" : "AM"}`;
}
