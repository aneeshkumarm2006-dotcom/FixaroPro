"use client";

import { useState } from "react";
import {
  BookingDraft,
  SERVICE_CATEGORIES,
  SERVICE_CATALOG,
  FREQUENCIES,
  HOUR_OPTIONS,
  computeHourlyPrice,
  ServiceItem,
} from "../types";
import { Field, Input } from "@/components/customer/Field";
import { ChoiceButton } from "@/components/customer/atoms";

interface Props {
  draft: BookingDraft;
  onChange: (patch: Partial<BookingDraft>) => void;
}

export default function Step2Property({ draft, onChange }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>(
    SERVICE_CATALOG.find((s) => s.value === draft.serviceType)?.category ??
      SERVICE_CATEGORIES[0]
  );

  const selectedService = SERVICE_CATALOG.find((s) => s.value === draft.serviceType);

  const servicesInCategory = SERVICE_CATALOG.filter(
    (s) => s.category === activeCategory
  );

  function selectService(item: ServiceItem) {
    // Reset hours to 2 when switching service (unless Silicone Sealing where hours = rooms)
    const resetHours = item.value === "SILICONE_SEALING" ? 1 : 2;
    onChange({ serviceType: item.value, hours: resetHours });
  }

  const isSiliconeSealing = draft.serviceType === "SILICONE_SEALING";
  const isQuoteOnly =
    draft.serviceType === "PAINTING" ||
    draft.serviceType === "MOULDINGS" ||
    (draft.serviceType === "TV_MOUNTING" && false); // TV mounting shows hours normally

  return (
    <div className="cl-stack-32">
      <header className="cl-stack-8">
        <p className="cl-eyebrow">Step 2</p>
        <h1
          className="cl-display"
          style={{ fontSize: "clamp(34px, 4.4vw, 52px)" }}>
          What do you
          <br />
          need <em>fixed?</em>
        </h1>
        <p className="cl-subtitle">
          Choose your service and how much time you need.
        </p>
      </header>

      {/* Address */}
      <Field label="Service address" htmlFor="prop-addr">
        <Input
          id="prop-addr"
          value={draft.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="123 rue Sainte-Catherine, Montréal"
        />
      </Field>

      {/* Category tabs */}
      <div className="cl-stack-12">
        <span className="cl-label">Service category</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: `1.5px solid ${activeCategory === cat ? "var(--accent)" : "rgba(28,25,23,0.15)"}`,
                background: activeCategory === cat ? "var(--accent)" : "#fff",
                color: activeCategory === cat ? "#fff" : "var(--ink)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all .15s",
                whiteSpace: "nowrap",
              }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Service list */}
      <div className="cl-stack-12">
        <span className="cl-label">Select service</span>
        <div className="cl-grid-2">
          {servicesInCategory.map((s) => (
            <ChoiceButton
              key={s.value}
              active={draft.serviceType === s.value}
              title={s.label}
              hint={
                s.pricing === "fixed"
                  ? s.priceNote
                  : s.pricing === "quote"
                  ? "Custom quote"
                  : "$79/hr"
              }
              onClick={() => selectService(s)}
            />
          ))}
        </div>
      </div>

      {/* Hours / rooms / quote */}
      {draft.serviceType && !isQuoteOnly && (
        <div className="cl-stack-12">
          <span className="cl-label">
            {isSiliconeSealing ? "Number of rooms" : "How many hours?"}
          </span>

          {selectedService?.priceNote && (
            <p style={{ fontSize: 12, color: "var(--primary-60)", margin: 0 }}>
              {selectedService.priceNote}
            </p>
          )}

          {isSiliconeSealing ? (
            // Room count for Silicone Sealing
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5].map((rooms) => (
                <ChoiceButton
                  key={rooms}
                  active={draft.hours === rooms}
                  title={`${rooms} room${rooms > 1 ? "s" : ""}`}
                  hint={`$${(rooms * 209).toFixed(0)}`}
                  onClick={() => onChange({ hours: rooms })}
                />
              ))}
            </div>
          ) : (
            // Hour selection for standard services
            <div className="cl-grid-2">
              {HOUR_OPTIONS.map((opt) => (
                <ChoiceButton
                  key={opt.hours}
                  active={draft.hours === opt.hours}
                  title={opt.label}
                  hint={`$${opt.price.toFixed(0)}${opt.badge ? ` · ${opt.badge}` : ""}`}
                  onClick={() => onChange({ hours: opt.hours })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quote-only notice */}
      {isQuoteOnly && draft.serviceType && (
        <div
          style={{
            padding: "16px 20px",
            background: "rgba(28,25,23,0.04)",
            borderRadius: 14,
            border: "1px solid rgba(28,25,23,0.10)",
          }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
            This service requires a custom quote.
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--primary-60)" }}>
            Add details and photos in the notes step — we'll confirm pricing before the visit.
          </p>
        </div>
      )}

      {/* Frequency */}
      <div className="cl-stack-12">
        <span className="cl-label">How often?</span>
        <p style={{ fontSize: 12, color: "var(--primary-60)", margin: 0, lineHeight: 1.5 }}>
          Recurring options auto-book future visits. You can change or cancel any visit before it happens.
        </p>
        <div className="cl-grid-2">
          {FREQUENCIES.map((f) => (
            <ChoiceButton
              key={f.value}
              active={draft.frequency === f.value}
              title={f.label}
              hint={f.hint}
              onClick={() => onChange({ frequency: f.value })}
            />
          ))}
        </div>
      </div>

      {/* Add-ons (admin-configurable) */}
      {draft.addOns.length > 0 && (
        <div className="cl-stack-12">
          <span className="cl-label">Add-ons</span>
          {draft.addOns.map((a, idx) => (
            <label
              key={a.id ?? `${a.name}-${idx}`}
              className={`cl-addon-row ${a.selected ? "active" : ""}`}>
              <div className="cl-row" style={{ gap: 12 }}>
                <input
                  type="checkbox"
                  className="cl-check"
                  checked={a.selected}
                  onChange={(e) => {
                    const next = [...draft.addOns];
                    next[idx] = { ...a, selected: e.target.checked };
                    onChange({ addOns: next });
                  }}
                />
                <span className="cl-addon-name">{a.name}</span>
              </div>
              <span className="cl-addon-price">+${a.price.toFixed(2)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
