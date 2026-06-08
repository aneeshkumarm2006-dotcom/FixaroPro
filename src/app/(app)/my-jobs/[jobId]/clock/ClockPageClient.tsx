"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clockIn } from "../../../actions/clockIn";
import { BUSINESS_TZ } from "@/lib/timezone";

interface ClockPageClientProps {
  jobId: string;
  clientName: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  clockInTime: string | null;
  clockOutTime: string | null;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function fmtClock(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit",
    hour12: true, timeZone: BUSINESS_TZ,
  }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return `${get("hour").padStart(2, "0")}:${get("minute")}:${get("second")} ${get("dayPeriod")}`;
}

function fmtShort(d: Date) {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: BUSINESS_TZ,
  });
}

function fmtDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function AnalogClock({ time }: { time: Date }) {
  const sec = time.getSeconds();
  const min = time.getMinutes() + sec / 60;
  const hr = (time.getHours() % 12) + min / 60;
  const secDeg = sec * 6;
  const minDeg = min * 6;
  const hourDeg = hr * 30;

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const isHour = i % 5 === 0;
    const angle = i * 6;
    const inner = isHour ? 84 : 88;
    const rad = (angle * Math.PI) / 180;
    const sinA = Math.sin(rad);
    const cosA = Math.cos(rad);
    const r = (v: number) => Math.round(v * 1e4) / 1e4;
    return {
      x1: r(100 + sinA * inner),
      y1: r(100 - cosA * inner),
      x2: r(100 + sinA * 96),
      y2: r(100 - cosA * 96),
      isHour,
    };
  });

  const numerals = [
    { n: 12, x: 50, y: 13 },
    { n: 3, x: 87, y: 50 },
    { n: 6, x: 50, y: 88 },
    { n: 9, x: 13, y: 50 },
  ];

  return (
    <div className="clk-stage">
      <div className="clk-face">
        <svg className="clk-ticks" viewBox="0 0 200 200">
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.isHour ? "rgba(232, 93, 4, 0.5)" : "rgba(232, 93, 4, 0.2)"}
              strokeWidth={t.isHour ? 1.4 : 0.8}
              strokeLinecap="round"
            />
          ))}
        </svg>

        {numerals.map((n) => (
          <span
            key={n.n}
            className="clk-num"
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
          >
            {n.n}
          </span>
        ))}

        <span
          className="clk-hand hour"
          style={{ transform: `translate(-50%, -100%) rotate(${hourDeg}deg)` }}
        />
        <span
          className="clk-hand minute"
          style={{ transform: `translate(-50%, -100%) rotate(${minDeg}deg)` }}
        />
        <span
          className="clk-hand second"
          style={{ transform: `translate(-50%, -100%) rotate(${secDeg}deg)` }}
        />
        <span className="clk-pivot" />
        <span className="clk-pivot-inner" />

        <div className="clk-readout">{fmtClock(time)}</div>
      </div>
    </div>
  );
}

export default function ClockPageClient({
  jobId,
  clientName,
  startTime,
  clockInTime,
  clockOutTime,
}: ClockPageClientProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isLive = !!clockInTime && !clockOutTime;
  const isDone = !!clockInTime && !!clockOutTime;

  const clockInDate = clockInTime ? new Date(clockInTime) : null;
  const clockOutDate = clockOutTime ? new Date(clockOutTime) : null;
  const startDate = startTime ? new Date(startTime) : null;

  const elapsedMs = isLive
    ? now.getTime() - clockInDate!.getTime()
    : isDone
    ? clockOutDate!.getTime() - clockInDate!.getTime()
    : 0;

  const earlyByMs = startDate ? startDate.getTime() - now.getTime() : 0;

  const initials = clientName
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleClockIn() {
    setLoading(true);
    setError(null);
    try {
      const result = await clockIn(jobId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || "Failed to clock in");
      }
    } catch {
      setError("Failed to clock in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="clk-shell">
      <header className="clk-top">
        <Link href={`/my-jobs/${jobId}`} className="clk-back">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to job
        </Link>
        <div className="clk-job-pill">
          <span className="avatar">{initials}</span>
          <strong>{clientName}</strong>
        </div>
        <div className="clk-top-spacer" aria-hidden="true" />
      </header>

      <main className="clk-body">
        <div className={`clk-status${isLive ? " live" : ""}`}>
          <span className="dot" />
          {isLive && clockInDate
            ? `Clocked in · started ${fmtShort(clockInDate)}`
            : isDone
            ? "Shift complete"
            : startDate && earlyByMs > 0
            ? `Shift starts at ${fmtShort(startDate)}`
            : startDate
            ? `Running late by ${fmtDuration(Math.abs(earlyByMs))}`
            : "Ready to clock in"}
        </div>

        <AnalogClock time={now} />

        <div className="clk-panel">
          <h1 className="clk-greet">
            {isLive ? (
              <>You&apos;re <em>on the clock.</em></>
            ) : isDone ? (
              <>Great <em>work today!</em></>
            ) : (
              <>Ready to <em>clock in?</em></>
            )}
          </h1>
          <p className="clk-sub">
            {isLive
              ? "We're tracking your shift. Tap below when you're done."
              : isDone
              ? "Your shift has been logged. Head back to the job to view the summary."
              : "Tap the button when you arrive on site. Your shift starts the moment you clock in."}
          </p>

          {!isDone ? (
            <button
              className={`clk-action${isLive ? " out" : ""}`}
              onClick={isLive ? () => router.push(`/my-jobs/${jobId}?clockout=1`) : handleClockIn}
              disabled={loading}
            >
              {isLive ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  Clock out
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  {loading ? "Clocking in…" : "Clock in now"}
                </>
              )}
            </button>
          ) : (
            <Link href={`/my-jobs/${jobId}`} className="clk-action">
              View job summary
            </Link>
          )}
          {error && <p className="clk-error">{error}</p>}

          <div className="clk-meta">
            <div className="clk-meta-tile">
              <div className="lbl">Shift starts</div>
              <div className="val">{startDate ? fmtShort(startDate) : "—"}</div>
            </div>
            <div className="clk-meta-tile">
              <div className="lbl">{isLive ? "Worked so far" : "Time until start"}</div>
              <div className="val">
                {isLive
                  ? fmtDuration(elapsedMs)
                  : startDate && earlyByMs > 0
                  ? fmtDuration(earlyByMs)
                  : "—"}
              </div>
            </div>
            <div className="clk-meta-tile">
              <div className="lbl">Total today</div>
              <div className="val">{fmtDuration(elapsedMs)}</div>
            </div>
          </div>
        </div>

        <section className="clk-sessions">
          <div className="clk-sessions-head">
            <h3>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Session log
            </h3>
            <span className="total">TOTAL · {fmtDuration(elapsedMs)}</span>
          </div>

          {isLive && clockInDate ? (
            <div className="clk-session-row active">
              <span className="clk-session-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </span>
              <div className="clk-session-meta">
                <div className="clk-session-time">
                  {fmtClock(clockInDate)} → now <span className="live-dot" />
                </div>
                <div className="clk-session-date">
                  Live · started {clockInDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              <div className="clk-session-dur" style={{ color: "var(--emerald-600)" }}>
                {fmtDuration(elapsedMs)}
              </div>
            </div>
          ) : isDone && clockInDate && clockOutDate ? (
            <div className="clk-session-row">
              <span className="clk-session-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <div className="clk-session-meta">
                <div className="clk-session-time">
                  {fmtClock(clockInDate)} → {fmtClock(clockOutDate)}
                </div>
                <div className="clk-session-date">
                  {clockInDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </div>
              </div>
              <div className="clk-session-dur">{fmtDuration(elapsedMs)}</div>
            </div>
          ) : (
            <div className="clk-sessions-empty">No sessions logged yet. Tap Clock in to start.</div>
          )}
        </section>
      </main>
    </div>
  );
}
