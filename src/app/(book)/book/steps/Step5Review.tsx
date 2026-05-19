"use client";

import { useMemo } from "react";
import { CreditCard } from "lucide-react";
import { BookingDraft, SERVICE_TYPES, FREQUENCIES } from "../types";
import { calculateTax } from "@/lib/tax";

interface Props {
  draft: BookingDraft;
  basePrice: number;
  onChange: (patch: Partial<BookingDraft>) => void;
  // separate "agree" state owned by parent — we expose via draft for now
}

export default function Step5Review({ draft, basePrice }: Props) {
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
        <h1
          className="cl-display"
          style={{ fontSize: "clamp(34px, 4.4vw, 52px)" }}>
          Review your
          <br />
          <em>booking.</em>
        </h1>
        <p className="cl-subtitle">
          You won't be charged today. We'll save your card and charge after
          your cleaning is complete.
        </p>
      </header>

      <div className="cl-card-soft">
        <span
          className="cl-label"
          style={{ display: "block", marginBottom: 14 }}>
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
        <span
          className="cl-label"
          style={{ display: "block", marginBottom: 14 }}>
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
          <Row dt="GST (5%)" dd={`$${breakdown.gstAmount.toFixed(2)}`} />
          <Row dt="QST (9.975%)" dd={`$${breakdown.qstAmount.toFixed(2)}`} />
          <RowBorder
            total
            dt="Total"
            dd={`$${breakdown.total.toFixed(2)}`}
          />
        </dl>
      </div>

      <div className="cl-payment-placeholder">
        <CreditCard
          size={22}
          style={{ color: "var(--primary)", flex: "0 0 auto", marginTop: 2 }}
        />
        <div>
          <div
            style={{
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: 4,
              fontSize: 15,
            }}>
            Payment — coming soon
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--primary-70)",
              lineHeight: 1.55,
            }}>
            We'll collect your card after confirmation. You won't be charged
            until your cleaning is complete.
          </div>
        </div>
      </div>
    </div>
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

function RowBorder({
  dt,
  dd,
  total,
}: {
  dt: string;
  dd: React.ReactNode;
  total?: boolean;
}) {
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
