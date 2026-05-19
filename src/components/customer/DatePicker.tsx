"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (iso: string) => void;
  min?: string; // YYYY-MM-DD
  max?: string;
  placeholder?: string;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISO(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select a date",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = fromISO(value);
  const minDate = fromISO(min ?? "");
  const maxDate = fromISO(max ?? "");
  const [viewMonth, setViewMonth] = useState<Date>(
    selected ?? minDate ?? new Date()
  );

  // Close on outside click
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Build the grid of dates for the current view month
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startWeekday = monthStart.getDay(); // 0 = Sunday
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0
  ).getDate();

  const cells: Array<{ date: Date | null; muted: boolean }> = [];
  // Leading days from previous month (muted)
  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      i - startWeekday + 1
    );
    cells.push({ date: d, muted: true });
  }
  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day),
      muted: false,
    });
  }
  // Trailing to fill the grid to 6 rows (42 cells)
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date!;
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    cells.push({ date: d, muted: true });
  }

  function isDisabled(d: Date): boolean {
    if (minDate && d < minDate) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  }

  function gotoPrev() {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  }
  function gotoNext() {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  }
  function pickToday() {
    const t = new Date();
    if (isDisabled(t)) return;
    onChange(toISO(t));
    setViewMonth(new Date(t.getFullYear(), t.getMonth(), 1));
    setOpen(false);
  }
  function clear() {
    onChange("");
    setOpen(false);
  }

  const displayLabel = selected
    ? selected.toLocaleDateString("en-US", {
        weekday: "short",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : placeholder;

  return (
    <div className="cl-dp" ref={rootRef}>
      <button
        type="button"
        className="cl-dp-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}>
        <span style={{ flex: 1, color: selected ? "var(--ink)" : "var(--primary-40)" }}>
          {displayLabel}
        </span>
        <CalendarIcon size={18} style={{ color: "var(--primary-60)" }} />
      </button>

      {open ? (
        <div className="cl-dp-pop" role="dialog" aria-label="Choose a date">
          <div className="cl-dp-head">
            <button
              type="button"
              className="cl-dp-nav"
              aria-label="Previous month"
              onClick={gotoPrev}>
              <ChevronLeft size={16} />
            </button>
            <div className="cl-dp-title">
              {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </div>
            <button
              type="button"
              className="cl-dp-nav"
              aria-label="Next month"
              onClick={gotoNext}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="cl-dp-weekdays">
            {DAY_LABELS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="cl-dp-grid">
            {cells.map((cell, i) => {
              const d = cell.date!;
              const isSel = selected && isSameDay(d, selected);
              const disabled = isDisabled(d);
              const today = isSameDay(d, new Date());
              const cls = [
                "cl-dp-day",
                cell.muted ? "muted" : "",
                isSel ? "selected" : "",
                today && !isSel ? "today" : "",
                disabled ? "disabled" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  disabled={disabled}
                  onClick={() => {
                    onChange(toISO(d));
                    if (cell.muted) {
                      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                    }
                    setOpen(false);
                  }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="cl-dp-foot">
            <button type="button" className="cl-dp-link" onClick={clear}>
              Clear
            </button>
            <button type="button" className="cl-dp-link" onClick={pickToday}>
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
