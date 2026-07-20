"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { jobStatusLabel, jobStatusSlug } from "@/lib/status-icons";
import { useJobTypeLabel } from "@/components/calendar/use-job-type-label";
import { fmtTime as tzTime } from "@/lib/timezone";

export type CalJob = {
  id: string;
  clientName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  jobType: string | null;
};

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return tzTime(iso);
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
function fmtHour(h: number) {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

const IconList = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const IconChevLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* ── Month view ── */

function MonthEvent({ job }: { job: CalJob }) {
  return (
    <Link href={`/my-jobs/${job.id}`} className={`cl-cal-event ${jobStatusSlug(job.status)}`}>
      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {job.clientName}
      </div>
      {job.startTime && <div className="cl-cal-event-time">{fmtTime(job.startTime)}</div>}
    </Link>
  );
}

function MonthGrid({ cursor, jobs, today }: { cursor: Date; jobs: CalJob[]; today: Date }) {
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - start.getDay());

  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + w * 7 + d);
      row.push(cell);
    }
    weeks.push(row);
  }

  function eventsOn(day: Date) {
    return jobs.filter((j) => new Date(j.date).toDateString() === day.toDateString());
  }

  return (
    <div className="cl-cal-grid">
      <div className="cl-cal-week-row header">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      {weeks.map((wk, wi) => (
        <div className="cl-cal-week-row" key={wi}>
          {wk.map((day, di) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = day.toDateString() === today.toDateString();
            const evs = eventsOn(day);
            return (
              <div
                key={di}
                className={`cl-cal-cell${inMonth ? "" : " dim"}${isToday ? " today" : ""}`}
              >
                <span className="day-num">{day.getDate()}</span>
                {evs.slice(0, 2).map((j) => (
                  <MonthEvent key={j.id} job={j} />
                ))}
                {evs.length > 2 && (
                  <div style={{ fontSize: 11, color: "var(--primary-50)" }}>
                    +{evs.length - 2} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── Week / Day positioned events ── */

function PositionedEvent({ job, expanded = false }: { job: CalJob; expanded?: boolean }) {
  const d = new Date(job.startTime || job.date);
  const mins = d.getHours() * 60 + d.getMinutes();
  const dur =
    job.endTime && job.startTime
      ? (new Date(job.endTime).getTime() - new Date(job.startTime).getTime()) / 60000
      : 90;
  const top = (mins / 60) * 48;
  const height = Math.max(28, (dur / 60) * 48);

  return (
    <Link
      href={`/my-jobs/${job.id}`}
      className={`cl-cal-time-event ${jobStatusSlug(job.status)}`}
      style={{ top: `${top}px`, height: `${height}px` }}
    >
      <div className="ev-title">{job.clientName}</div>
      {job.startTime && <div className="ev-time">{fmtTime(job.startTime)}</div>}
      {expanded && job.jobType && (
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {job.jobType}
        </div>
      )}
    </Link>
  );
}

/* ── Week view ── */

function WeekGrid({ weekDays, jobs, today }: { weekDays: Date[]; jobs: CalJob[]; today: Date }) {
  return (
    <div className="cl-cal-time-shell">
      <div className="cl-cal-time-head" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
        <div className="gmt">GMT</div>
        {weekDays.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={i} className={`day${isToday ? " today" : ""}`}>
              <span className="day-num">{d.getDate()}</span>
              <span className="day-name">
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="cl-cal-time-body" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
        <div className="cl-cal-time-col gutter">
          {HOURS.map((h) => (
            <div key={h} className="cl-cal-time-row">{fmtHour(h)}</div>
          ))}
        </div>
        {weekDays.map((day, di) => (
          <div key={di} className="cl-cal-time-col">
            {HOURS.map((h) => (
              <div key={h} className="cl-cal-time-cell" />
            ))}
            {jobs
              .filter((j) => new Date(j.date).toDateString() === day.toDateString())
              .map((j) => (
                <PositionedEvent key={j.id} job={j} />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Day view ── */

function DayGrid({ day, jobs }: { day: Date; jobs: CalJob[] }) {
  const dayJobs = jobs.filter((j) => new Date(j.date).toDateString() === day.toDateString());
  return (
    <div className="cl-cal-time-shell">
      <div className="cl-cal-time-head" style={{ gridTemplateColumns: "64px 1fr" }}>
        <div className="gmt">GMT</div>
        <div className="day" style={{ padding: "14px 18px" }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: "var(--primary)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            {dayJobs.length === 0 ? "No events" : `${dayJobs.length} event${dayJobs.length === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>
      <div className="cl-cal-time-body" style={{ gridTemplateColumns: "64px 1fr" }}>
        <div className="cl-cal-time-col gutter">
          {HOURS.map((h) => (
            <div key={h} className="cl-cal-time-row">{fmtHour(h)}</div>
          ))}
        </div>
        <div className="cl-cal-time-col">
          {HOURS.map((h) => (
            <div key={h} className="cl-cal-time-cell" />
          ))}
          {dayJobs.map((j) => (
            <PositionedEvent key={j.id} job={j} expanded />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Agenda view ── */

function AgendaView({
  cursor,
  view,
  jobs,
  today,
}: {
  cursor: Date;
  view: "month" | "week" | "day";
  jobs: CalJob[];
  today: Date;
}) {
  const jobTypeLabel = useJobTypeLabel();
  const days = useMemo(() => {
    if (view === "day") return [new Date(cursor)];
    if (view === "week") {
      const s = new Date(cursor);
      s.setDate(s.getDate() - s.getDay());
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(s);
        d.setDate(s.getDate() + i);
        return d;
      });
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const out: Date[] = [];
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      out.push(new Date(d));
    }
    return out;
  }, [cursor, view]);

  return (
    <div className="cl-agenda">
      {days.map((day) => {
        const evs = jobs.filter((j) => new Date(j.date).toDateString() === day.toDateString());
        const isToday = day.toDateString() === today.toDateString();
        return (
          <div className="cl-agenda-day" key={day.toISOString()}>
            <div className="cl-agenda-day-head">
              <h3 className={`cl-agenda-day-title${isToday ? " today" : ""}`}>
                {day.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h3>
              <span className="cl-agenda-day-count">
                {evs.length} {evs.length === 1 ? "event" : "events"}
              </span>
            </div>
            {evs.length === 0 ? (
              <div className="cl-agenda-empty">No events</div>
            ) : (
              evs.map((j) => (
                <Link
                  key={j.id}
                  href={`/my-jobs/${j.id}`}
                  className={`cl-agenda-event ${jobStatusSlug(j.status)}`}
                >
                  <div className="cl-agenda-event-head">
                    <span className="cl-agenda-event-title">{j.clientName}</span>
                    <span className="cl-pill" style={{ background: "rgba(0,0,0,0.04)", color: "var(--ink-soft)" }}>
                      {jobStatusLabel(j.status)}
                    </span>
                  </div>
                  {j.startTime && (
                    <div className="cl-agenda-event-time">
                      {fmtTime(j.startTime)}{j.endTime ? ` – ${fmtTime(j.endTime)}` : ""}
                    </div>
                  )}
                  {j.jobType && (
                    <div className="cl-agenda-event-sub">{jobTypeLabel(j.jobType)}</div>
                  )}
                </Link>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main export ── */

export default function CleanerCalendarClient({ jobs }: { jobs: CalJob[] }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [mode, setMode] = useState<"grid" | "agenda">("grid");
  const [cursor, setCursor] = useState(() => new Date());

  function step(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + delta);
      else if (view === "week") d.setDate(d.getDate() + delta * 7);
      else d.setDate(d.getDate() + delta);
      return d;
    });
  }

  function jump() {
    setCursor(new Date());
  }

  const title =
    view === "day"
      ? cursor.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const weekDays = useMemo(() => {
    const s = new Date(cursor);
    s.setDate(s.getDate() - s.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [cursor]);

  return (
    <div className="cl-cal-shell">
      {/* Toolbar */}
      <div className="cl-cal-bar">
        <h2 className="cl-cal-title">{title}</h2>

        <div className="cl-cal-views">
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div className="cl-cal-mode-toggle">
            <button
              className={mode === "grid" ? "active" : ""}
              onClick={() => setMode("grid")}
              title="Grid view"
            >
              <IconGrid />
            </button>
            <button
              className={mode === "agenda" ? "active" : ""}
              onClick={() => setMode("agenda")}
              title="Agenda view"
            >
              <IconList />
            </button>
          </div>

          <div className="cl-cal-nav">
            <button onClick={() => step(-1)} aria-label="Previous">
              <IconChevLeft />
            </button>
            <button className="cl-cal-today" onClick={jump}>Today</button>
            <button onClick={() => step(1)} aria-label="Next">
              <IconChevRight />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {mode === "agenda" ? (
        <AgendaView cursor={cursor} view={view} jobs={jobs} today={today} />
      ) : view === "month" ? (
        <MonthGrid cursor={cursor} jobs={jobs} today={today} />
      ) : view === "week" ? (
        <WeekGrid weekDays={weekDays} jobs={jobs} today={today} />
      ) : (
        <DayGrid day={cursor} jobs={jobs} />
      )}
    </div>
  );
}
