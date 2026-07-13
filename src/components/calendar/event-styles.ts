import { CalendarEvent } from "./types";
import { hexToRgba } from "./utils";
import { JOB_STATUS_VISUALS } from "@/lib/status-icons";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default event color when no type is specified */
export const DEFAULT_EVENT_COLOR = "#e85d04";

/** Background opacity for confirmed events */
export const EVENT_BG_OPACITY = 0.2;

/** Background opacity multiplier for unconfirmed events */
export const UNCONFIRMED_OPACITY_MULTIPLIER = 0.4;

// ============================================================================
// TYPES
// ============================================================================

export interface EventStyleInfo {
  color: string;
  isBlock: boolean;
  isUnconfirmed: boolean;
}

export interface EventTypesConfig {
  [key: string]: {
    color?: string;
    [key: string]: any;
  };
}

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Determines the color and styling info for an event based on its type and state.
 * This is the single source of truth for event styling across all calendar views.
 */
export function getEventStyleInfo(
  event: CalendarEvent,
  eventTypesConfig: EventTypesConfig
): EventStyleInfo {
  // Check if this is a job event (has jobId in metadata)
  if (event.metadata?.jobId) {
    // Status colour comes from the central status map (SOP §11) — an unknown
    // status keeps the neutral default rather than borrowing another status's
    // colour.
    const status = event.metadata.status;
    const jobColor =
      (status && JOB_STATUS_VISUALS[status]?.color) || DEFAULT_EVENT_COLOR;

    // All jobs are shown as confirmed (solid styling)
    return { color: jobColor, isBlock: false, isUnconfirmed: false };
  }

  // Get color from event type config, fallback to default
  const eventTypeColor = event.metadata?.selectedEventType
    ? eventTypesConfig[event.metadata.selectedEventType]?.color
    : null;

  const color = eventTypeColor || DEFAULT_EVENT_COLOR;
  const isBlock = event.metadata?.selectedEventType === "block";

  // Unconfirmed if confirmed is explicitly false OR undefined/null (not yet confirmed)
  const isUnconfirmed = event.confirmed !== true;

  return { color, isBlock, isUnconfirmed };
}

/**
 * Gets the background color for an event based on its style info.
 */
export function getEventBackgroundColor(styleInfo: EventStyleInfo): string {
  const opacity = styleInfo.isUnconfirmed
    ? EVENT_BG_OPACITY * UNCONFIRMED_OPACITY_MULTIPLIER
    : EVENT_BG_OPACITY;
  return hexToRgba(styleInfo.color, opacity);
}

/**
 * Gets the box shadow for unconfirmed events (inner border effect).
 * Returns undefined for confirmed events or blocks.
 */
export function getEventBoxShadow(styleInfo: EventStyleInfo): string | undefined {
  if (styleInfo.isUnconfirmed && !styleInfo.isBlock) {
    return `inset 0 0 0 1px ${styleInfo.color}4D`;
  }
  return undefined;
}

/**
 * Gets the diagonal stripe background CSS for block events.
 * Returns the style object to apply to a stripe overlay div.
 */
export function getBlockStripeStyle(color: string): React.CSSProperties {
  return {
    background: `repeating-linear-gradient(
      -45deg,
      ${color},
      ${color} 2px,
      transparent 2px,
      transparent 8px
    )`,
    opacity: 0.1,
    borderRadius: "inherit",
  };
}

