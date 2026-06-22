// Central status icon + emoticon set mapped to Fixaro statuses (SOP §11).
// One source of truth so booking status, job status, painting status, deposit,
// and warnings render consistently across admin + crew + customer surfaces.
// Deliberately excludes Rag Wash indicators (removed — SOP §9).

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
  color: string; // hex/CSS for badges
}

const NEUTRAL = "#6b7280";

// Booking / job lifecycle (Job.status).
export const JOB_STATUS_VISUALS: Record<string, StatusVisual> = {
  CREATED: { Icon: CalendarPlus, emoji: "🆕", label: "Created", color: NEUTRAL },
  SCHEDULED: { Icon: CalendarClock, emoji: "📅", label: "Scheduled", color: "#2563eb" },
  IN_PROGRESS: { Icon: Loader, emoji: "🛠️", label: "In progress", color: "#d97706" },
  COMPLETED: { Icon: CheckCircle2, emoji: "✅", label: "Completed", color: "#059669" },
  PAID: { Icon: BadgeDollarSign, emoji: "💰", label: "Paid", color: "#059669" },
  CANCELLED: { Icon: XCircle, emoji: "❌", label: "Cancelled", color: "#dc2626" },
};

// Painting bid workflow (Job.paintingStatus).
export const PAINTING_STATUS_VISUALS: Record<string, StatusVisual> = {
  QUOTED: { Icon: Paintbrush, emoji: "🎨", label: "Quote sent", color: NEUTRAL },
  BIDDING: { Icon: Gavel, emoji: "🔨", label: "Taking bids", color: "#d97706" },
  OFFER_SENT: { Icon: Send, emoji: "📨", label: "Offer sent", color: "#2563eb" },
  ACCEPTED: { Icon: ThumbsUp, emoji: "👍", label: "Accepted", color: "#059669" },
  REJECTED: { Icon: ThumbsDown, emoji: "👎", label: "Rejected", color: "#dc2626" },
  CANCELLED: { Icon: XCircle, emoji: "❌", label: "Cancelled", color: "#dc2626" },
};

// Cross-cutting indicators.
export const DEPOSIT_VISUAL: StatusVisual = {
  Icon: PiggyBank,
  emoji: "🅳",
  label: "Deposit review needed",
  color: "#e85d04",
};
export const WARNING_VISUAL: StatusVisual = {
  Icon: AlertTriangle,
  emoji: "⚠️",
  label: "Attention needed",
  color: "#d97706",
};

export function jobStatusVisual(status?: string | null): StatusVisual {
  return (status && JOB_STATUS_VISUALS[status]) || JOB_STATUS_VISUALS.CREATED;
}
export function paintingStatusVisual(status?: string | null): StatusVisual {
  return (status && PAINTING_STATUS_VISUALS[status]) || PAINTING_STATUS_VISUALS.QUOTED;
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
