"use client";

// Web bookings — Cleano "Web bookings" card design, re-skinned to the Fixaro
// charcoal/orange palette (A). Jobs that came through the public /book funnel.

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, MapPin, Sparkles, Globe, UserPlus, Clock, AlertCircle } from "lucide-react";
import { StatusPill } from "@/lib/status-icons";

interface WebJob {
  id: string;
  jobNumber: number;
  status: string;
  isFlexible: boolean;
  startTime: string;
  location: string | null;
  jobType: string | null;
  price: number | null;
  requiredCleaners: number;
  parentJobId: string | null;
  cancellationRequestedAt: string | null;
  rescheduleRequestedAt: string | null;
  client: { id: string; name: string; email: string | null; phone: string | null } | null;
  cleaners: { id: string; name: string }[];
  addOns: { name: string; price: number }[];
  createdAt: string;
}

type Filter = "all" | "cleaner" | "flexible" | "attention";

const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-CA");
const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

function needsCleaner(j: WebJob) {
  return j.cleaners.length < j.requiredCleaners && j.status !== "CANCELLED" && j.status !== "COMPLETED" && j.status !== "PAID";
}
function hasRequest(j: WebJob) {
  return !!j.cancellationRequestedAt || !!j.rescheduleRequestedAt;
}

function AvatarStack({ names }: { names: string[] }) {
  const shown = names.slice(0, 3);
  const more = names.length - shown.length;
  if (names.length === 0) return <span style={{ fontSize: 12, color: "var(--primary-50)" }}>Unassigned</span>;
  return (
    <span className="wb-avstack">
      {shown.map((n, i) => <span key={i} className="wb-av">{initials(n)}</span>)}
      {more > 0 && <span className="wb-av more">+{more}</span>}
    </span>
  );
}

function FilterStat({ icon: Icon, label, value, hint, amber, active, onClick }: {
  icon: React.ElementType; label: string; value: number; hint: string; amber?: boolean; active: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`wb-stat ${active ? "active" : ""} ${amber ? "amber" : ""}`}>
      <div className="astat-head">
        <span>{label}</span>
        <span className="astat-icon" style={amber ? { background: "#fef3c7", color: "var(--amber-700)" } : undefined}><Icon size={16} /></span>
      </div>
      <div className="astat-value" style={amber ? { color: "var(--amber-800)" } : undefined}>{value}</div>
      <div className="astat-delta">{active ? "Showing" : hint}</div>
    </button>
  );
}

export default function WebBookingsPageClient({ jobs }: { jobs: WebJob[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = {
    all: jobs.length,
    cleaner: jobs.filter(needsCleaner).length,
    flexible: jobs.filter((j) => j.isFlexible && j.status !== "CANCELLED").length,
    attention: jobs.filter((j) => needsCleaner(j) || hasRequest(j)).length,
  };

  const visible = useMemo(() => {
    if (filter === "cleaner") return jobs.filter(needsCleaner);
    if (filter === "flexible") return jobs.filter((j) => j.isFlexible && j.status !== "CANCELLED");
    if (filter === "attention") return jobs.filter((j) => needsCleaner(j) || hasRequest(j));
    return jobs;
  }, [jobs, filter]);

  return (
    <div className="admin-font">
      <header style={{ marginBottom: 24 }}>
        <p className="eyebrow">Operations</p>
        <h1 className="display" style={{ fontSize: "clamp(32px, 4.2vw, 46px)", marginTop: 6 }}>
          Web <em>bookings.</em> <span style={{ color: "var(--primary-40)", fontWeight: 300, fontFamily: "var(--font-serif)" }}>· {counts.all}</span>
        </h1>
        <p className="subtitle" style={{ marginTop: 10, fontSize: 15.5 }}>Jobs booked through the public booking funnel. Assign cleaners and handle change requests.</p>
      </header>

      <div className="astat-grid" style={{ marginBottom: 26 }}>
        <FilterStat icon={Globe} label="Total" value={counts.all} hint="from /book" active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterStat icon={UserPlus} label="Needs cleaner" value={counts.cleaner} hint="understaffed" amber={counts.cleaner > 0} active={filter === "cleaner"} onClick={() => setFilter("cleaner")} />
        <FilterStat icon={Clock} label="Flexible time" value={counts.flexible} hint="time TBD" active={filter === "flexible"} onClick={() => setFilter("flexible")} />
        <FilterStat icon={AlertCircle} label="Needs attention" value={counts.attention} hint="action required" amber={counts.attention > 0} active={filter === "attention"} onClick={() => setFilter("attention")} />
      </div>

      {visible.length === 0 ? (
        <div className="dcard" style={{ padding: 56, textAlign: "center", color: "var(--primary-60)" }}>No web bookings in this view.</div>
      ) : (
        <div className="wb-grid">
          {visible.map((j) => {
            const short = needsCleaner(j);
            const startStr = new Date(j.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
            const reqKind = j.cancellationRequestedAt ? "cancellation" : j.rescheduleRequestedAt ? "reschedule" : null;
            return (
              <article key={j.id} className="wb-card">
                <div className="wb-top">
                  <div className="wb-jobno">
                    Job #{j.jobNumber}
                    {j.parentJobId && <span className="wb-tag recurring">Recurring</span>}
                    {j.isFlexible && <span className="wb-tag flexible">Flexible</span>}
                  </div>
                  <StatusPill status={j.status} />
                </div>

                <div className="wb-rows">
                  <div className="wb-row"><span className="wb-ic"><CalendarClock size={15} /></span><span>{j.isFlexible ? `${new Date(j.startTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · time TBD` : startStr}</span></div>
                  {j.location && <div className="wb-row"><span className="wb-ic"><MapPin size={15} /></span><span>{j.location}</span></div>}
                  {j.client && <div className="wb-row"><span className="wb-ic"><Sparkles size={15} /></span><span className="wb-client">{j.client.name}</span></div>}
                </div>

                <div className="wb-meta">
                  {j.jobType ? <span className="pill" style={{ background: "var(--primary-5)", color: "var(--primary)" }}>{j.jobType}</span> : <span />}
                  <div className={`wb-staff ${short ? "short" : ""}`}>
                    <AvatarStack names={j.cleaners.map((c) => c.name)} />
                    <span className="wb-staff-count">{j.cleaners.length}/{j.requiredCleaners}</span>
                  </div>
                </div>

                {(short || reqKind) && (
                  <div className="wb-pills">
                    {short && <span className="wb-pill needs">Needs assignment</span>}
                    {reqKind && (
                      <Link href="/requests" className={`wb-pill req ${reqKind}`}>
                        {reqKind === "cancellation" ? "Cancel requested" : "Reschedule requested"} →
                      </Link>
                    )}
                  </div>
                )}

                <div className="wb-foot">
                  <div className="wb-price">{money(j.price || 0)}</div>
                  <Link href={`/jobs/${j.id}`} className="btn btn-primary btn-sm">Open &amp; assign →</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
