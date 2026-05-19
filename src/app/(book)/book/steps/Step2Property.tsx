"use client";

import { BookingDraft, SERVICE_TYPES, FREQUENCIES } from "../types";
import { Field, Input } from "@/components/customer/Field";
import { NumberStepper, ChoiceButton } from "@/components/customer/atoms";

interface Props {
  draft: BookingDraft;
  onChange: (patch: Partial<BookingDraft>) => void;
}

export default function Step2Property({ draft, onChange }: Props) {
  return (
    <div className="cl-stack-32">
      <header className="cl-stack-8">
        <p className="cl-eyebrow">Step 2</p>
        <h1
          className="cl-display"
          style={{ fontSize: "clamp(34px, 4.4vw, 52px)" }}>
          Tell us about
          <br />
          your <em>home.</em>
        </h1>
        <p className="cl-subtitle">
          A few details so we can put together a price.
        </p>
      </header>

      <Field label="Address" htmlFor="prop-addr">
        <Input
          id="prop-addr"
          value={draft.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="123 rue Sainte-Catherine, Montréal"
        />
      </Field>

      <div className="cl-grid-2">
        <NumberStepper
          label="Bedrooms"
          value={draft.bedCount}
          onChange={(v) => onChange({ bedCount: v })}
          min={0}
          max={8}
        />
        <NumberStepper
          label="Full bathrooms"
          value={draft.bathCount}
          onChange={(v) => onChange({ bathCount: v })}
          min={0}
          max={6}
        />
        <NumberStepper
          label="Half bathrooms"
          value={draft.halfBathCount}
          onChange={(v) => onChange({ halfBathCount: v })}
          min={0}
          max={4}
        />
        <Field label="Square footage">
          <Input
            value={draft.squareFootage || ""}
            onChange={(e) =>
              onChange({ squareFootage: parseInt(e.target.value) || 0 })
            }
            placeholder="e.g. 1200"
            inputMode="numeric"
          />
        </Field>
      </div>

      <div className="cl-stack-12">
        <span className="cl-label">Service type</span>
        <div className="cl-grid-2">
          {SERVICE_TYPES.map((s) => (
            <ChoiceButton
              key={s.value}
              active={draft.serviceType === s.value}
              title={s.label}
              onClick={() => onChange({ serviceType: s.value })}
            />
          ))}
        </div>
      </div>

      <div className="cl-stack-12">
        <span className="cl-label">Frequency</span>
        <p
          style={{
            fontSize: 12,
            color: "var(--primary-60)",
            margin: 0,
            lineHeight: 1.5,
          }}>
          Recurring options auto-book future visits so you don't have to. You
          can change or cancel any visit before it happens.
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

      <div className="cl-stack-12">
        <span className="cl-label">Add-ons</span>
        <div className="cl-stack-8">
          {draft.addOns.map((a, idx) => (
            <label
              key={a.name}
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
      </div>
    </div>
  );
}
