"use client";

import { BookingDraft } from "../types";
import { Field, Input, Textarea } from "@/components/customer/Field";
import PhotoUploadField from "@/components/customer/PhotoUploadField";
import { isValidEmail, isValidPhone } from "@/lib/validation";

interface Props {
  draft: BookingDraft;
  onChange: (patch: Partial<BookingDraft>) => void;
}

// Services where photos of the work materially improve the quote/prep. Photos
// stay optional everywhere (we never block a paid booking on an upload), but we
// lead with a stronger ask for these (SOP v4.2 §4).
const PHOTO_EMPHASIS_SERVICES = new Set(["SMALL_PAINT_REPAIR", "AC_INSTALLATION"]);

const errorStyle: React.CSSProperties = {
  color: "#dc2626",
  fontSize: 13,
  marginTop: 4,
  display: "block",
};

export default function Step4Contact({ draft, onChange }: Props) {
  const emailError = draft.email.trim() !== "" && !isValidEmail(draft.email);
  const phoneError = draft.phone.trim() !== "" && !isValidPhone(draft.phone);
  const emphasizePhotos = PHOTO_EMPHASIS_SERVICES.has(draft.serviceType);

  return (
    <div className="cl-stack-32">
      <header className="cl-stack-8">
        <p className="cl-eyebrow">Step 4</p>
        <h1
          className="cl-display"
          style={{ fontSize: "clamp(34px, 4.4vw, 52px)" }}>
          How can we
          <br />
          reach <em>you?</em>
        </h1>
        <p className="cl-subtitle">
          We'll send a confirmation and a reminder before your appointment.
        </p>
      </header>

      <Field label="Full name" htmlFor="c-name">
        <Input
          id="c-name"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Sarah Tremblay"
          autoFocus
        />
      </Field>

      <div className="cl-grid-2">
        <Field label="Email" htmlFor="c-email">
          <Input
            id="c-email"
            type="email"
            value={draft.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="you@email.com"
            aria-invalid={emailError}
          />
          {emailError && (
            <span style={errorStyle}>Enter a valid email address.</span>
          )}
        </Field>
        <Field label="Phone" htmlFor="c-phone">
          <Input
            id="c-phone"
            type="tel"
            value={draft.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="(514) 555-0142"
            aria-invalid={phoneError}
          />
          {phoneError && (
            <span style={errorStyle}>Enter a valid 10-digit phone number.</span>
          )}
        </Field>
      </div>

      <Field label="Notes" htmlFor="c-notes">
        <Textarea
          id="c-notes"
          rows={3}
          value={draft.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Pets, parking, door codes, sensitive surfaces…"
        />
      </Field>

      {/* Intake photos (SOP v4.2 §4). Optional, but strongly encouraged for the
          services where a photo materially changes the quote/prep. */}
      <PhotoUploadField
        value={draft.photoUrls}
        onChange={(urls) => onChange({ photoUrls: urls })}
        label={
          emphasizePhotos
            ? "Add photos of the work (recommended)"
            : "Add photos (optional)"
        }
        hint={
          emphasizePhotos
            ? "Photos of the repair area / AC location help us quote accurately and bring the right kit. JPG, PNG, HEIC or WebP — up to 8."
            : "A few photos help our team prepare and quote accurately. JPG, PNG, HEIC or WebP — up to 8."
        }
      />

      <div className="cl-grid-2">
        <Field label="Referral code (optional)" htmlFor="c-ref">
          <input
            id="c-ref"
            className="cl-input mono"
            value={draft.referralCode}
            onChange={(e) =>
              onChange({ referralCode: e.target.value.toUpperCase() })
            }
            placeholder="FRIEND15"
            maxLength={16}
          />
        </Field>
        <Field label="Promo code (optional)" htmlFor="c-promo">
          <input
            id="c-promo"
            className="cl-input mono"
            value={draft.promoCode ?? ""}
            onChange={(e) =>
              onChange({ promoCode: e.target.value.toUpperCase(), promoDiscount: 0, promoApplied: false })
            }
            placeholder="SUMMER20"
            maxLength={24}
          />
        </Field>
      </div>
    </div>
  );
}
