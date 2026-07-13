"use client";

import { Minus, Plus } from "lucide-react";
import { jobStatusVisual } from "@/lib/status-icons";

// ─── Number stepper ───
export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="cl-stepper">
      <span className="cl-stepper-label">{label}</span>
      <div className="cl-stepper-controls">
        <button
          type="button"
          className="cl-stepper-btn"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}>
          <Minus size={14} />
        </button>
        <span className="cl-stepper-value">{value}</span>
        <button
          type="button"
          className="cl-stepper-btn"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Choice button ───
export function ChoiceButton({
  active,
  large,
  title,
  sub,
  hint,
  onClick,
  disabled,
  style,
}: {
  active?: boolean;
  large?: boolean;
  title?: string;
  sub?: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const cls = [
    "cl-choice",
    large ? "cl-choice-large" : "",
    active ? "active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (large) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        disabled={disabled}
        style={style}>
        <span className="cl-choice-title">{title}</span>
        {sub ? <span className="cl-choice-sub">{sub}</span> : null}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      style={style}>
      <span>{title}</span>
      {hint ? <span className="cl-choice-hint">{hint}</span> : null}
    </button>
  );
}

// ─── Status badge ───
//
// Labels come from the central status map (SOP §11) so a future icon/asset
// delivery is a one-file swap, and so an unrecognised status can never render as
// "Cancelled" — which is what this used to do, telling a customer their booking
// was cancelled on a parse miss. jobStatusVisual() normalises the spelling and
// falls back to CREATED.
//
// The one deliberate divergence: a customer sees "Scheduling" for CREATED (we
// have not attached a handyman yet), never the internal "Created".
const CUSTOMER_STATUS_OVERRIDES: Record<string, { slug: string; label: string }> = {
  created: { slug: "scheduling", label: "Scheduling" },
};

export function StatusBadge({ status }: { status: string }) {
  const visual = jobStatusVisual(status);
  const override = CUSTOMER_STATUS_OVERRIDES[visual.slug];
  const slug = override?.slug ?? visual.slug;
  const label = override?.label ?? visual.label;
  return <span className={`cl-badge cl-badge-${slug}`}>{label}</span>;
}

// ─── Date badge (used in portal overview & bookings) ───
export function DateBadge({ iso }: { iso: string }) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { day: "numeric" });
  const mon = d
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  return (
    <div className="cl-date-badge">
      <span className="cl-date-badge-mon">{mon}</span>
      <span className="cl-date-badge-day">{day}</span>
    </div>
  );
}
