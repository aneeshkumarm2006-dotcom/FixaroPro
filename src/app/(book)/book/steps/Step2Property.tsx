"use client";

import { useEffect, useState } from "react";
import {
  BookingDraft,
  SERVICE_CATEGORIES,
  SERVICE_CATALOG,
  FREQUENCIES,
  HOUR_OPTIONS,
  computeHourlyPrice,
  getMaterialsPricing,
  ServiceItem,
  PAINT_REPAIR_SURFACES,
  AC_TYPES,
  AC_MOUNT_TYPES,
} from "../types";
import { PAINTING_SCOPES, paintingQuoteRange } from "@/lib/painting";
import { getRequiredEquipment } from "@/lib/equipment";
import { getServiceChecklist } from "../../actions/getServiceChecklist";
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

  const materials = getMaterialsPricing(draft.serviceType);

  const isSiliconeSealing = draft.serviceType === "SILICONE_SEALING";
  const isPainting = draft.serviceType === "PAINTING";
  const isSmallPaintRepair = draft.serviceType === "SMALL_PAINT_REPAIR";
  const isAcInstallation = draft.serviceType === "AC_INSTALLATION";

  // Equipment checklist (SOP §4). Seeded defaults render immediately; if an admin
  // has customised this service's list, swap in their version once it loads.
  const [checklist, setChecklist] = useState<string[]>(() =>
    getRequiredEquipment(draft.serviceType)
  );
  useEffect(() => {
    let cancelled = false;
    setChecklist(getRequiredEquipment(draft.serviceType));
    if (!draft.serviceType) return;
    getServiceChecklist(draft.serviceType)
      .then((items) => {
        if (!cancelled) setChecklist(items);
      })
      .catch(() => {
        /* keep the seeded default on failure */
      });
    return () => {
      cancelled = true;
    };
  }, [draft.serviceType]);
  const paintingRange = isPainting ? paintingQuoteRange(draft.paintingScope) : null;
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

      {/* Painting scope + immediate quote range (SOP §6/§7).
          Range is baseline × 1.35 and is an ESTIMATE — the final price is
          confirmed after provider bids. */}
      {isPainting && (
        <div className="cl-stack-12">
          <span className="cl-label">What are we painting?</span>
          <div className="cl-grid-2">
            {PAINTING_SCOPES.map((s) => (
              <ChoiceButton
                key={s.key}
                active={draft.paintingScope === s.key}
                title={s.label}
                hint={(() => {
                  const r = paintingQuoteRange(s.key);
                  return r ? `~$${r.min.toFixed(0)}–$${r.max.toFixed(0)}` : undefined;
                })()}
                onClick={() => onChange({ paintingScope: s.key })}
              />
            ))}
          </div>
          {paintingRange && (
            <div
              style={{
                padding: "16px 20px",
                background: "rgba(28,25,23,0.04)",
                borderRadius: 14,
                border: "1px solid rgba(28,25,23,0.10)",
              }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink)", fontWeight: 600 }}>
                Estimated range: ${paintingRange.min.toFixed(0)}–${paintingRange.max.toFixed(0)}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--primary-60)", lineHeight: 1.5 }}>
                This is an estimate. We notify our painters, take bids, and send you a final
                price to accept before any work begins. Primer, if required, may increase the price.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quote-only notice (non-painting custom-quote services, e.g. mouldings) */}
      {isQuoteOnly && !isPainting && draft.serviceType && (
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

      {/* Small paint repair intake (SOP v4.2 §4). Client always supplies the
          paint, so no paint-colour/procurement field is collected. */}
      {isSmallPaintRepair && (
        <div className="cl-stack-12">
          <span className="cl-label">Repair details</span>
          <Field label="What area needs repair?" htmlFor="spr-area">
            <Input
              id="spr-area"
              value={draft.paintRepairArea}
              onChange={(e) => onChange({ paintRepairArea: e.target.value })}
              placeholder="e.g. 2 patches on the living-room wall, approx. 30cm each"
            />
          </Field>
          <div className="cl-stack-12">
            <span className="cl-label">Wall / surface type</span>
            <div className="cl-grid-2">
              {PAINT_REPAIR_SURFACES.map((s) => (
                <ChoiceButton
                  key={s}
                  active={draft.paintRepairSurface === s}
                  title={s}
                  onClick={() => onChange({ paintRepairSurface: s })}
                />
              ))}
            </div>
          </div>
          <div
            style={{
              padding: "16px 20px",
              background: "rgba(28,25,23,0.04)",
              borderRadius: 14,
              border: "1px solid rgba(28,25,23,0.10)",
            }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
              You provide the paint — Fixaro does not supply or pick up paint.
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--primary-60)", lineHeight: 1.5 }}>
              Labour is $79/hr. Add photos and any extra detail in the notes step. The optional $49
              materials charge covers repair supplies only, never paint.
            </p>
          </div>
        </div>
      )}

      {/* AC installation intake (SOP v4.2 §4). No automatic materials charge;
          client provides the unit/accessories unless admin-approved. */}
      {isAcInstallation && (
        <div className="cl-stack-12">
          <span className="cl-label">AC details</span>
          <div className="cl-stack-12">
            <span className="cl-label">AC type</span>
            <div className="cl-grid-2">
              {AC_TYPES.map((t) => (
                <ChoiceButton
                  key={t}
                  active={draft.acType === t}
                  title={t}
                  onClick={() => onChange({ acType: t })}
                />
              ))}
            </div>
          </div>
          <Field label="Where is it being installed?" htmlFor="ac-loc">
            <Input
              id="ac-loc"
              value={draft.acLocation}
              onChange={(e) => onChange({ acLocation: e.target.value })}
              placeholder="e.g. 2nd-floor bedroom, north-facing window"
            />
          </Field>
          <div className="cl-stack-12">
            <span className="cl-label">Mounting / window details</span>
            <div className="cl-grid-2">
              {AC_MOUNT_TYPES.map((m) => (
                <ChoiceButton
                  key={m}
                  active={draft.acMountType === m}
                  title={m}
                  onClick={() => onChange({ acMountType: m })}
                />
              ))}
            </div>
          </div>
          <div className="cl-stack-12">
            <span className="cl-label">Do you already have the AC unit and accessories?</span>
            <div className="cl-grid-2">
              <ChoiceButton
                active={draft.clientHasAcUnit === true}
                title="Yes, I have everything"
                onClick={() => onChange({ clientHasAcUnit: true })}
              />
              <ChoiceButton
                active={draft.clientHasAcUnit === false}
                title="No, not yet"
                hint="We'll confirm before the visit"
                onClick={() => onChange({ clientHasAcUnit: false })}
              />
            </div>
          </div>
          <div
            style={{
              padding: "16px 20px",
              background: "rgba(28,25,23,0.04)",
              borderRadius: 14,
              border: "1px solid rgba(28,25,23,0.10)",
            }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
              Labour is billed at $79/hr — you provide the AC unit and accessories.
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--primary-60)", lineHeight: 1.5 }}>
              There is no automatic materials charge for AC installation. Any extra parts, brackets
              or hardware are client-provided, or approved by our team before the visit. Add photos
              in the notes step.
            </p>
          </div>
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

      {/* Service equipment checklist (SOP §4) — what this job type generally
          needs. Shown after service selection, before the materials choice. */}
      {draft.serviceType && (
        <div className="cl-stack-12">
          <span className="cl-label">Equipment typically required</span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}>
            {checklist.map((item) => (
              <span
                key={item}
                style={{
                  fontSize: 13,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "rgba(28,25,23,0.04)",
                  border: "1px solid rgba(28,25,23,0.10)",
                  color: "var(--ink)",
                }}>
                {item}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--primary-60)", margin: 0, lineHeight: 1.5 }}>
            Choose below whether Fixaro provides everything, or you'll have these ready before the visit.
          </p>
        </div>
      )}

      {/* Materials / equipment — all-or-nothing decision (SOP §4/§5).
          Appears at the bottom of the step. Default unchecked: the customer
          must actively confirm they want Fixaro to provide everything. */}
      {draft.serviceType && materials && (
        <div className="cl-stack-12">
          <span className="cl-label">Materials &amp; equipment</span>
          <label
            className={`cl-addon-row ${draft.customerRequestsMaterials ? "active" : ""}`}>
            <div className="cl-row" style={{ gap: 12 }}>
              <input
                type="checkbox"
                className="cl-check"
                checked={draft.customerRequestsMaterials}
                onChange={(e) =>
                  onChange({ customerRequestsMaterials: e.target.checked })
                }
              />
              <span className="cl-addon-name">
                Would you like us to provide all materials and equipment?
              </span>
            </div>
            <span className="cl-addon-price">
              {materials.type === "deposit"
                ? `$${materials.amount.toFixed(0)} deposit`
                : `+$${materials.amount.toFixed(2)}`}
            </span>
          </label>
          <p style={{ fontSize: 12, color: "var(--primary-60)", margin: 0, lineHeight: 1.5 }}>
            {draft.customerRequestsMaterials
              ? materials.type === "deposit"
                ? `A $${materials.amount.toFixed(0)} materials deposit is collected now. Any unused balance is applied to your final bill or refunded.`
                : materials.type === "charge"
                ? `A flat $${materials.amount.toFixed(2)} materials & equipment charge is added${isPainting ? ". This does not include paint — you must provide the exact paint/colour before the handyman arrives. Fixaro does not supply or pick up paint." : "."}`
                : `A $${materials.amount.toFixed(2)} materials & equipment charge is added to your booking.`
              : "Leave unchecked and you'll need to provide everything required before the handyman arrives."}
          </p>
        </div>
      )}
    </div>
  );
}
