"use client";

import { useState, useTransition } from "react";
import { submitQuote } from "./actions/submitQuote";
import {
  PAINT_REPAIR_SURFACES,
  AC_TYPES,
  AC_MOUNT_TYPES,
} from "@/app/(book)/book/types";
import {
  useServiceCatalog,
  useServiceCategories,
} from "@/lib/config/ServiceConfigProvider";
import PhotoUploadField from "@/components/customer/PhotoUploadField";

// SOP v4.2 §4/§9 — Get a Quote uses the same catalog as Book Now, and renders
// the same service-specific intake per selection. Both new services (Small
// paint repair, AC installation) are selectable and collect their real fields.

export default function QuoteFormClient() {
  // Same admin-editable catalog the booking page uses (SOP §4: "Both services
  // must be added to the same service catalog/config used by public quote intake
  // and booking checkout so pricing, checklist, provider eligibility, and admin
  // job cards stay consistent"). Retired services are excluded.
  const catalog = useServiceCatalog();
  const categories = useServiceCategories();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [message, setMessage] = useState("");

  // Service-specific intake (SOP v4.2 §4).
  const [paintRepairArea, setPaintRepairArea] = useState("");
  const [paintRepairSurface, setPaintRepairSurface] = useState("");
  const [acType, setAcType] = useState("");
  const [acLocation, setAcLocation] = useState("");
  const [acMountType, setAcMountType] = useState("");
  const [clientHasAcUnit, setClientHasAcUnit] = useState(""); // "" | "yes" | "no"
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const isPainting = serviceType === "PAINTING";
  const isSmallPaintRepair = serviceType === "SMALL_PAINT_REPAIR";
  const isAcInstallation = serviceType === "AC_INSTALLATION";
  // Both painting and small paint repair: client always supplies the paint.
  const showPaintCopy = isPainting || isSmallPaintRepair;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitQuote({
        name,
        email,
        phone: phone || undefined,
        address: address || undefined,
        serviceType: serviceType || undefined,
        preferredDate: preferredDate || undefined,
        message: message || undefined,
        paintRepairArea: isSmallPaintRepair ? paintRepairArea || undefined : undefined,
        paintRepairSurface: isSmallPaintRepair ? paintRepairSurface || undefined : undefined,
        acType: isAcInstallation ? acType || undefined : undefined,
        acLocation: isAcInstallation ? acLocation || undefined : undefined,
        acMountType: isAcInstallation ? acMountType || undefined : undefined,
        clientHasAcUnit: isAcInstallation
          ? clientHasAcUnit === "yes"
            ? true
            : clientHasAcUnit === "no"
            ? false
            : undefined
          : undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      });
      if (!result.success) {
        setError(result.error ?? "Could not submit");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div
        style={{
          padding: 32,
          background: "#fff",
          border: "1px solid rgba(232,93,4,0.12)",
          borderRadius: 16,
          textAlign: "center",
        }}>
        <h2 style={{ margin: 0, fontSize: 22, color: "#e85d04" }}>
          Got it — we'll be in touch
        </h2>
        <p style={{ marginTop: 12, fontSize: 14, color: "#3a5a62", lineHeight: 1.6 }}>
          Thanks for the details. A member of our team will follow up by email
          within one business day with pricing and next steps.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#fff",
        border: "1px solid rgba(232,93,4,0.12)",
        borderRadius: 16,
        padding: 28,
        boxShadow: "0 8px 24px rgba(232,93,4,0.06)",
      }}>
      <Row>
        <Field label="Full name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={inputStyle}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </Field>
      </Row>

      <Row>
        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Service type">
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            style={inputStyle}>
            <option value="">Select…</option>
            {categories.map((cat) => (
              <optgroup key={cat} label={cat}>
                {catalog.filter((s) => s.category === cat).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
      </Row>

      <Field label="Address">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={inputStyle}
        />
      </Field>

      {/* Small paint repair intake (SOP v4.2 §4). No paint-colour/procurement
          field — the client always supplies the paint. */}
      {isSmallPaintRepair && (
        <Row>
          <Field label="What area needs repair?">
            <input
              type="text"
              value={paintRepairArea}
              onChange={(e) => setPaintRepairArea(e.target.value)}
              placeholder="e.g. 2 patches on the living-room wall"
              style={inputStyle}
            />
          </Field>
          <Field label="Wall / surface type">
            <select
              value={paintRepairSurface}
              onChange={(e) => setPaintRepairSurface(e.target.value)}
              style={inputStyle}>
              <option value="">Select…</option>
              {PAINT_REPAIR_SURFACES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </Row>
      )}

      {/* AC installation intake (SOP v4.2 §4). */}
      {isAcInstallation && (
        <>
          <Row>
            <Field label="AC type">
              <select
                value={acType}
                onChange={(e) => setAcType(e.target.value)}
                style={inputStyle}>
                <option value="">Select…</option>
                {AC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mounting / window details">
              <select
                value={acMountType}
                onChange={(e) => setAcMountType(e.target.value)}
                style={inputStyle}>
                <option value="">Select…</option>
                {AC_MOUNT_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Where is it being installed?">
              <input
                type="text"
                value={acLocation}
                onChange={(e) => setAcLocation(e.target.value)}
                placeholder="e.g. 2nd-floor bedroom, north-facing window"
                style={inputStyle}
              />
            </Field>
            <Field label="Do you have the AC unit & accessories?">
              <select
                value={clientHasAcUnit}
                onChange={(e) => setClientHasAcUnit(e.target.value)}
                style={inputStyle}>
                <option value="">Select…</option>
                <option value="yes">Yes, I have everything</option>
                <option value="no">No, not yet</option>
              </select>
            </Field>
          </Row>
        </>
      )}

      {/* Client-provided paint notice (SOP v4.2 §4/§7) — painting + small paint
          repair. Mirrors the Book Now copy. */}
      {showPaintCopy && (
        <div
          style={{
            margin: "0 0 16px",
            padding: "14px 16px",
            background: "rgba(232,93,4,0.05)",
            border: "1px solid rgba(232,93,4,0.15)",
            borderRadius: 10,
            fontSize: 13,
            color: "#3a5a62",
            lineHeight: 1.55,
          }}>
          <strong style={{ color: "#0a1f24" }}>You supply the paint.</strong>{" "}
          Fixaro does not supply or pick up paint — please have the exact
          paint/colour ready before the visit. Our quote covers labour
          {isSmallPaintRepair ? " and small repair materials only" : ""}.
        </div>
      )}

      <Field label="Preferred date">
        <input
          type="date"
          value={preferredDate}
          onChange={(e) => setPreferredDate(e.target.value)}
          style={inputStyle}
        />
      </Field>

      {/* Intake photos (SOP v4.2 §4). Optional; especially useful for paint
          repair and AC installation. */}
      <div style={{ marginBottom: 16 }}>
        <PhotoUploadField
          value={photoUrls}
          onChange={setPhotoUrls}
          label="Add photos (optional)"
          hint="Photos of the space or the work help us give an accurate quote. JPG, PNG, HEIC or WebP — up to 8."
        />
      </div>

      <Field label="Anything else we should know?">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          placeholder="Access instructions, timing, scope details…"
        />
      </Field>

      {error && (
        <p
          style={{
            marginTop: 12,
            color: "#dc2626",
            fontSize: 13,
            fontWeight: 600,
          }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          marginTop: 20,
          width: "100%",
          padding: "14px 16px",
          fontSize: 15,
          fontWeight: 700,
          color: "#fff",
          background: pending ? "#7daab0" : "#e85d04",
          border: "none",
          borderRadius: 10,
          cursor: pending ? "default" : "pointer",
        }}>
        {pending ? "Sending…" : "Request my quote"}
      </button>
    </form>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
        marginBottom: 16,
      }}>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#3a5a62",
          marginBottom: 6,
          letterSpacing: "0.02em",
        }}>
        {label}
        {required && <span style={{ color: "#dc2626" }}> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  fontSize: 14,
  color: "#0a1f24",
  background: "#fff",
  border: "1px solid rgba(232,93,4,0.18)",
  borderRadius: 8,
};
