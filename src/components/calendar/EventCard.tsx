import React from "react";
import Button from "@/components/ui/Button";
import {
  EventStyleInfo,
  getBlockStripeStyle,
  getEventBackgroundColor,
  getEventBoxShadow,
} from "./event-styles";
import { CalendarEvent } from "./types";

export interface EventCardProps {
  event: CalendarEvent;
  layout: {
    top: number;
    height: number;
    left: number | string;
    width: number | string;
  };
  styleInfo: EventStyleInfo;
  isBeingMoved: boolean;
  canResize: boolean;
  minEventHeight: number;
  onMouseDown: (e: React.MouseEvent, event: CalendarEvent) => void;
  onClick: (e: React.MouseEvent, event: CalendarEvent) => void;
  renderLocation?: (event: CalendarEvent, color: string) => React.ReactNode;
  className?: string;
}

/**
 * Shared event card used in both Week and Day views.
 */
export const EventCard: React.FC<EventCardProps> = ({
  event,
  layout,
  styleInfo,
  isBeingMoved,
  canResize,
  minEventHeight,
  onMouseDown,
  onClick,
  renderLocation,
  className,
}) => {
  return (
    <Button
      data-event-card
      variant="primary"
      border={false}
      className={`
        absolute flex flex-col justify-start items-start px-2 z-30 overflow-hidden transition-none
        ${layout.height > minEventHeight ? "py-1" : "py-0"}
        ${isBeingMoved ? "opacity-70" : ""}
        cursor-pointer
        ${className ?? ""}
      `}
      style={{
        backgroundColor: getEventBackgroundColor(styleInfo),
        top: `${layout.top + 0.5}px`,
        height: `${layout.height}px`,
        left: layout.left,
        width: layout.width,
        boxShadow: getEventBoxShadow(styleInfo),
      }}
      onMouseDown={(e) => onMouseDown(e, event)}
      onClick={(e) => onClick(e, event)}>
      {/* Diagonal stripes overlay for blocks */}
      {styleInfo.isBlock && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={getBlockStripeStyle(styleInfo.color)}
        />
      )}

      <div
        className="app-title-small truncate"
        style={{ color: styleInfo.color }}>
        {event.title}
        {event.metadata?.jobId && event.metadata?.status && (
          <span
            className="ml-1 text-[10px] px-1 py-0.5 rounded"
            style={{
              backgroundColor: styleInfo.color + "30",
            }}>
            {event.metadata.status.replace("_", " ")}
          </span>
        )}
      </div>

      {layout.height > 30 && event.metadata?.jobId && event.metadata?.jobType && (
        <div
          className="app-subtitle truncate text-[10px]"
          style={{ color: styleInfo.color, opacity: 0.85 }}>
          {event.metadata.jobType === "R"
            ? "Residential"
            : event.metadata.jobType === "C"
            ? "Commercial"
            : event.metadata.jobType === "PC"
            ? "Post-Construction"
            : event.metadata.jobType === "F"
            ? "Follow-up"
            : event.metadata.jobType}
        </div>
      )}

      {layout.height > 30 && !event.metadata?.jobType && event.label && (
        <div
          className="app-subtitle truncate"
          style={{ color: styleInfo.color }}>
          {event.label}
        </div>
      )}

      {layout.height > 50 &&
        event.metadata?.location &&
        renderLocation?.(event, styleInfo.color)}

      {layout.height > 65 &&
        event.metadata?.jobId &&
        event.metadata?.employeePay != null && (
          <div
            className="app-subtitle truncate text-[10px] font-[450]"
            style={{ color: styleInfo.color, opacity: 0.8 }}>
            ${Number(event.metadata.employeePay).toFixed(2)}
          </div>
        )}

      {layout.height > 80 &&
        event.metadata?.jobId &&
        event.metadata?.missingEquipment?.length > 0 && (
          <div
            className="app-subtitle truncate text-[10px] flex items-center gap-0.5"
            style={{ color: "#F59E0B" }}>
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            Missing equipment
          </div>
        )}

      {/* SOP §9: calendar shows material status and the "D" deposit-review flag.
          D marks a refundable materials deposit that ops still has to apply or
          refund. Painting's flat $119 charge is not a deposit and never shows D. */}
      {event.metadata?.jobId &&
        (event.metadata?.needsDepositReview ||
          event.metadata?.materialStatus === "FIXARO_PROVIDED") && (
          <div className="app-subtitle flex items-center gap-1 text-[10px]">
            {event.metadata?.needsDepositReview && (
              <span
                title="Deposit review required — apply or refund the materials deposit"
                style={{
                  color: "#B45309",
                  background: "rgba(217,119,6,0.14)",
                  borderRadius: 4,
                  padding: "0 4px",
                  fontWeight: 700,
                }}>
                D
              </span>
            )}
            {event.metadata?.materialStatus === "FIXARO_PROVIDED" && (
              <span title="Fixaro provides the materials and equipment">📦</span>
            )}
          </div>
        )}
    </Button>
  );
};

export default EventCard;
