"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import SalesAreaModal from "./SalesAreaModal";
import LandingPageManager from "./LandingPageManager";
import CampaignManager from "./CampaignManager";
import {
  MapPin,
  Plus,
  Sparkles,
  CalendarClock,
  CreditCard,
} from "lucide-react";

// Dynamic import for map (SSR disabled — Leaflet requires browser APIs)
const SalesMapView = dynamic(() => import("./SalesMapView"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "#eef2f3" }}>
      <p style={{ fontSize: 13, color: "var(--primary-50)" }}>Loading map…</p>
    </div>
  ),
});

type TabView = "map" | "landing-pages" | "campaigns";

// Area-type meta — labels + colors mirror SalesMapView's pin palette so the
// legend and map agree. (Fixaro's SalesAreaType describes acquisition method.)
const AREA_META: Record<string, { label: string; color: string }> = {
  DOOR_KNOCK: { label: "Door knock", color: "#e85d04" },
  FLYER_DROP: { label: "Flyer drop", color: "#0EA5E9" },
  REFERRAL: { label: "Referral", color: "#10B981" },
  ONLINE_AD: { label: "Online ad", color: "#8B5CF6" },
  SOCIAL_MEDIA: { label: "Social media", color: "#F59E0B" },
  OTHER: { label: "Other", color: "#6B7280" },
};

interface SalesArea {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  address: string | null;
  notes: string | null;
  date: string;
  createdAt: string;
}

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  ctaText: string;
  ctaLink: string;
  isPublished: boolean;
  campaignId: string | null;
  campaignName: string | null;
  totalVisits: number;
  recentVisits: number;
  createdAt: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  budget: number;
  spent: number;
  startDate: string | null;
  endDate: string | null;
  channel: string | null;
  notes: string | null;
  landingPageCount: number;
  createdAt: string;
}

interface Stats {
  totalAreas: number;
  totalPages: number;
  publishedPages: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalBudget: number;
  totalSpent: number;
  totalVisits: number;
}

interface SalesPageClientProps {
  salesAreas: SalesArea[];
  landingPages: LandingPage[];
  campaigns: Campaign[];
  stats: Stats;
}

function AStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="astat">
      <div className="astat-head">
        <span>{label}</span>
        <span className="astat-icon"><Icon size={15} /></span>
      </div>
      <div className="astat-value">{value}</div>
      {hint && <div className="astat-delta">{hint}</div>}
    </div>
  );
}

export default function SalesPageClient({
  salesAreas,
  landingPages,
  campaigns,
  stats,
}: SalesPageClientProps) {
  const [activeTab, setActiveTab] = useState<TabView>("map");
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [editingArea, setEditingArea] = useState<SalesArea | null>(null);

  const visits30 = useMemo(
    () => landingPages.reduce((sum, lp) => sum + (lp.recentVisits || 0), 0),
    [landingPages]
  );
  const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

  const TABS: { id: TabView; label: string; count?: number }[] = [
    { id: "map", label: "Sales map" },
    { id: "landing-pages", label: "Landing pages", count: landingPages.length },
    { id: "campaigns", label: "Campaigns", count: campaigns.length },
  ];

  return (
    <div className="admin-font stack-24">
      <SalesStyles />

      <header>
        <p className="eyebrow">Marketing</p>
        <h1 className="display" style={{ fontSize: "clamp(32px, 4.2vw, 46px)", marginTop: 6 }}>
          Sales &amp; <em>marketing.</em>
        </h1>
        <p className="subtitle" style={{ marginTop: 10, fontSize: 15.5 }}>
          Service zones, landing pages, and campaign performance in one place.
        </p>
      </header>

      <div className="astat-grid">
        <AStat icon={MapPin} label="Service areas" value={stats.totalAreas} hint="zones mapped" />
        <AStat icon={Sparkles} label="Page visits" value={visits30.toLocaleString()} hint="last 30 days" />
        <AStat icon={CalendarClock} label="Active campaigns" value={stats.activeCampaigns} hint="running now" />
        <AStat icon={CreditCard} label="Budget spent" value={money(stats.totalSpent)} hint="across campaigns" />
      </div>

      <div className="atabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`atab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
            {t.count != null && t.count > 0 && <span className="atab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 4 }}>
        {activeTab === "map" && (
          <div>
            <div className="sl-map-bar">
              <div className="sl-legend">
                {Object.entries(AREA_META).map(([k, v]) => (
                  <span key={k} className="sl-legend-item">
                    <span className="sl-legend-dot" style={{ background: v.color }} />
                    {v.label}
                  </span>
                ))}
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingArea(null);
                  setShowAreaModal(true);
                }}>
                <Plus size={14} /> New area
              </button>
            </div>

            <div className="sl-map-wrap">
              <SalesMapView
                salesAreas={salesAreas}
                onPinClick={(area) => {
                  setEditingArea(area);
                  setShowAreaModal(true);
                }}
              />
            </div>

            {salesAreas.length > 0 && (
              <div className="sl-area-grid">
                {salesAreas.map((area) => {
                  const v = AREA_META[area.type] ?? AREA_META.OTHER;
                  return (
                    <button
                      key={area.id}
                      className="jcard sl-area-card"
                      onClick={() => {
                        setEditingArea(area);
                        setShowAreaModal(true);
                      }}>
                      <div className="sl-area-top">
                        <span className="jcard-client">{area.name}</span>
                        <span
                          className="pill"
                          style={{ background: "transparent", color: v.color, boxShadow: `inset 0 0 0 1px ${v.color}55` }}>
                          <span className="pill-dot" style={{ background: v.color }} />
                          {v.label}
                        </span>
                      </div>
                      {area.address && (
                        <div className="sl-area-addr"><MapPin size={13} /> {area.address}</div>
                      )}
                      {area.notes && <div className="sl-area-notes">{area.notes}</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "landing-pages" && (
          <LandingPageManager landingPages={landingPages} campaigns={campaigns} />
        )}

        {activeTab === "campaigns" && <CampaignManager campaigns={campaigns} />}
      </div>

      <SalesAreaModal
        isOpen={showAreaModal}
        onClose={() => {
          setShowAreaModal(false);
          setEditingArea(null);
        }}
        editingArea={editingArea}
      />
    </div>
  );
}

function SalesStyles() {
  return (
    <style>{`
    .sl-map-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
    .sl-legend { display: flex; flex-wrap: wrap; gap: 14px; }
    .sl-legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--primary-70); }
    .sl-legend-dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 2px #fff, 0 1px 3px rgba(0,0,0,0.2); }
    .sl-map-wrap { border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-soft); border: 1px solid var(--primary-10); }

    .sl-area-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 18px; }
    .sl-area-card { display: flex; flex-direction: column; gap: 8px; align-items: stretch; text-align: left; cursor: pointer; padding: 16px; }
    .sl-area-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .sl-area-addr { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--primary-60); }
    .sl-area-notes { font-size: 12.5px; color: var(--primary-70); line-height: 1.45; }

    .sl-tab-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
    .sl-tab-hint { font-size: 13px; color: var(--primary-60); }
    .sl-card-list { display: flex; flex-direction: column; gap: 12px; }

    .sl-lp { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 16px; }
    .sl-lp-main { flex: 1; min-width: 0; }
    .sl-lp-toprow, .sl-camp-toprow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .sl-lp-title { margin: 0; font-size: 15.5px; font-weight: 600; color: var(--ink); }
    .sl-lp-meta { display: flex; gap: 16px; margin-top: 7px; font-size: 13px; color: var(--primary-60); flex-wrap: wrap; }
    .sl-lp-slug { font-family: var(--font-mono); font-size: 12px; color: var(--primary); background: var(--primary-5); padding: 2px 8px; border-radius: 6px; }
    .sl-lp-visits strong { color: var(--ink); }
    .sl-lp-actions, .sl-camp-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }

    .sl-camp { display: flex; flex-direction: column; gap: 16px; }
    .sl-camp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .sl-camp-meta { font-size: 12.5px; color: var(--primary-60); margin-top: 6px; }
    .sl-budget-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--ink); font-weight: 500; margin-bottom: 7px; }
    .sl-budget-track { height: 7px; border-radius: 99px; background: var(--primary-10); overflow: hidden; }
    .sl-budget-fill { height: 100%; border-radius: 99px; }
    `}</style>
  );
}
