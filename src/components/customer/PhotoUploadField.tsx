"use client";

// Shared customer-facing multi-photo uploader (SOP v4.2 §4). Uploads each file
// to Cloudinary via the public `uploadIntakePhoto` action and reports the
// resulting secure URLs up through `onChange`. Used by the Book Now notes step
// and the Get-a-Quote form. Self-contained inline styles so it renders
// correctly both inside `.cl-customer` and on the standalone quote page.

import { useRef, useState } from "react";
import { ImagePlus, X, Loader2, AlertCircle } from "lucide-react";
import { uploadIntakePhoto } from "@/app/(public)/actions/uploadIntakePhoto";

const ACCENT = "#e85d04";

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  /** Maximum number of photos. Default 8. */
  max?: number;
  /** Field heading. */
  label?: string;
  /** Helper text under the field. */
  hint?: string;
}

export default function PhotoUploadField({
  value,
  onChange,
  max = 8,
  label = "Photos",
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = max - value.length;

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Reset so selecting the same file again re-triggers change.
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;
    setError(null);

    const slots = files.slice(0, Math.max(0, remaining));
    if (files.length > remaining) {
      setError(`You can attach up to ${max} photos.`);
    }
    if (slots.length === 0) return;

    setUploading(true);
    const uploaded: string[] = [];
    for (const file of slots) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadIntakePhoto(fd);
      if (res.success) {
        uploaded.push(res.url);
      } else {
        setError(res.error);
        break;
      }
    }
    setUploading(false);
    if (uploaded.length > 0) onChange([...value, ...uploaded]);
  }

  function remove(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {label ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "#3a5a62",
          }}>
          {label}
        </span>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
          gap: 10,
        }}>
        {value.map((url, i) => (
          <div
            key={url}
            style={{
              position: "relative",
              aspectRatio: "1 / 1",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid rgba(28,25,23,0.12)",
              background: "rgba(28,25,23,0.04)",
            }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Attached photo ${i + 1}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
            />
            <button
              type="button"
              onClick={() => remove(url)}
              aria-label={`Remove photo ${i + 1}`}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 24,
                height: 24,
                borderRadius: 999,
                border: "none",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}>
              <X size={14} />
            </button>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Add photos"
            style={{
              aspectRatio: "1 / 1",
              borderRadius: 12,
              border: `1.5px dashed ${ACCENT}`,
              background: "rgba(232,93,4,0.05)",
              color: ACCENT,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              cursor: uploading ? "default" : "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              padding: 8,
            }}>
            {uploading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <ImagePlus size={22} />
                Add photos
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onFiles}
      />

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#dc2626",
          }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {hint ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "#7a6a62",
            lineHeight: 1.5,
          }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
