"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import SalesAreaModal from "./SalesAreaModal";
import LandingPageManager from "./LandingPageManager";
import CampaignManager from "./CampaignManager";
import {
  MapPin,
  Plus,
  Globe,
  Megaphone,
  Eye,
  DollarSign,
  TrendingUp,
  Pencil,
} from "lucide-react";

// Dynamic import for map (SSR disabled — Leaflet requires browser APIs)
const SalesMapView = dynamic(() => import("./SalesMapView"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] bg-[#e85d04]/5 rounded-xl flex items-center justify-center">
      <p className="text-sm text-[#1c1917]/50">Loading map...</p>
    </div>
  ),
});

type TabView = "map" | "landing-pages" | "campaigns";

const TABS: Array<{ id: TabView; label: string; icon: React.ReactNode }> = [
  { id: "map", label: "Sales Map", icon: <MapPin className="w-4 h-4" /> },
  {
    id: "landing-pages",
    label: "Landing Pages",
    icon: <Globe className="w-4 h-4" />,
  },
  {
    id: "campaigns",
    label: "Campaigns",
    icon: <Megaphone className="w-4 h-4" />,
  },
];

const TYPE_LABELS: Record<string, string> = {
  DOOR_KNOCK: "Door Knock",
  FLYER_DROP: "Flyer Drop",
  REFERRAL: "Referral",
  ONLINE_AD: "Online Ad",
  SOCIAL_MEDIA: "Social Media",
  OTHER: "Other",
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

export default function SalesPageClient({
  salesAreas,
  landingPages,
  campaigns,
  stats,
}: SalesPageClientProps) {
  const [activeTab, setActiveTab] = useState<TabView>("map");
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [editingArea, setEditingArea] = useState<SalesArea | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl !font-light tracking-tight text-[#1c1917]">
            Sales & Marketing
          </h1>
          <p className="text-sm text-[#1c1917]/70 mt-1">
            Manage sales areas, landing pages, and marketing campaigns
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card variant="default" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e85d04]/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-[#1c1917]" />
            </div>
            <div>
              <p className="text-lg font-[400] text-[#1c1917]">
                {stats.totalAreas}
              </p>
              <p className="text-xs text-[#1c1917]/50">Sales Areas</p>
            </div>
          </div>
        </Card>
        <Card variant="default" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e85d04]/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-[#1c1917]" />
            </div>
            <div>
              <p className="text-lg font-[400] text-[#1c1917]">
                {stats.totalVisits}
              </p>
              <p className="text-xs text-[#1c1917]/50">Page Visits</p>
            </div>
          </div>
        </Card>
        <Card variant="default" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e85d04]/10 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-[#1c1917]" />
            </div>
            <div>
              <p className="text-lg font-[400] text-[#1c1917]">
                {stats.activeCampaigns}
              </p>
              <p className="text-xs text-[#1c1917]/50">Active Campaigns</p>
            </div>
          </div>
        </Card>
        <Card variant="default" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e85d04]/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#1c1917]" />
            </div>
            <div>
              <p className="text-lg font-[400] text-[#1c1917]">
                ${stats.totalSpent.toFixed(0)}
              </p>
              <p className="text-xs text-[#1c1917]/50">
                of ${stats.totalBudget.toFixed(0)} budget
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-[#e85d04]/5 rounded-2xl p-1 w-fit">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              border={false}
              onClick={() => setActiveTab(tab.id)}
              variant={isActive ? "action" : "ghost"}
              size="md"
              className="rounded-xl px-4 md:px-5 py-3 whitespace-nowrap">
              <span className="mr-2 hidden sm:inline">{tab.icon}</span>
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "map" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-[400] text-[#1c1917]">
                  Sales Areas Map
                </h3>
                <p className="text-xs text-[#1c1917]/50 mt-0.5">
                  Color-coded pins showing sales activity across areas
                </p>
              </div>
              <Button
                variant="action"
                size="sm"
                onClick={() => {
                  setEditingArea(null);
                  setShowAreaModal(true);
                }}>
                <Plus className="w-4 h-4 mr-1" />
                Add Pin
              </Button>
            </div>

            <Card variant="default" className="overflow-hidden">
              <SalesMapView
                salesAreas={salesAreas}
                onPinClick={(area) => {
                  setEditingArea(area);
                  setShowAreaModal(true);
                }}
              />
            </Card>

            {/* Area List */}
            {salesAreas.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-[400] text-[#1c1917]/60 uppercase tracking-wider">
                  All Areas ({salesAreas.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {salesAreas.map((area) => (
                    <Card
                      key={area.id}
                      variant="default"
                      className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => {
                        setEditingArea(area);
                        setShowAreaModal(true);
                      }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-[400] text-[#1c1917] truncate">
                              {area.name}
                            </p>
                            <Badge variant="secondary" size="sm">
                              {TYPE_LABELS[area.type] || area.type}
                            </Badge>
                          </div>
                          {area.address && (
                            <p className="text-xs text-[#1c1917]/40 mt-1 truncate">
                              {area.address}
                            </p>
                          )}
                          <p className="text-xs text-[#1c1917]/40 mt-0.5">
                            {new Date(area.date).toLocaleDateString("en-US")}
                          </p>
                        </div>
                        <Pencil className="w-3.5 h-3.5 text-[#1c1917]/30 flex-shrink-0 mt-0.5" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "landing-pages" && (
          <LandingPageManager landingPages={landingPages} campaigns={campaigns} />
        )}

        {activeTab === "campaigns" && (
          <CampaignManager campaigns={campaigns} />
        )}
      </div>

      {/* Sales Area Modal */}
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
