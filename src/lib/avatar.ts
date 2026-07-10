// Canonical avatar helpers (ported from Cleano). One deterministic, token-
// aligned palette so the same person gets the same color everywhere. Palette
// retuned to Fixaro's charcoal/orange/gold language (no Cleano teal).

const AV_PALETTE = [
  "#e85d04", // Fixaro accent orange
  "#c44c03", // deep orange
  "#cba35a", // gold
  "#1f7a5e", // green
  "#2f6fae", // blue
  "#8a4a55", // mauve
  "#5b5fb0", // indigo
  "#7a5ca0", // purple
];

/** Deterministic color for a name — same input always maps to the same swatch. */
export function avatarColor(name: string): string {
  let h = 0;
  const s = name || "";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AV_PALETTE[Math.abs(h) % AV_PALETTE.length];
}

/** Up to two uppercase initials from a name. */
export function initials(name: string): string {
  return (name || "")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
