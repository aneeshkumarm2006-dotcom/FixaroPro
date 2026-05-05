"use client";

import { useEffect, useState } from "react";
import { Star, TrendingUp, Award, Clock } from "lucide-react";
import {
  getPerformanceData,
  type PerformanceData,
} from "../../actions/getPerformanceData";
import { SectionCard } from "./_shared";

function StarRow({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-5 h-5 ${
            i < filled
              ? "fill-[#77C8CC] text-[#77C8CC]"
              : "text-[#005F6A]/20"
          }`}
        />
      ))}
    </div>
  );
}

function TrendChart({ data }: { data: PerformanceData["trend90Day"] }) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-[#005F6A]/50 italic">
        No ratings yet in the last 90 days.
      </p>
    );
  }

  const width = 320;
  const height = 80;
  const padX = 8;
  const padY = 12;

  const xs = data.map((_, i) => i);
  const minX = 0;
  const maxX = Math.max(1, xs.length - 1);
  const minY = 1;
  const maxY = 5;

  const scaleX = (i: number) =>
    padX + ((i - minX) / (maxX - minX)) * (width - padX * 2);
  const scaleY = (v: number) =>
    height - padY - ((v - minY) / (maxY - minY)) * (height - padY * 2);

  const path = data
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(p.average)}`)
    .join(" ");

  const last = data[data.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-20 overflow-visible">
        <line
          x1={padX}
          y1={scaleY(4)}
          x2={width - padX}
          y2={scaleY(4)}
          stroke="#005F6A"
          strokeOpacity="0.1"
          strokeDasharray="3 3"
        />
        <path
          d={path}
          fill="none"
          stroke="#005F6A"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((p, i) => (
          <circle
            key={i}
            cx={scaleX(i)}
            cy={scaleY(p.average)}
            r="2.5"
            fill="#005F6A"
          />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-[#005F6A]/50 mt-1">
        <span>{new Date(data[0].date).toLocaleDateString()}</span>
        <span>Latest: {last.average.toFixed(2)}★</span>
      </div>
    </div>
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface PerformanceSectionProps {
  employeeId?: string;
}

export default function PerformanceSection({
  employeeId,
}: PerformanceSectionProps) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await getPerformanceData({ employeeId });
      if (cancelled) return;
      if (res.success) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (loading) {
    return (
      <SectionCard title="Performance" icon={Award}>
        <p className="text-sm text-[#005F6A]/60">Loading performance...</p>
      </SectionCard>
    );
  }

  if (error || !data) {
    return (
      <SectionCard title="Performance" icon={Award}>
        <p className="text-sm text-red-600">
          {error ?? "Could not load performance data."}
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Current Rating"
        description="Average of ratings in the last 30 days."
        icon={Star}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-[#005F6A]/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#005F6A]/50 mb-1">
              30-Day Rating
            </p>
            {data.rating30Day !== null ? (
              <>
                <p className="text-3xl font-[300] text-[#005F6A]">
                  {data.rating30Day.toFixed(2)}
                </p>
                <div className="mt-1">
                  <StarRow value={data.rating30Day} />
                </div>
                <p className="text-xs text-[#005F6A]/60 mt-2">
                  Based on {data.ratingCount30Day} rating
                  {data.ratingCount30Day === 1 ? "" : "s"}
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-[300] text-[#005F6A]/40">—</p>
                <p className="text-xs text-[#005F6A]/60 mt-2">
                  No ratings in the last 30 days
                </p>
              </>
            )}
          </div>

          <div className="rounded-2xl bg-[#005F6A]/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#005F6A]/50 mb-1">
              Pay Multiplier
            </p>
            <p className="text-3xl font-[300] text-[#005F6A]">
              {data.currentMultiplier.toFixed(2)}x
            </p>
            <p className="text-xs text-[#005F6A]/60 mt-2">
              Tier: <span className="font-[500]">{data.tierLabel}</span>
            </p>
            {data.nextTierAt !== null &&
              data.nextTierMultiplier !== null && (
                <p className="text-[11px] text-[#005F6A]/60 mt-1">
                  Reach {data.nextTierAt.toFixed(1)}★ for{" "}
                  {data.nextTierMultiplier.toFixed(2)}x
                </p>
              )}
          </div>

          <div className="rounded-2xl bg-[#005F6A]/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#005F6A]/50 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Rating Window
            </p>
            <p className="text-sm text-[#005F6A] mt-2">
              Ratings count toward your average for 30 days.
            </p>
            {data.expiringSoon > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-2 inline-block">
                {data.expiringSoon} rating
                {data.expiringSoon === 1 ? "" : "s"} expiring soon
              </p>
            )}
            {data.oldestRating30DayAt && (
              <p className="text-[11px] text-[#005F6A]/60 mt-1">
                Oldest active: {formatDate(data.oldestRating30DayAt)}
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="90-Day Trend"
        description="Daily average rating across the last 90 days."
        icon={TrendingUp}>
        <TrendChart data={data.trend90Day} />
      </SectionCard>

      <SectionCard
        title="Recent Ratings"
        description="Last 10 ratings received."
        icon={Star}>
        {data.recentRatings.length === 0 ? (
          <p className="text-sm text-[#005F6A]/60">No recent ratings.</p>
        ) : (
          <div className="space-y-2">
            {data.recentRatings.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-[#005F6A]/5">
                <StarRow value={r.rating} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-[#005F6A] font-[500]">
                      {r.rating.toFixed(1)}★
                    </p>
                    <p className="text-xs text-[#005F6A]/60">
                      {formatDate(r.createdAt)}
                    </p>
                  </div>
                  {r.clientName && (
                    <p className="text-xs text-[#005F6A]/70 mt-0.5">
                      Job for {r.clientName}
                    </p>
                  )}
                  {r.notes && (
                    <p className="text-xs text-[#005F6A]/70 mt-1 italic">
                      “{r.notes}”
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
