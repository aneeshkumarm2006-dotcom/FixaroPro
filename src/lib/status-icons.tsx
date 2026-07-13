// Central status icon + emoticon set mapped to Fixaro statuses (SOP §11).
// One source of truth so booking status, job status, painting status, deposit,
// and warnings render consistently across admin + crew + customer surfaces.
//
// D0.4: the lucide-react + Unicode substitutes ARE the Fixaro icon set until the
// client ships the original assets. The point of routing everything through this
// module is that the eventual asset delivery is a one-file swap — so nothing
// downstream may define its own status icon, emoji, label, or colour. If you
// need a status rendered somewhere new, add it here and import it.
//
// Each StatusVisual carries every token a surface could want:
//   Icon/emoji — the icon set (the part a future asset delivery replaces)
//   label      — the human string ("In progress", never the raw IN_PROGRESS enum)
//   color      — the solid accent: calendar event bars, chips, left borders
//   bg/fg/dot  — the pill triple: badge background, text, and leading dot
//   slug       — the crew CSS-class suffix (`cl-pill ${slug}`), kept because the
//                crew surfaces are CSS-driven rather than inline-styled

import {
  CalendarPlus,
  CalendarClock,
  Loader,
  CheckCircle2,
  BadgeDollarSign,
  XCircle,
  Paintbrush,
  Gavel,
  Send,
  ThumbsUp,
  ThumbsDown,
  PiggyBank,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

export interface StatusVisual {
  Icon: LucideIcon;
  emoji: string;
  label: string;
  color: string; // solid accent (calendar event bars, chips)
  bg: string; // pill background
  fg: string; // pill text
  dot: string; // pill dot (distinct from `color`: a Created pill dots grey,
  //             while a Created calendar bar is brand orange)
  slug: string; // crew CSS class suffix
}

const NEUTRAL = "#6b7280";

// Booking / job lifecycle (Job.status).
export const JOB_STATUS_VISUALS: Record<string, StatusVisual> = {
  CREATED: {
    Icon: CalendarPlus,
    emoji: "🆕",
    label: "Created",
    color: "#e85d04",
    bg: "#f3f4f6",
    fg: "#374151",
    dot: "#9ca3af",
    slug: "created",
  },
  SCHEDULED: {
    Icon: CalendarClock,
    emoji: "📅",
    label: "Scheduled",
    color: "#3b82f6",
    bg: "#dbeafe",
    fg: "#1e40af",
    dot: "#3b82f6",
    slug: "scheduled",
  },
  IN_PROGRESS: {
    Icon: Loader,
    emoji: "🛠️",
    label: "In progress",
    color: "#f59e0b",
    bg: "#fef3c7",
    fg: "#92400e",
    dot: "#f59e0b",
    slug: "inprogress",
  },
  COMPLETED: {
    Icon: CheckCircle2,
    emoji: "✅",
    label: "Completed",
    color: "#10b981",
    bg: "#d1fae5",
    fg: "#065f46",
    dot: "#10b981",
    slug: "completed",
  },
  PAID: {
    Icon: BadgeDollarSign,
    emoji: "💰",
    label: "Paid",
    color: "#059669",
    bg: "#d1fae5",
    fg: "#065f46",
    dot: "#059669",
    slug: "paid",
  },
  CANCELLED: {
    Icon: XCircle,
    emoji: "❌",
    label: "Cancelled",
    color: "#ef4444",
    bg: "#fee2e2",
    fg: "#991b1b",
    dot: "#ef4444",
    slug: "cancelled",
  },
};

// Painting bid workflow (Job.paintingStatus).
export const PAINTING_STATUS_VISUALS: Record<string, StatusVisual> = {
  QUOTED: {
    Icon: Paintbrush,
    emoji: "🎨",
    label: "Quote sent",
    color: NEUTRAL,
    bg: "#f3f4f6",
    fg: "#374151",
    dot: "#6b7280",
    slug: "quoted",
  },
  BIDDING: {
    Icon: Gavel,
    emoji: "🔨",
    label: "Taking bids",
    color: "#d97706",
    bg: "#fef3c7",
    fg: "#92400e",
    dot: "#d97706",
    slug: "bidding",
  },
  OFFER_SENT: {
    Icon: Send,
    emoji: "📨",
    label: "Offer sent",
    color: "#2563eb",
    bg: "#dbeafe",
    fg: "#1e40af",
    dot: "#2563eb",
    slug: "offersent",
  },
  ACCEPTED: {
    Icon: ThumbsUp,
    emoji: "👍",
    label: "Accepted",
    color: "#059669",
    bg: "#d1fae5",
    fg: "#065f46",
    dot: "#059669",
    slug: "accepted",
  },
  REJECTED: {
    Icon: ThumbsDown,
    emoji: "👎",
    label: "Rejected",
    color: "#dc2626",
    bg: "#fee2e2",
    fg: "#991b1b",
    dot: "#dc2626",
    slug: "rejected",
  },
  CANCELLED: {
    Icon: XCircle,
    emoji: "❌",
    label: "Cancelled",
    color: "#dc2626",
    bg: "#fee2e2",
    fg: "#991b1b",
    dot: "#dc2626",
    slug: "cancelled",
  },
};

// Cross-cutting indicators.
export const DEPOSIT_VISUAL: StatusVisual = {
  Icon: PiggyBank,
  emoji: "🅳",
  label: "Deposit / materials review needed",
  color: "#e85d04",
  bg: "#e85d04",
  fg: "#fff",
  dot: "#e85d04",
  slug: "deposit",
};
export const WARNING_VISUAL: StatusVisual = {
  Icon: AlertTriangle,
  emoji: "⚠️",
  label: "Attention needed",
  color: "#d97706",
  bg: "rgba(217,119,6,0.12)",
  fg: "#92400e",
  dot: "#d97706",
  slug: "warn",
};

// Some callers hand us the enum (`IN_PROGRESS`), others a display slug
// (crm.ts lowercases to `inprogress`). An exact-key miss would silently render
// EVERY row as "Created", so normalise both spellings back to the enum.
const STATUS_ALIASES: Record<string, string> = {
  INPROGRESS: "IN_PROGRESS",
  OFFERSENT: "OFFER_SENT",
  SCHEDULING: "CREATED", // customer-facing wording for CREATED
};

function statusKey(status?: string | null): string {
  const key = (status ?? "").toUpperCase().replace(/[\s-]/g, "_");
  return STATUS_ALIASES[key] ?? key;
}

export function jobStatusVisual(status?: string | null): StatusVisual {
  return JOB_STATUS_VISUALS[statusKey(status)] ?? JOB_STATUS_VISUALS.CREATED;
}
export function paintingStatusVisual(status?: string | null): StatusVisual {
  return PAINTING_STATUS_VISUALS[statusKey(status)] ?? PAINTING_STATUS_VISUALS.QUOTED;
}

/** Human label for a job status — never render the raw enum. */
export function jobStatusLabel(status?: string | null): string {
  return jobStatusVisual(status).label;
}
/** CSS-class suffix for the crew `cl-pill` / `cl-cal-event` surfaces. */
export function jobStatusSlug(status?: string | null): string {
  return jobStatusVisual(status).slug;
}

// Small inline status chip (icon + label). Reusable across surfaces.
export function StatusChip({
  visual,
  size = 14,
}: {
  visual: StatusVisual;
  size?: number;
}) {
  const { Icon, label, color } = visual;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        color,
      }}>
      <Icon size={size} />
      {label}
    </span>
  );
}

/**
 * Filled status pill (background + dot + label) on the shared `.pill` /
 * `.pill-dot` classes. The admin surfaces' badge — replaces the four hand-rolled
 * copies that had drifted apart (Scheduled rendered amber on the client page and
 * blue everywhere else).
 */
export function StatusPill({
  status,
  visual,
  dot = true,
}: {
  status?: string | null;
  visual?: StatusVisual;
  dot?: boolean;
}) {
  const v = visual ?? jobStatusVisual(status);
  return (
    <span className="pill" style={{ background: v.bg, color: v.fg }}>
      {dot ? <span className="pill-dot" style={{ background: v.dot }} /> : null}
      {v.label}
    </span>
  );
}

/**
 * The deposit "D" indicator (SOP §11: "D indicator for deposits — Admin can
 * identify bookings requiring deposit/materials review").
 *
 * `hint` appends the actionable half of the tooltip; the calendar — where ops
 * actually action deposits — passes "apply or refund the materials deposit".
 */
export function DepositBadge({
  size = 11,
  hint,
}: {
  size?: number;
  hint?: string;
}) {
  const title = hint ? `${DEPOSIT_VISUAL.label} — ${hint}` : DEPOSIT_VISUAL.label;
  return (
    <span
      role="img"
      title={title}
      aria-label={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 4px",
        minWidth: size + 5,
        borderRadius: 4,
        background: DEPOSIT_VISUAL.bg,
        color: DEPOSIT_VISUAL.fg,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.5,
        flexShrink: 0,
      }}>
      D
    </span>
  );
}
