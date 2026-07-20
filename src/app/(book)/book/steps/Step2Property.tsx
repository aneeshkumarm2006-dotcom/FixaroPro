"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookingDraft,
  FREQUENCIES,
  HOUR_CHOICES,
  PAINT_REPAIR_SURFACES,
  AC_TYPES,
  AC_MOUNT_TYPES,
  TV_SIZE_CHOICES,
  TV_WALL_TYPES,
  requiresCustomQuote,
  quoteReason,
  quoteRedirectHref,
} from "../types";
import {
  useServiceCatalog,
  useServiceCategories,
  useService,
  useMaterialsPricing,
  usePaintingScopes,
  usePaintingQuoteRange,
  useBasePrice,
  useHourlyPrice,
  usePolicy,
} from "@/lib/config/ServiceConfigProvider";
import { materialsLineLabel, customerPartOf, type ServiceConfigItem } from "@/lib/config/types";
import { getRequiredEquipment } from "@/lib/equipment";
import { getServiceChecklist } from "../../actions/getServiceChecklist";
import { Field, Input } from "@/components/customer/Field";
import { ChoiceButton } from "@/components/customer/atoms";

interface Props {
  draft: BookingDraft;
  onChange: (patch: Partial<BookingDraft>) => void;
}

export default function Step2Property({ draft, onChange }: Props) {
  // The catalog, prices and painting ranges all come from the admin-editable
  // config (SOP §3, stage 8) — not from a TS constant baked in at build time.
  const catalog = useServiceCatalog();
  const categories = useServiceCategories();
  const selectedService = useService(draft.serviceType);
  const materials = useMaterialsPricing(draft.serviceType);
  // Phase 2C — the major replacement item the CUSTOMER buys. Deliberately not
  // the same thing as `materials` below: that checkbox is about Fixaro supplying
  // consumables and tools for a surcharge, this is about the lock/faucet/panel
  // itself, which we never source. Both can apply to one booking.
  const customerPart = customerPartOf(selectedService);
  const paintingScopes = usePaintingScopes();
  const quoteRangeFor = usePaintingQuoteRange();
  const basePriceFor = useBasePrice();
  const hourlyPrice = useHourlyPrice();
  const policy = usePolicy();

  const [activeCategory, setActiveCategory] = useState<string>(
    () => selectedService?.category ?? categories[0] ?? ""
  );

  const servicesInCategory = catalog.filter((s) => s.category === activeCategory);

  // A "per-unit fixed price" service reuses the hours field as a unit count
  // (Silicone sealing = rooms). Driven by the service's own config flag, so a
  // NEW per-unit service gets the room picker without a code change — this used
  // to be `draft.serviceType === "SILICONE_SEALING"` in four places.
  const isPerUnit =
    selectedService?.pricing === "fixed" && selectedService.fixedPricePerUnit;
  // Gap 1/2/3 — does this selection have to leave the booking wizard for the
  // Request-a-Quote path? Evaluated from the LIVE catalog pricing model plus the
  // service-specific rules in types.ts. Painting is deliberately excluded: it is
  // quote-priced but completes here via its own bid/offer workflow.
  const needsQuote = requiresCustomQuote(draft, selectedService?.pricing);
  // Quote-priced services never show an hours/price picker, whether they leave
  // for /quote (mouldings, weatherproofing) or stay for the bid flow (painting).
  const isQuotePriced = selectedService?.pricing === "quote";

  function selectService(item: ServiceConfigItem) {
    // Per-unit services start at 1 unit; hourly services at the booking minimum.
    const resetHours =
      item.pricing === "fixed" && item.fixedPricePerUnit
        ? 1
        : policy.minBookingHours;
    onChange({ serviceType: item.value, hours: resetHours });
  }

  const isPainting = draft.serviceType === "PAINTING";
  const isSmallPaintRepair = draft.serviceType === "SMALL_PAINT_REPAIR";
  const isAcInstallation = draft.serviceType === "AC_INSTALLATION";
  const isTvMounting = draft.serviceType === "TV_MOUNTING";

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
  const paintingRange = isPainting ? quoteRangeFor(draft.paintingScope) : null;

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
          {categories.map((cat) => (
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
                  ? s.priceNote ?? undefined
                  : s.pricing === "quote"
                  ? s.priceNote ?? "Custom quote"
                  : s.priceNote ?? `$${policy.labourRate}/hr`
              }
              onClick={() => selectService(s)}
            />
          ))}
        </div>
      </div>

      {/* Hours / units / quote. Every price shown here is derived from the
          configured rate + the service's configured fixed price, so an admin
          repricing a service moves what the customer sees at the point of sale.
          These used to be `rooms * 209` and a HOUR_OPTIONS array whose prices
          were baked in at module load from the seed rate. */}
      {draft.serviceType && !needsQuote && !isQuotePriced && (
        <div className="cl-stack-12">
          <span className="cl-label">
            {isPerUnit ? "Number of rooms" : "How many hours?"}
          </span>

          {selectedService?.priceNote && (
            <p style={{ fontSize: 12, color: "var(--primary-60)", margin: 0 }}>
              {selectedService.priceNote}
            </p>
          )}

          {isPerUnit ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5].map((rooms) => (
                <ChoiceButton
                  key={rooms}
                  active={draft.hours === rooms}
                  title={`${rooms} room${rooms > 1 ? "s" : ""}`}
                  hint={`$${basePriceFor(rooms, draft.serviceType).toFixed(0)}`}
                  onClick={() => onChange({ hours: rooms })}
                />
              ))}
            </div>
          ) : (
            <div className="cl-grid-2">
              {HOUR_CHOICES.map((opt) => (
                <ChoiceButton
                  key={opt.hours}
                  active={draft.hours === opt.hours}
                  title={opt.label}
                  hint={`$${hourlyPrice(opt.hours).toFixed(0)}${opt.badge ? ` · ${opt.badge}` : ""}`}
                  onClick={() => onChange({ hours: opt.hours })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Painting scope + immediate quote range (SOP §6/§7). Range is the
          admin-editable internal baseline × the configured surplus rate, and is
          an ESTIMATE — the final price is confirmed after provider bids. */}
      {isPainting && (
        <div className="cl-stack-12">
          <span className="cl-label">What are we painting?</span>
          <div className="cl-grid-2">
            {paintingScopes.map((s) => (
              <ChoiceButton
                key={s.key}
                active={draft.paintingScope === s.key}
                title={s.label}
                hint={(() => {
                  const r = quoteRangeFor(s.key);
                  if (!r) return undefined;
                  return r.min === r.max
                    ? `~$${r.min.toFixed(0)}`
                    : `~$${r.min.toFixed(0)}–$${r.max.toFixed(0)}`;
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
                {paintingRange.min === paintingRange.max
                  ? `Estimated price: $${paintingRange.min.toFixed(0)}`
                  : `Estimated range: $${paintingRange.min.toFixed(0)}–$${paintingRange.max.toFixed(0)}`}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--primary-60)", lineHeight: 1.5 }}>
                This is an estimate. We notify our painters, take bids, and send you a final
                price to accept before any work begins. You supply the paint and primer — Fixaro
                doesn&apos;t provide them by default, though an admin can approve materials as a
                separate extra.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TV mounting intake (Gap 3). Screen size + wall type are what make the
          "60\"+ or brick/concrete → quote" rule detectable; both are required
          before the wizard will continue. */}
      {isTvMounting && (
        <div className="cl-stack-12">
          <span className="cl-label">TV details</span>
          <div className="cl-stack-12">
            <span className="cl-label">Screen size</span>
            <div className="cl-grid-2">
              {TV_SIZE_CHOICES.map((s) => (
                <ChoiceButton
                  key={s.value}
                  active={draft.tvSize === s.value}
                  title={s.value}
                  onClick={() => onChange({ tvSize: s.value })}
                />
              ))}
            </div>
          </div>
          <div className="cl-stack-12">
            <span className="cl-label">Wall / surface type</span>
            <div className="cl-grid-2">
              {TV_WALL_TYPES.map((w) => (
                <ChoiceButton
                  key={w}
                  active={draft.tvWallType === w}
                  title={w}
                  onClick={() => onChange({ tvWallType: w })}
                />
              ))}
            </div>
          </div>
          {!draft.tvSize || !draft.tvWallType ? (
            <p style={{ fontSize: 12, color: "var(--primary-60)", margin: 0, lineHeight: 1.5 }}>
              Pick both so we can confirm this is a standard mount. Larger screens
              and masonry walls are quoted individually.
            </p>
          ) : null}
        </div>
      )}

      {/* Quote path (Gap 1/2/3). Everything that cannot be priced instantly ends
          here instead of continuing to the deposit step — no card is ever
          requested for these. Painting is exempt: it keeps its bid workflow. */}
      {needsQuote && (
        <div
          style={{
            padding: "20px 22px",
            background: "rgba(232,93,4,0.05)",
            borderRadius: 14,
            border: "1px solid rgba(232,93,4,0.18)",
          }}>
          <p style={{ margin: 0, fontSize: 15, color: "var(--ink)", fontWeight: 600 }}>
            This one needs a custom quote
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--primary-60)", lineHeight: 1.55 }}>
            {quoteReason(draft)}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--primary-60)", lineHeight: 1.55 }}>
            Send us the details and we&apos;ll come back within one business day
            with a price. Nothing is charged and no card is needed.
          </p>
          <Link
            href={quoteRedirectHref(draft)}
            className="cl-btn cl-btn-primary"
            style={{ marginTop: 16, display: "inline-flex" }}>
            Request a quote →
          </Link>
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
              Labour is ${policy.labourRate}/hr. Add photos and any extra detail in the notes step.
              {materials
                ? ` The optional $${materials.amount.toFixed(0)} materials charge covers repair supplies only, never paint.`
                : ""}
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
              Labour is billed at ${policy.labourRate}/hr — you provide the AC unit and accessories.
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--primary-60)", lineHeight: 1.5 }}>
              There is no automatic materials charge for AC installation. Any extra parts, brackets
              or hardware are client-provided, or approved by our team before the visit. Add photos
              in the notes step.
            </p>
          </div>
        </div>
      )}

      {/* Frequency. Hidden on the quote path — there is no recurring schedule to
          pick until the price is agreed. */}
      {!needsQuote && (
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
      )}

      {/* Add-ons (admin-configurable) */}
      {!needsQuote && draft.addOns.length > 0 && (
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
            {needsQuote
              ? "Your quote will confirm what we bring and what you'll need to have ready."
              : "Choose below whether Fixaro provides everything, or you'll have these ready before the visit."}
          </p>
        </div>
      )}

      {/* Customer-supplied part (Phase 2C). Sits ABOVE the materials checkbox so
          the customer reads "you must buy the lock" before the separate "should
          Fixaro bring the materials?" question, and the two can't be confused.
          Shown for quote-routed services too — the requirement is true either
          way, only the pricing path differs. */}
      {draft.serviceType && customerPart && (
        <div className="cl-stack-12">
          <span className="cl-label">You supply the part</span>
          <div
            style={{
              background: "rgba(217,119,6,0.07)",
              border: "1px solid rgba(217,119,6,0.28)",
              borderRadius: 12,
              padding: "14px 16px",
            }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>
              You&apos;ll need to buy {customerPart.note} and have it on site
              before your Pro arrives.
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--primary-70)", lineHeight: 1.55 }}>
              Fixaro doesn&apos;t source or purchase it — the choice of brand,
              model and finish is yours. This is separate from the materials
              &amp; equipment question below, which is about the supplies and
              tools your Pro brings. We&apos;ll ask you to confirm it has
              arrived before the appointment. If it isn&apos;t on site, your Pro
              can&apos;t complete the work and the visit may need to be
              rescheduled.
            </p>
          </div>
        </div>
      )}

      {/* Materials / equipment — all-or-nothing decision (SOP §4/§5).
          Appears at the bottom of the step. Default unchecked: the customer
          must actively confirm they want Fixaro to provide everything. */}
      {draft.serviceType && materials && !needsQuote && (
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
          {/* D0.3 — the materials line reads "Materials & equipment charge —
              $119 (paint not included)" for painting. The qualifier is the
              service's configured `materialsNote`, so ops own the wording. */}
          <p style={{ fontSize: 13, color: "var(--ink)", margin: 0, fontWeight: 500 }}>
            {materialsLineLabel(materials)}
          </p>
          <p style={{ fontSize: 12, color: "var(--primary-60)", margin: 0, lineHeight: 1.5 }}>
            {draft.customerRequestsMaterials
              ? materials.type === "deposit"
                ? `A $${materials.amount.toFixed(0)} materials deposit is collected now. Any unused balance is applied to your final bill or refunded.`
                : materials.type === "charge"
                ? `A flat $${materials.amount.toFixed(2)} materials & equipment charge is collected now${isPainting ? ". This does not include paint — you must provide the exact paint/colour before the handyman arrives. Fixaro does not supply or pick up paint." : "."}`
                : `A $${materials.amount.toFixed(2)} materials & equipment charge is added to your final bill.`
              : "Leave unchecked and you'll need to provide everything required before the handyman arrives."}
          </p>
        </div>
      )}
    </div>
  );
}
