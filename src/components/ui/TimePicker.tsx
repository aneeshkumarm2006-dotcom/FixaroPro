"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value?: string;         // "HH:MM" 24-hour
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  size?: "sm" | "md" | "lg";
  step?: number;          // minute step, default 15
  name?: string;
  className?: string;
  style?: React.CSSProperties;
}

function formatDisplay(str?: string): string {
  if (!str) return "";
  const [h, m] = str.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return str;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

const H = { sm: 34, md: 44, lg: 52 } as const;
const FS = { sm: 13, md: 14, lg: 15 } as const;
const BR = { sm: 9, md: 10, lg: 12 } as const;

export default function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
  error = false,
  size = "md",
  step = 15,
  name,
  className = "",
  style,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minColRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: Math.floor(60 / step) }, (_, i) => i * step);

  const [selHour, selMinute] = value
    ? value.split(":").map(Number)
    : [null, null];

  function updatePos() {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropW = 220;
    let left = r.left;
    if (left + dropW > window.innerWidth - 12) left = r.right - dropW;
    setPos({ top: r.bottom + 5, left });
  }

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onSR = () => updatePos();
    document.addEventListener("scroll", onSR, true);
    window.addEventListener("resize", onSR);

    // Scroll selected items into view
    setTimeout(() => {
      if (selHour !== null && hourColRef.current) {
        const btn = hourColRef.current.children[selHour] as HTMLElement;
        btn?.scrollIntoView({ block: "center" });
      }
      if (selMinute !== null && minColRef.current) {
        const idx = minutes.indexOf(selMinute);
        const btn = minColRef.current.children[idx] as HTMLElement;
        btn?.scrollIntoView({ block: "center" });
      }
    }, 30);

    return () => {
      document.removeEventListener("scroll", onSR, true);
      window.removeEventListener("resize", onSR);
    };
  }, [open]);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (
        dropRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  function pick(h: number, m: number) {
    onChange?.(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    setOpen(false);
  }

  const border = error
    ? "1.5px solid #f87171"
    : open
    ? "1.5px solid #e85d04"
    : "1px solid rgba(232,93,4,0.16)";
  const boxShadow = open ? "0 0 0 3px rgba(232,93,4,0.11)" : "none";

  const COL_LABEL: React.CSSProperties = {
    padding: "10px 10px 6px",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    color: "rgba(232,93,4,0.38)",
    borderBottom: "1px solid rgba(232,93,4,0.07)",
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 1,
  };

  function ColBtn({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: 0,
          background: active ? "#e85d04" : "transparent",
          color: active ? "#fff" : "#111",
          fontSize: 13,
          fontWeight: active ? 700 : 400,
          fontFamily: "inherit",
          cursor: "pointer",
          textAlign: "left",
          transition: "background .1s",
        }}
        onMouseEnter={e => {
          if (!active)
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(232,93,4,0.06)";
        }}
        onMouseLeave={e => {
          if (!active)
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }}>
        {children}
      </button>
    );
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ""} />}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          width: "100%",
          height: H[size],
          padding: `0 ${size === "sm" ? 10 : 14}px`,
          borderRadius: BR[size],
          border,
          background: disabled ? "rgba(232,93,4,0.04)" : "#fff",
          fontSize: FS[size],
          color: value ? "#111" : "rgba(232,93,4,0.38)",
          fontFamily: "inherit",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "border .15s, box-shadow .15s",
          boxShadow,
          gap: 8,
          outline: "none",
          opacity: disabled ? 0.55 : 1,
          ...style,
        }}>
        <Clock size={14} style={{ flexShrink: 0, color: "rgba(232,93,4,0.45)" }} />
        <span style={{ flex: 1, textAlign: "left" }}>
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={dropRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: 220,
              zIndex: 9999,
              background: "#fff",
              borderRadius: 16,
              border: "1px solid rgba(232,93,4,0.1)",
              boxShadow: "0 8px 32px rgba(232,93,4,0.13), 0 2px 8px rgba(0,0,0,0.05)",
              overflow: "hidden",
              animation: "ps-drop .16s cubic-bezier(.2,.8,.3,1) both",
            }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {/* Hours */}
              <div style={{ borderRight: "1px solid rgba(232,93,4,0.08)", display: "flex", flexDirection: "column" }}>
                <div style={COL_LABEL}>Hour</div>
                <div
                  ref={hourColRef}
                  style={{ maxHeight: 220, overflowY: "auto", padding: "4px 5px 5px" }}>
                  {hours.map(hr => {
                    const period = hr >= 12 ? "PM" : "AM";
                    const label = hr === 0 ? "12" : hr > 12 ? String(hr - 12) : String(hr);
                    return (
                      <ColBtn
                        key={hr}
                        active={hr === selHour}
                        onClick={() => pick(hr, selMinute ?? 0)}>
                        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>{label}</span>
                          <span style={{ fontSize: 10, opacity: 0.6 }}>{period}</span>
                        </span>
                      </ColBtn>
                    );
                  })}
                </div>
              </div>

              {/* Minutes */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={COL_LABEL}>Min</div>
                <div
                  ref={minColRef}
                  style={{ maxHeight: 220, overflowY: "auto", padding: "4px 5px 5px" }}>
                  {minutes.map(min => (
                    <ColBtn
                      key={min}
                      active={min === selMinute}
                      onClick={() => pick(selHour ?? 9, min)}>
                      :{String(min).padStart(2, "0")}
                    </ColBtn>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
