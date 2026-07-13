"use client";

// Analytics — Cleano "Analytics & reports" design, re-skinned to the Fixaro
// charcoal/orange palette (A). 10 dense tabs + a dark Labour-cost-% hero widget.
// Wired to the existing AnalyticsViewProps (no page.tsx changes).

import React, { useState } from "react";
import {
  BarChart3, Activity, PieChart, DollarSign, Target, Package, Users, Bell,
  Megaphone, CreditCard, Sparkles, CalendarClock, AlertCircle,
  Pencil, X, type LucideIcon,
} from "lucide-react";
import { createTarget } from "@/app/(app)/actions/createTarget";
import { updateTarget } from "@/app/(app)/actions/updateTarget";
import { deleteTarget } from "@/app/(app)/actions/deleteTarget";
import { markAlertRead, dismissAlert } from "@/app/(app)/actions/createAlert";
import DatePicker from "@/components/ui/DatePicker";
import PremiumSelect from "@/components/ui/PremiumSelect";

// Dark-hero theming for the Fixaro DatePicker / PremiumSelect triggers.
const FILTER_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#fff",
  minWidth: 150,
};

/* ───────────────────────── formatting ───────────────────────── */
const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-CA");
const hrs = (n: number) => (n || 0).toLocaleString("en-CA", { maximumFractionDigits: 1 }) + "h";
const moneyShort = (n: number) =>
  Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k` : `$${Math.round(n || 0)}`;

/* ───────────────────────── charts (SVG, palette A) ───────────────────────── */
const PALETTE = ["#e85d04", "#7c3aed", "#0284c7", "#059669", "#d97706", "#be185d", "#0d9488", "#9333ea"];
const GRID = "rgba(28,25,23,0.09)";
const AXIS = "rgba(28,25,23,0.5)";
const ACCENT = "#e85d04";

function niceMax(v: number) {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

type Pt = { label: string; value: number; color?: string };

function LineChart({ data, height = 220, color = ACCENT, area = true, fmt = money, yTicks = 4 }: {
  data: Pt[]; height?: number; color?: string; area?: boolean; fmt?: (v: number) => string | number; yTicks?: number;
}) {
  const W = 760, H = height, padL = 56, padR = 16, padT = 18, padB = 34;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const n = data.length;
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const areaPts = `${padL},${padT + innerH} ${pts} ${padL + innerW},${padT + innerH}`;
  const gid = "lg" + color.replace("#", "");
  const ticks = Array.from({ length: yTicks + 1 }, (_, t) => (max / yTicks) * t);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }} preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t, i) => (
        <g key={i}><line x1={padL} y1={y(t)} x2={padL + innerW} y2={y(t)} stroke={GRID} strokeWidth="1" /><text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill={AXIS}>{fmt(t)}</text></g>
      ))}
      {area && <polygon points={areaPts} fill={`url(#${gid})`} />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />)}
      {data.map((d, i) => <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fontSize="11" fill={AXIS}>{d.label}</text>)}
    </svg>
  );
}

function Bars({ data, height = 220, fmt = money, color = ACCENT }: { data: Pt[]; height?: number; fmt?: (v: number) => string | number; color?: string }) {
  const W = 760, H = height, padL = 56, padR = 16, padT = 18, padB = 34;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const n = Math.max(1, data.length), slot = innerW / n, bw = Math.min(54, slot * 0.6);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }} preserveAspectRatio="xMidYMid meet">
      {ticks.map((t, i) => (
        <g key={i}><line x1={padL} y1={y(t)} x2={padL + innerW} y2={y(t)} stroke={GRID} strokeWidth="1" /><text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill={AXIS}>{fmt(t)}</text></g>
      ))}
      {data.map((d, i) => {
        const cx = padL + slot * i + slot / 2, h = (d.value / max) * innerH;
        return <g key={i}><rect x={cx - bw / 2} y={padT + innerH - h} width={bw} height={Math.max(0, h)} rx="6" fill={d.color || color} /><text x={cx} y={H - 12} textAnchor="middle" fontSize="11" fill={AXIS}>{d.label}</text></g>;
      })}
    </svg>
  );
}

type Series = { key: string; label: string; color: string };
function GroupedBars({ groups, series, height = 240, fmt = money }: {
  groups: Array<Record<string, string | number>>; series: Series[]; height?: number; fmt?: (v: number) => string | number;
}) {
  const W = 760, H = height, padL = 56, padR = 16, padT = 18, padB = 44;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const allVals = groups.flatMap((g) => series.map((s) => Number(g[s.key]) || 0));
  const max = niceMax(Math.max(1, ...allVals));
  const n = Math.max(1, groups.length), slot = innerW / n, groupW = slot * 0.64, bw = groupW / series.length;
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }} preserveAspectRatio="xMidYMid meet">
        {ticks.map((t, i) => (
          <g key={i}><line x1={padL} y1={y(t)} x2={padL + innerW} y2={y(t)} stroke={GRID} strokeWidth="1" /><text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill={AXIS}>{fmt(t)}</text></g>
        ))}
        {groups.map((g, gi) => {
          const gx = padL + slot * gi + (slot - groupW) / 2;
          return (
            <g key={gi}>
              {series.map((s, si) => {
                const v = Number(g[s.key]) || 0, h = (v / max) * innerH;
                return <rect key={si} x={gx + bw * si} y={padT + innerH - h} width={bw - 4} height={Math.max(0, h)} rx="5" fill={s.color} />;
              })}
              <text x={padL + slot * gi + slot / 2} y={H - 22} textAnchor="middle" fontSize="11" fill={AXIS}>{String(g.label)}</text>
            </g>
          );
        })}
      </svg>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
    </div>
  );
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", marginTop: 10 }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--primary-70)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color }} />{it.label}
        </span>
      ))}
    </div>
  );
}

function Ring({ value, max = 100, label, sublabel, color = ACCENT, size = 150 }: {
  value: number; max?: number; label?: string; sublabel?: string; color?: string; size?: number;
}) {
  const stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max)), cx = size / 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--primary-10)" strokeWidth={stroke} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${cx} ${cx})`} />
        <text x={cx} y={cx - 2} textAnchor="middle" fontSize={size * 0.2} fontFamily="var(--font-serif)" fill="var(--ink)">{Math.round(pct * 100)}%</text>
        {sublabel && <text x={cx} y={cx + size * 0.16} textAnchor="middle" fontSize="11" fill="var(--primary-60)">{sublabel}</text>}
      </svg>
      {label && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{label}</div>}
    </div>
  );
}

function Donut({ data, size = 180, fmt = money }: { data: Pt[]; size?: number; fmt?: (v: number) => string | number }) {
  const stroke = 26, r = (size - stroke) / 2, c = 2 * Math.PI * r, cx = size / 2;
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  let offset = 0;
  const segs = data.map((d, i) => {
    const frac = d.value / total;
    const seg = { ...d, color: d.color || PALETTE[i % PALETTE.length], dash: c * frac, gap: c * (1 - frac), rot: (offset / total) * 360 };
    offset += d.value;
    return seg;
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segs.map((s, i) => <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${s.dash} ${s.gap}`} transform={`rotate(${s.rot - 90} ${cx} ${cx})`} />)}
        <text x={cx} y={cx - 2} textAnchor="middle" fontSize={size * 0.16} fontFamily="var(--font-serif)" fill="var(--ink)">{fmt(total)}</text>
        <text x={cx} y={cx + size * 0.13} textAnchor="middle" fontSize="11" fill="var(--primary-60)">total</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 160 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ink-soft)" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />{s.label}</span>
            <span style={{ fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{fmt(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ value, max = 100, color = ACCENT, height = 8 }: { value: number; max?: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return <div style={{ background: "var(--primary-10)", borderRadius: 999, height, overflow: "hidden", width: "100%" }}><div style={{ width: `${pct * 100}%`, height: "100%", background: color, borderRadius: 999, transition: "width .4s" }} /></div>;
}

/* ───────────────────────── primitives ───────────────────────── */
function Panel({ title, sub, action, children, style }: { title?: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="dcard" style={{ gap: 18, ...style }}>
      {(title || action) && (
        <div className="dcard-head" style={{ alignItems: "flex-start" }}>
          <div>{title && <h3>{title}</h3>}{sub && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--primary-60)" }}>{sub}</p>}</div>
          {action || null}
        </div>
      )}
      {children}
    </div>
  );
}
function MiniTile({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="an-tile">
      <div className="an-tile-label">{label}</div>
      <div className="an-tile-value" style={accent ? { color: accent } : undefined}>{value}</div>
      {hint && <div className="an-tile-hint">{hint}</div>}
    </div>
  );
}
function AStat({ icon: Icon, label, value, delta, deltaDir, hint }: { icon?: LucideIcon; label: string; value: string | number; delta?: string; deltaDir?: "up" | "down"; hint?: string }) {
  return (
    <div className="astat">
      <div className="astat-head"><span>{label}</span>{Icon && <span className="astat-icon"><Icon size={15} /></span>}</div>
      <div className="astat-value">{value}</div>
      {(delta || hint) && <div className={`astat-delta ${deltaDir ?? ""}`}>{delta && <strong>{delta}</strong>}{hint && <> {hint}</>}</div>}
    </div>
  );
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    paid: { label: "Paid", bg: "#d1fae5", color: "#065f46", dot: "#059669" },
    pending: { label: "Pending", bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
    scheduled: { label: "Scheduled", bg: "#dbeafe", color: "#1e40af", dot: "#3b82f6" },
  };
  const c = map[status] || { label: status, bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" };
  return <span className="pill" style={{ background: c.bg, color: c.color }}><span className="pill-dot" style={{ background: c.dot }} />{c.label}</span>;
}
const AV_COLORS = ["#e85d04", "#0284c7", "#7c3aed", "#dc2626", "#d97706", "#059669", "#0891b2", "#be185d"];
function avColor(name: string) { return AV_COLORS[(name.charCodeAt(0) || 0) % AV_COLORS.length]; }
function initials(name: string) { return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?"; }
function Avatar({ name, color }: { name: string; color?: string }) {
  return <span style={{ width: 32, height: 32, borderRadius: "50%", background: color || avColor(name), color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flex: "0 0 auto" }}>{initials(name)}</span>;
}

/* ───────────────────────── props ───────────────────────── */
interface JobStats { total: number; completed: number; inProgress: number; scheduled: number; cancelled: number; avgDuration: number; completionRate: number; }
interface RevenueStats { totalRevenue: number; monthlyRevenue: number; weeklyRevenue: number; avgJobPrice: number; totalEmployeePay: number; totalTips: number; totalParking: number; totalProductCost: number; netProfit: number; profitMargin: number; pendingPayments: number; pendingAmount: number; materialsRevenue: number; depositsOutstanding: number; depositsApplied: number; depositsRefunded: number; }
interface InventoryStats { totalProducts: number; totalValue: number; lowStockCount: number; totalUsageCost: number; avgUsagePerJob: number; inCirculationValue: number; }
interface LabourStats { labourRate: number; clockedJobCount: number; totalClockedHours: number; avgClockedHours: number; totalBillableHours: number; totalLabourRevenue: number; }
interface EmployeeStats { totalEmployees: number; admins: number; activeNow: number; avgJobsPerEmployee: number; topPerformer: string | null; }
interface ProductUsage { id: string; name: string; unit: string; totalUsed: number; usageCount: number; totalCost: number; stockLevel: number; minStock: number; }
interface EmployeePerformance { id: string; name: string; totalJobs: number; completedJobs: number; totalRevenue: number; totalPaid: number; avgJobPrice: number; completionRate: number; avgTimePerJob: number; currentRating: number; ratingsCount: number; complaints: number; clockedHours: number; billableHours: number; labourRevenue: number; }
interface LowStockProduct { id: string; name: string; stockLevel: number; minStock: number; unit: string; }
interface JobTypeBreakdown { type: string; count: number; revenue: number; }
interface MonthlyData { month: string; revenue: number; jobs: number; expenses: number; net: number; profit: number; labourHours: number; labourRevenue: number; period: string; }
interface PaymentJob { id: string; employeeId: string; employeeName: string; employeePay: number; status: string; startTime: string; endTime: string | null; createdAt: string; totalWorkers: number; }
interface BudgetVsActual { id: string; category: string; period: string; budgetAmount: number; actualAmount: number; variance: number; percentUsed: number; }
interface TargetWithActual { id: string; metric: string; period: string; periodStart: string; targetValue: number; actual: number; variance: number; progress: number; notes: string | null; }
interface AlertItem { id: string; type: string; severity: string; title: string; message: string; isRead: boolean; relatedId: string | null; relatedType: string | null; createdAt: string; }
interface MarketingCampaignData { id: string; name: string; status: string; budget: number; spent: number; channel: string | null; startDate: string | null; endDate: string | null; landingPageCount: number; }
interface MarketingLandingPageData { id: string; title: string; slug: string; isPublished: boolean; campaignName: string | null; totalVisits: number; }
interface MarketingData { campaigns: MarketingCampaignData[]; landingPages: MarketingLandingPageData[]; totalPageVisits: number; activeCampaigns: number; publishedPages: number; totalBudget: number; totalSpent: number; }

interface AnalyticsViewProps {
  jobStats: JobStats; revenueStats: RevenueStats; labourStats: LabourStats; inventoryStats: InventoryStats; employeeStats: EmployeeStats;
  productUsage: ProductUsage[]; employeePerformance: EmployeePerformance[]; lowStockProducts: LowStockProduct[];
  jobTypeBreakdown: JobTypeBreakdown[]; monthlyData: MonthlyData[];
  recentJobs: Array<{ id: string; clientName: string; status: string; price: number | null; date: string; employeeName: string }>;
  paymentJobs: PaymentJob[]; budgetVsActuals: BudgetVsActual[]; targetsWithActuals: TargetWithActual[]; alerts: AlertItem[];
  supplierComparisonData: Array<Record<string, string | number>>; supplierNames: string[];
  inventoryValueData: Array<{ name: string; warehouse: number; inCirculation: number }>;
  marketingData?: MarketingData; ratingTrendData: Array<Record<string, string | number>>; ratingTrendEmployeeNames: string[];
}

type TabView = "overview" | "kpis" | "graphs" | "budget" | "targets" | "inventory" | "employees" | "payments" | "alerts" | "marketing";
const TABS: Array<{ id: TabView; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "kpis", label: "KPIs", icon: Activity },
  { id: "graphs", label: "Graphs", icon: PieChart },
  { id: "budget", label: "Budget vs Actuals", icon: DollarSign },
  { id: "targets", label: "Targets vs Actuals", icon: Target },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "employees", label: "Employees", icon: Users },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "marketing", label: "Marketing", icon: Megaphone },
];
const METRIC_LABEL: Record<string, string> = {
  REVENUE: "Revenue", JOBS_COMPLETED: "Jobs Completed", NEW_CLIENTS: "New Clients",
  PROFIT_MARGIN: "Profit Margin (%)", AVG_JOB_PRICE: "Avg Job Price", EMPLOYEE_RETENTION: "Employee Count",
};

export default function AnalyticsView(props: AnalyticsViewProps) {
  const {
    jobStats, revenueStats, labourStats, inventoryStats, employeeStats, productUsage, employeePerformance,
    lowStockProducts, jobTypeBreakdown, monthlyData, paymentJobs, budgetVsActuals,
    targetsWithActuals, alerts, supplierComparisonData, supplierNames, inventoryValueData,
    marketingData, ratingTrendData, ratingTrendEmployeeNames,
  } = props;
  const [tab, setTab] = useState<TabView>("overview");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [svcFilter, setSvcFilter] = useState("all");
  const [cleanerFilter, setCleanerFilter] = useState("all");

  // Labour widget
  const R = revenueStats;
  const labourPct = R.totalRevenue > 0 ? Math.round((R.totalEmployeePay / R.totalRevenue) * 100) : 0;
  const pctColor = labourPct <= 45 ? "var(--emerald-600)" : labourPct <= 55 ? "var(--amber-700)" : "var(--error)";
  const labourTiles = [
    { label: "Service revenue", value: money(R.totalRevenue) },
    { label: "Cleaner payout", value: money(R.totalEmployeePay) },
    { label: "Tips", value: money(R.totalTips) },
    { label: "Transportation", value: money(R.totalParking) },
    { label: "Product cost", value: money(R.totalProductCost) },
    { label: "Net profit", value: money(R.netProfit) },
  ];

  return (
    <div className="admin-font" style={{ padding: 32 }}>
      <header style={{ marginBottom: 24 }}>
        <p className="eyebrow">Insights · Owner</p>
        <h1 className="display" style={{ fontSize: "clamp(32px, 4.2vw, 46px)", marginTop: 6 }}>Analytics &amp; <em>reports.</em></h1>
        <p className="subtitle" style={{ marginTop: 10, fontSize: 15.5 }}>Comprehensive insights into revenue, labour, inventory and growth.</p>
      </header>

      {/* Labour cost hero */}
      <div className="an-labour">
        <div className="an-labour-top">
          <div className="an-labour-head">
            <p className="eyebrow" style={{ color: "rgba(255,255,255,0.6)" }}>Labour cost %</p>
            <div className="an-labour-pct" style={{ color: pctColor }}>{labourPct}%</div>
            <div className="an-labour-cap">Cleaner payout ÷ service revenue · {money(R.totalEmployeePay)} of {money(R.totalRevenue)}</div>
          </div>
          <div className="an-filters">
            <label>From<DatePicker value={fromDate} onChange={setFromDate} size="sm" placeholder="Any" style={FILTER_STYLE} /></label>
            <label>To<DatePicker value={toDate} onChange={setToDate} size="sm" placeholder="Any" style={FILTER_STYLE} /></label>
            <label>Service<PremiumSelect value={svcFilter} onChange={setSvcFilter} size="sm" style={FILTER_STYLE} options={[{ value: "all", label: "All types" }, ...jobTypeBreakdown.map((t) => ({ value: t.type, label: t.type }))]} /></label>
            <label>Cleaner<PremiumSelect value={cleanerFilter} onChange={setCleanerFilter} size="sm" style={FILTER_STYLE} options={[{ value: "all", label: "All cleaners" }, ...employeePerformance.map((e) => ({ value: e.id, label: e.name }))]} /></label>
          </div>
        </div>
        <div className="an-labour-tiles">
          {labourTiles.map((b, i) => (
            <div key={i} className="an-labour-tile"><div className="an-labour-tile-label">{b.label}</div><div className="an-labour-tile-value">{b.value}</div></div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="an-tabs" style={{ margin: "24px 0 22px" }}>
        {TABS.map((t) => { const Ic = t.icon; return (
          <button key={t.id} className={`an-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}><Ic /> {t.label}</button>
        ); })}
      </div>

      <div className="fade-up">
        {tab === "overview" && <Overview {...props} labourPct={labourPct} />}
        {tab === "kpis" && <KPIs jobStats={jobStats} revenueStats={revenueStats} />}
        {tab === "graphs" && <Graphs monthlyData={monthlyData} inventoryValueData={inventoryValueData} targetsWithActuals={targetsWithActuals} supplierComparisonData={supplierComparisonData} supplierNames={supplierNames} />}
        {tab === "budget" && <Budget budgetVsActuals={budgetVsActuals} />}
        {tab === "targets" && <Targets targetsWithActuals={targetsWithActuals} />}
        {tab === "inventory" && <Inventory inventoryStats={inventoryStats} productUsage={productUsage} lowStockProducts={lowStockProducts} inventoryValueData={inventoryValueData} />}
        {tab === "employees" && <Employees employeeStats={employeeStats} employeePerformance={employeePerformance} labourStats={labourStats} monthlyData={monthlyData} ratingTrendData={ratingTrendData} ratingTrendEmployeeNames={ratingTrendEmployeeNames} />}
        {tab === "payments" && <Payments paymentJobs={paymentJobs} revenueStats={revenueStats} />}
        {tab === "alerts" && <Alerts alerts={alerts} />}
        {tab === "marketing" && <Marketing marketingData={marketingData} />}
      </div>
    </div>
  );
}

/* ───────────────────────── tabs ───────────────────────── */
function Overview({ revenueStats, jobStats, employeeStats, inventoryStats, monthlyData, jobTypeBreakdown }: AnalyticsViewProps & { labourPct: number }) {
  const revenue6mo = monthlyData.reduce((a, m) => a + m.revenue, 0);
  return (
    <div className="stack-18">
      <div className="astat-grid">
        <AStat icon={CreditCard} label="Revenue (period)" value={moneyShort(revenue6mo)} delta="+12%" deltaDir="up" hint="vs prior" />
        <AStat icon={Sparkles} label="Net profit" value={moneyShort(revenueStats.netProfit)} delta={`${Math.round(revenueStats.profitMargin)}%`} hint="margin" />
        <AStat icon={CalendarClock} label="Total jobs" value={jobStats.total} delta={`${jobStats.completed}`} hint="completed" />
        <AStat icon={AlertCircle} label="Pending payments" value={moneyShort(revenueStats.pendingAmount)} hint={`${revenueStats.pendingPayments} jobs`} />
      </div>
      <div className="an-grid-2">
        <Panel title="Revenue trend" sub="Monthly service revenue"><LineChart data={monthlyData.map((m) => ({ label: m.month, value: m.revenue }))} /></Panel>
        <Panel title="Jobs by type" sub="All-time mix"><Bars data={jobTypeBreakdown.map((t) => ({ label: t.type, value: t.count }))} fmt={(v) => v} /></Panel>
      </div>
      <div className="astat-grid">
        <MiniTile label="Employees" value={employeeStats.totalEmployees} hint={`${employeeStats.activeNow} active now`} />
        <MiniTile label="Products" value={inventoryStats.totalProducts} hint={`${money(inventoryStats.totalValue)} value`} />
        <MiniTile label="Avg job price" value={money(revenueStats.avgJobPrice)} hint="completed only" />
        <MiniTile label="Low stock" value={inventoryStats.lowStockCount} hint={inventoryStats.lowStockCount ? "needs refill" : "all stocked"} accent={inventoryStats.lowStockCount ? "var(--amber-700)" : undefined} />
      </div>
    </div>
  );
}

function KPIs({ jobStats, revenueStats }: { jobStats: JobStats; revenueStats: RevenueStats }) {
  const collectedPct = revenueStats.totalRevenue > 0 ? Math.round(((revenueStats.totalRevenue - revenueStats.pendingAmount) / revenueStats.totalRevenue) * 100) : 0;
  const kpis = [
    { label: "Completion rate", value: `${Math.round(jobStats.completionRate)}%`, delta: `${jobStats.completed}/${jobStats.total}`, dir: "up" as const },
    { label: "Profit margin", value: `${Math.round(revenueStats.profitMargin)}%`, delta: money(revenueStats.netProfit), dir: "up" as const },
    { label: "Avg job price", value: money(revenueStats.avgJobPrice), delta: undefined, dir: undefined },
    { label: "Avg duration", value: `${Math.round(jobStats.avgDuration)} min`, delta: undefined, dir: undefined },
  ];
  return (
    <div className="stack-18">
      <div className="an-kpi-grid">
        {kpis.map((k, i) => (
          <div key={i} className="astat"><div className="astat-head"><span>{k.label}</span></div><div className="astat-value">{k.value}</div>{k.delta && <div className={`astat-delta ${k.dir ?? ""}`}><strong>{k.delta}</strong></div>}</div>
        ))}
      </div>
      <div className="an-grid-2">
        <Panel title="Completion rate"><div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}><Ring value={jobStats.completionRate} label="Jobs completed" sublabel={`${jobStats.completed} of ${jobStats.total}`} /></div></Panel>
        <Panel title="Payments collected"><div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}><Ring value={collectedPct} color="#059669" label="Collected" sublabel={`${money(revenueStats.totalRevenue - revenueStats.pendingAmount)} of ${money(revenueStats.totalRevenue)}`} /></div></Panel>
      </div>
    </div>
  );
}

function labelKey(row: Record<string, string | number>) {
  return String(row.product ?? row.name ?? row.label ?? row.month ?? Object.values(row).find((v) => typeof v === "string") ?? "");
}
function Graphs({ monthlyData, inventoryValueData, targetsWithActuals, supplierComparisonData, supplierNames }: {
  monthlyData: MonthlyData[]; inventoryValueData: Array<{ name: string; warehouse: number; inCirculation: number }>;
  targetsWithActuals: TargetWithActual[]; supplierComparisonData: Array<Record<string, string | number>>; supplierNames: string[];
}) {
  const supGroups = supplierComparisonData.map((row) => ({ ...row, label: labelKey(row) }));
  return (
    <div className="stack-18">
      <Panel title="Revenue trend"><LineChart data={monthlyData.map((m) => ({ label: m.month, value: m.revenue }))} /></Panel>
      <Panel title="Profit & loss by month" sub="Revenue · cost · profit">
        <GroupedBars groups={monthlyData.map((m) => ({ label: m.month, Revenue: m.revenue, Cost: m.expenses, Profit: m.profit }))}
          series={[{ key: "Revenue", label: "Revenue", color: ACCENT }, { key: "Cost", label: "Cost", color: "#d97706" }, { key: "Profit", label: "Profit", color: "#059669" }]} />
      </Panel>
      <div className="an-grid-2">
        <Panel title="Inventory value"><LineChart color="#7c3aed" data={inventoryValueData.map((d) => ({ label: d.name, value: d.warehouse + d.inCirculation }))} /></Panel>
        <Panel title="Targets vs actuals">
          <GroupedBars groups={targetsWithActuals.map((t) => ({ label: (METRIC_LABEL[t.metric] ?? t.metric).split(" ")[0], Target: t.targetValue, Actual: t.actual }))}
            series={[{ key: "Target", label: "Target", color: "var(--primary-30)" }, { key: "Actual", label: "Actual", color: ACCENT }]}
            fmt={(v) => (v >= 1000 ? "$" + (v / 1000).toFixed(0) + "k" : v)} />
        </Panel>
      </div>
      {supplierComparisonData.length > 0 && (
        <Panel title="Supplier price comparison" sub="Unit cost per product across suppliers">
          <GroupedBars groups={supGroups} series={supplierNames.map((name, i) => ({ key: name, label: name, color: PALETTE[i % PALETTE.length] }))} fmt={(v) => "$" + Number(v).toFixed(0)} />
        </Panel>
      )}
    </div>
  );
}

function Budget({ budgetVsActuals }: { budgetVsActuals: BudgetVsActual[] }) {
  const totalBudget = budgetVsActuals.reduce((a, b) => a + b.budgetAmount, 0);
  const totalActual = budgetVsActuals.reduce((a, b) => a + b.actualAmount, 0);
  const variance = totalBudget - totalActual;
  return (
    <div className="stack-18">
      <div className="grid-3">
        <MiniTile label="Total budget" value={money(totalBudget)} hint="this period" />
        <MiniTile label="Total actual" value={money(totalActual)} hint={totalBudget ? `${Math.round((totalActual / totalBudget) * 100)}% used` : ""} />
        <MiniTile label="Variance" value={money(Math.abs(variance))} accent={variance >= 0 ? "var(--emerald-600)" : "var(--error)"} hint={variance >= 0 ? "under budget" : "over budget"} />
      </div>
      <Panel title="Budget vs actual" sub="By category">
        <GroupedBars groups={budgetVsActuals.map((b) => ({ label: b.category, Budget: b.budgetAmount, Actual: b.actualAmount }))}
          series={[{ key: "Budget", label: "Budget", color: "var(--primary-30)" }, { key: "Actual", label: "Actual", color: ACCENT }]} />
      </Panel>
      <Panel title="By category">
        <div className="stack-16">
          {budgetVsActuals.map((b) => {
            const over = b.actualAmount > b.budgetAmount;
            return (
              <div key={b.id}>
                <div className="row-between" style={{ marginBottom: 6, fontSize: 13.5 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{b.category}</span>
                  <span style={{ color: over ? "var(--error)" : "var(--primary-70)", fontVariantNumeric: "tabular-nums" }}>{money(b.actualAmount)} <span style={{ color: "var(--primary-40)" }}>/ {money(b.budgetAmount)}</span></span>
                </div>
                <ProgressBar value={b.actualAmount} max={b.budgetAmount} color={over ? "var(--error)" : ACCENT} />
              </div>
            );
          })}
          {budgetVsActuals.length === 0 && <div className="an-empty">No budgets set yet.</div>}
        </div>
      </Panel>
    </div>
  );
}

function Targets({ targetsWithActuals }: { targetsWithActuals: TargetWithActual[] }) {
  const [showForm, setShowForm] = useState(false);
  const fmtVal = (v: number, metric: string) => (metric === "PROFIT_MARGIN" ? v + "%" : metric === "REVENUE" || metric === "AVG_JOB_PRICE" ? money(v) : String(v));
  return (
    <div className="stack-18">
      <Panel title="Add target" action={<button className="btn btn-secondary btn-sm" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "Add target"}</button>}>
        {showForm && (
          <form action={async (fd) => { await createTarget(fd); setShowForm(false); }} className="an-target-form">
            <label className="field"><span className="input-label">Metric</span>
              <select className="aselect" name="metric" defaultValue="REVENUE">{Object.entries(METRIC_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className="field"><span className="input-label">Period</span>
              <select className="aselect" name="period" defaultValue="MONTHLY"><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option></select>
            </label>
            <label className="field"><span className="input-label">Period start</span><input className="input" type="date" name="periodStart" required /></label>
            <label className="field"><span className="input-label">Target value</span><input className="input" type="number" step="0.01" name="targetValue" placeholder="0" required /></label>
            <button className="btn btn-primary" type="submit">Add target</button>
          </form>
        )}
      </Panel>
      <div className="an-grid-2">
        {targetsWithActuals.map((t) => {
          const pct = t.targetValue ? Math.min(100, Math.round((t.actual / t.targetValue) * 100)) : 0;
          const hit = t.actual >= t.targetValue;
          return (
            <div key={t.id} className="dcard" style={{ gap: 12 }}>
              <div className="row-between">
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{METRIC_LABEL[t.metric] ?? t.metric}</h3>
                <div className="row" style={{ display: "flex", gap: 4 }}>
                  <form action={async (fd) => { await updateTarget(fd); }}><input type="hidden" name="targetId" value={t.id} /><input type="hidden" name="targetValue" value={t.targetValue} /><input type="hidden" name="notes" value={t.notes ?? ""} />
                    <button className="icon-btn" style={{ width: 28, height: 28 }} type="submit" title="Save actual"><Pencil size={13} /></button>
                  </form>
                  <form action={async (fd) => { await deleteTarget(fd); }}><input type="hidden" name="targetId" value={t.id} />
                    <button className="icon-btn" style={{ width: 28, height: 28, color: "var(--error)" }} type="submit" title="Delete"><X size={14} /></button>
                  </form>
                </div>
              </div>
              <div className="row-between" style={{ alignItems: "flex-end" }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--ink)" }}>{fmtVal(t.actual, t.metric)}</div>
                <div style={{ fontSize: 13, color: "var(--primary-60)" }}>of {fmtVal(t.targetValue, t.metric)}</div>
              </div>
              <ProgressBar value={t.actual} max={t.targetValue} color={hit ? "var(--emerald-600)" : ACCENT} />
              <div style={{ fontSize: 12, color: hit ? "var(--emerald-600)" : "var(--primary-60)", fontWeight: 600 }}>{hit ? "✓ Target met" : `${pct}% of target`}</div>
            </div>
          );
        })}
        {targetsWithActuals.length === 0 && <div className="dcard"><div className="an-empty">No targets yet — add one above.</div></div>}
      </div>
    </div>
  );
}

function Inventory({ inventoryStats, productUsage, lowStockProducts, inventoryValueData }: {
  inventoryStats: InventoryStats; productUsage: ProductUsage[]; lowStockProducts: LowStockProduct[]; inventoryValueData: Array<{ name: string; warehouse: number; inCirculation: number }>;
}) {
  const mostUsed = [...productUsage].sort((a, b) => b.totalUsed - a.totalUsed).slice(0, 5);
  const dist = inventoryValueData.map((d) => ({ label: d.name, value: +(d.warehouse + d.inCirculation).toFixed(2) }));
  const outOfStock = productUsage.filter((p) => p.stockLevel === 0).length;
  return (
    <div className="stack-18">
      <div className="astat-grid">
        <MiniTile label="Products" value={inventoryStats.totalProducts} hint="tracked SKUs" />
        <MiniTile label="Inventory value" value={money(inventoryStats.totalValue)} hint="at unit cost" />
        <MiniTile label="Low stock" value={inventoryStats.lowStockCount} accent={inventoryStats.lowStockCount ? "var(--amber-700)" : undefined} hint="at/below threshold" />
        <MiniTile label="Out of stock" value={outOfStock} accent={outOfStock ? "var(--error)" : undefined} hint={outOfStock ? "reorder now" : "none"} />
      </div>
      <div className="an-grid-2">
        <Panel title="Most used" sub="By units consumed">
          <div className="stack-12">
            {mostUsed.map((p, i) => (
              <div key={p.id}>
                <div className="row-between" style={{ fontSize: 13.5, marginBottom: 6 }}><span style={{ color: "var(--ink)", fontWeight: 500 }}>{p.name}</span><span style={{ color: "var(--primary-70)", fontVariantNumeric: "tabular-nums" }}>{p.totalUsed} {p.unit}</span></div>
                <ProgressBar value={p.totalUsed} max={mostUsed[0]?.totalUsed || 1} color={PALETTE[i % PALETTE.length]} />
              </div>
            ))}
            {mostUsed.length === 0 && <div className="an-empty">No usage data yet.</div>}
          </div>
        </Panel>
        <Panel title="Low stock" sub="Refill needed">
          {lowStockProducts.length === 0 ? <div className="an-empty">Everything is well stocked.</div> : (
            <div className="stack-12">
              {lowStockProducts.map((p) => (
                <div key={p.id} className="an-lowrow">
                  <div><div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{p.name}</div><div style={{ fontSize: 12, color: "var(--primary-60)" }}>min {p.minStock} {p.unit}</div></div>
                  <span className="pill" style={{ background: "#fef3c7", color: "var(--amber-800)" }}>{p.stockLevel} / {p.minStock} {p.unit}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      {dist.length > 0 && <Panel title="Value distribution" sub="Share of inventory value by product"><Donut data={dist} /></Panel>}
    </div>
  );
}

function Employees({ employeeStats, employeePerformance, labourStats, monthlyData, ratingTrendData, ratingTrendEmployeeNames }: {
  employeeStats: EmployeeStats; employeePerformance: EmployeePerformance[]; labourStats: LabourStats; monthlyData: MonthlyData[]; ratingTrendData: Array<Record<string, string | number>>; ratingTrendEmployeeNames: string[];
}) {
  const perf = employeePerformance;
  const avgRating = perf.length ? (perf.reduce((a, p) => a + p.currentRating, 0) / perf.length).toFixed(1) : "0.0";
  const totalCompleted = perf.reduce((a, p) => a + p.completedJobs, 0);
  const complaints = perf.reduce((a, p) => a + p.complaints, 0);
  // Providers who actually clocked time, for the labour-hours breakdown.
  const labourPerf = [...perf].filter((p) => p.clockedHours > 0).sort((a, b) => b.clockedHours - a.clockedHours);
  const trend = ratingTrendData.map((row) => {
    const vals = ratingTrendEmployeeNames.map((n) => Number(row[n])).filter((v) => !isNaN(v));
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { label: labelKey(row), value: +avg.toFixed(2) };
  });
  return (
    <div className="stack-18">
      <div className="astat-grid">
        <MiniTile label="Active cleaners" value={employeeStats.totalEmployees} hint={`${employeeStats.activeNow} online`} />
        <MiniTile label="Avg rating" value={avgRating + "★"} hint="across team" />
        <MiniTile label="Jobs completed" value={totalCompleted} hint="last 30 days" />
        <MiniTile label="Complaints" value={complaints} accent={complaints ? "var(--amber-700)" : undefined} hint="open" />
      </div>
      {/* Labour hours (SOP §9) — clocked person-hours and labour revenue at the
          configured rate, overall and per provider. */}
      <Panel title="Labour hours" sub={`Clocked time & labour revenue at $${labourStats.labourRate}/hr · ${labourStats.clockedJobCount} clocked jobs`}>
        <div className="astat-grid">
          <MiniTile label="Total clocked hours" value={hrs(labourStats.totalClockedHours)} hint="clock-out − clock-in" />
          <MiniTile label="Avg hours / job" value={hrs(labourStats.avgClockedHours)} hint="clocked jobs only" />
          <MiniTile label="Billable hours" value={hrs(labourStats.totalBillableHours)} hint="hourly jobs, rounded" />
          <MiniTile label="Labour revenue" value={money(labourStats.totalLabourRevenue)} hint="at configured rate" />
        </div>
        {labourPerf.length > 0 ? (
          <div className="an-grid-2" style={{ marginTop: 16 }}>
            <div><p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--primary-60)" }}>Clocked hours by provider</p><Bars data={labourPerf.map((p) => ({ label: p.name.split(" ")[0], value: p.clockedHours, color: "#0284c7" }))} fmt={(v) => hrs(Number(v))} /></div>
            <div><p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--primary-60)" }}>Labour revenue by provider</p><Bars data={labourPerf.map((p) => ({ label: p.name.split(" ")[0], value: p.labourRevenue }))} /></div>
          </div>
        ) : <div className="an-empty" style={{ marginTop: 12 }}>No clocked labour yet.</div>}
      </Panel>
      {monthlyData.some((m) => m.labourHours > 0) && (
        <Panel title="Labour hours by month" sub="Clocked hours per period"><Bars color="#0284c7" data={monthlyData.map((m) => ({ label: m.month, value: m.labourHours }))} fmt={(v) => hrs(Number(v))} /></Panel>
      )}
      <Panel title="Performance">
        <div className="atable-wrap" style={{ boxShadow: "none", border: "1px solid var(--primary-10)" }}>
          <div className="atable-scroll">
            <table className="atable">
              <thead><tr><th>Employee</th><th className="num">Jobs</th><th className="num">Completed</th><th className="num">Rate</th><th className="num">Clocked</th><th className="num">Labour rev.</th><th className="num">Revenue</th><th className="num">Avg / job</th><th className="num">Rating</th></tr></thead>
              <tbody>
                {perf.map((p) => (
                  <tr key={p.id} style={{ cursor: "default" }}>
                    <td><div className="row" style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar name={p.name} /><div className="col-client">{p.name}</div></div></td>
                    <td className="num">{p.totalJobs}</td>
                    <td className="num">{p.completedJobs}</td>
                    <td className="num"><span className={`profit-pct ${p.completionRate >= 90 ? "good" : p.completionRate >= 75 ? "warn" : "bad"}`}>{Math.round(p.completionRate)}%</span></td>
                    <td className="num">{p.clockedHours > 0 ? hrs(p.clockedHours) : "—"}</td>
                    <td className="num">{p.labourRevenue > 0 ? money(p.labourRevenue) : "—"}</td>
                    <td className="num">{money(p.totalRevenue)}</td>
                    <td className="num">{money(p.avgJobPrice)}</td>
                    <td className="num">{p.currentRating.toFixed(1)}★</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
      <div className="an-grid-2">
        <Panel title="Jobs per cleaner"><Bars data={perf.map((p) => ({ label: p.name.split(" ")[0], value: p.totalJobs }))} fmt={(v) => v} /></Panel>
        <Panel title="Avg time per job (min)"><Bars data={perf.map((p) => ({ label: p.name.split(" ")[0], value: Math.round(p.avgTimePerJob), color: "#0284c7" }))} fmt={(v) => v} /></Panel>
        <Panel title="Rating by cleaner"><Bars data={perf.map((p) => ({ label: p.name.split(" ")[0], value: p.currentRating, color: "#d97706" }))} fmt={(v) => Number(v).toFixed(1)} /></Panel>
        <Panel title="Complaints"><Bars data={perf.map((p) => ({ label: p.name.split(" ")[0], value: p.complaints, color: "#be185d" }))} fmt={(v) => v} /></Panel>
      </div>
      {trend.length > 0 && <Panel title="Team rating trend" sub="Rolling average"><LineChart color="#d97706" data={trend} fmt={(v) => Number(v).toFixed(1)} yTicks={3} /></Panel>}
    </div>
  );
}

function Payments({ paymentJobs, revenueStats }: { paymentJobs: PaymentJob[]; revenueStats: RevenueStats }) {
  const [range, setRange] = useState("mtd");
  const RANGES = [{ id: "wtd", label: "This week" }, { id: "mtd", label: "This month" }, { id: "qtd", label: "This quarter" }, { id: "ytd", label: "This year" }];
  // aggregate per employee
  const byEmp = new Map<string, { id: string; name: string; jobs: number; base: number; pending: number; status: string }>();
  for (const j of paymentJobs) {
    const e = byEmp.get(j.employeeId) || { id: j.employeeId, name: j.employeeName, jobs: 0, base: 0, pending: 0, status: "paid" };
    e.jobs += 1; e.base += j.employeePay;
    if (j.status !== "paid" && j.status !== "PAID") { e.pending += j.employeePay; e.status = "pending"; }
    byEmp.set(j.employeeId, e);
  }
  const rows = [...byEmp.values()];
  const totalPayout = rows.reduce((a, r) => a + r.base, 0);
  const pending = rows.reduce((a, r) => a + r.pending, 0);
  return (
    <div className="stack-18">
      <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {RANGES.map((r) => <button key={r.id} className={`an-chip ${range === r.id ? "active" : ""}`} onClick={() => setRange(r.id)}>{r.label}</button>)}
      </div>
      <div className="grid-3">
        <MiniTile label="Total payout" value={money(totalPayout)} hint="base pay" />
        <MiniTile label="Tips" value={money(revenueStats.totalTips)} hint="passed through" />
        <MiniTile label="Pending" value={money(pending)} accent={pending ? "var(--amber-700)" : undefined} hint="not yet paid" />
      </div>
      {/* Materials / equipment + deposit position (SOP §9 analytics). */}
      <Panel title="Materials, equipment & deposits">
        <div className="grid-3">
          <MiniTile label="Materials revenue" value={money(revenueStats.materialsRevenue)} hint="completed, non-refunded" />
          <MiniTile label="Deposits outstanding" value={money(revenueStats.depositsOutstanding)} accent={revenueStats.depositsOutstanding ? "var(--amber-700)" : undefined} hint="held, not applied" />
          <MiniTile label="Deposits applied" value={money(revenueStats.depositsApplied)} hint="credited to bills" />
          <MiniTile label="Deposits refunded" value={money(revenueStats.depositsRefunded)} hint="returned to clients" />
        </div>
      </Panel>
      <Panel title="Employee payment summary">
        <div className="atable-wrap" style={{ boxShadow: "none", border: "1px solid var(--primary-10)" }}>
          <div className="atable-scroll">
            <table className="atable">
              <thead><tr><th>Employee</th><th className="num">Jobs</th><th className="num">Base</th><th className="num">Pending</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ cursor: "default" }}>
                    <td><div className="row" style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar name={r.name} /><span className="col-client">{r.name}</span></div></td>
                    <td className="num">{r.jobs}</td>
                    <td className="num" style={{ fontWeight: 700, color: "var(--ink)" }}>{money(r.base)}</td>
                    <td className="num" style={{ color: r.pending ? "var(--amber-700)" : "var(--primary-50)" }}>{r.pending ? money(r.pending) : "—"}</td>
                    <td><StatusPill status={r.pending ? "pending" : "paid"} /></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5}><div className="an-empty">No payments in this period.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Alerts({ alerts }: { alerts: AlertItem[] }) {
  const high = alerts.filter((a) => a.severity === "high" || a.severity === "HIGH").length;
  const unread = alerts.filter((a) => !a.isRead).length;
  const SEV: Record<string, { bg: string; bd: string; fg: string; dot: string }> = {
    high: { bg: "#fef2f2", bd: "#fecaca", fg: "#991b1b", dot: "#dc2626" },
    medium: { bg: "var(--amber-50)", bd: "var(--amber-200)", fg: "var(--amber-800)", dot: "#d97706" },
    low: { bg: "var(--primary-5)", bd: "var(--primary-10)", fg: "var(--primary-70)", dot: "#0284c7" },
  };
  const sevKey = (s: string) => (s === "high" || s === "HIGH" ? "high" : s === "low" || s === "LOW" ? "low" : "medium");
  return (
    <div className="stack-18">
      <div className="grid-3">
        <MiniTile label="High priority" value={high} accent={high ? "var(--error)" : undefined} hint="needs action" />
        <MiniTile label="Unread" value={unread} accent={unread ? "var(--amber-700)" : undefined} hint="not yet seen" />
        <MiniTile label="Total alerts" value={alerts.length} hint="recent" />
      </div>
      <div className="stack-12">
        {alerts.length === 0 ? <div className="dcard"><div className="an-empty">No active alerts. 🎉</div></div> : alerts.map((al) => {
          const s = SEV[sevKey(al.severity)];
          return (
            <div key={al.id} className="an-alert" style={{ background: s.bg, border: `1px solid ${s.bd}`, opacity: al.isRead ? 0.7 : 1 }}>
              <span className="an-alert-dot" style={{ background: s.dot }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ display: "flex", alignItems: "center", gap: 8 }}><strong style={{ fontSize: 14, color: s.fg }}>{al.title}</strong>{!al.isRead && <span className="an-alert-new">NEW</span>}</div>
                <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>{al.message}</p>
                <div style={{ fontSize: 11.5, color: "var(--primary-50)", marginTop: 4 }}>{new Date(al.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</div>
              </div>
              <div className="row" style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                {!al.isRead && <button className="btn btn-secondary btn-sm" onClick={() => markAlertRead(al.id)}>Mark read</button>}
                <button className="icon-btn" style={{ width: 30, height: 30 }} title="Dismiss" onClick={() => dismissAlert(al.id)}><X size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Marketing({ marketingData }: { marketingData?: MarketingData }) {
  if (!marketingData) return <div className="dcard"><div className="an-empty">No marketing data.</div></div>;
  const m = marketingData;
  return (
    <div className="stack-18">
      <div className="astat-grid">
        <MiniTile label="Ad spend" value={money(m.totalSpent)} hint="to date" />
        <MiniTile label="Budget" value={money(m.totalBudget)} hint={`${m.activeCampaigns} active`} />
        <MiniTile label="Page visits" value={m.totalPageVisits.toLocaleString()} hint={`${m.publishedPages} published`} />
        <MiniTile label="Campaigns" value={m.campaigns.length} hint="total" />
      </div>
      <Panel title="Campaigns">
        <div className="atable-wrap" style={{ boxShadow: "none", border: "1px solid var(--primary-10)" }}>
          <div className="atable-scroll">
            <table className="atable">
              <thead><tr><th>Campaign</th><th>Channel</th><th className="num">Budget</th><th className="num">Spent</th><th className="num">Pages</th><th>Status</th></tr></thead>
              <tbody>
                {m.campaigns.map((c) => (
                  <tr key={c.id} style={{ cursor: "default" }}>
                    <td className="col-client">{c.name}</td>
                    <td>{c.channel ? <span className="pill" style={{ background: "var(--primary-5)", color: "var(--primary)" }}>{c.channel}</span> : "—"}</td>
                    <td className="num">{money(c.budget)}</td>
                    <td className="num">{money(c.spent)}</td>
                    <td className="num">{c.landingPageCount}</td>
                    <td><span className="pill" style={{ background: "var(--primary-5)", color: "var(--primary-70)" }}>{c.status}</span></td>
                  </tr>
                ))}
                {m.campaigns.length === 0 && <tr><td colSpan={6}><div className="an-empty">No campaigns yet.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
      <Panel title="Landing pages">
        <div className="atable-wrap" style={{ boxShadow: "none", border: "1px solid var(--primary-10)" }}>
          <div className="atable-scroll">
            <table className="atable">
              <thead><tr><th>Page</th><th>Campaign</th><th className="num">Visits</th><th>Status</th></tr></thead>
              <tbody>
                {m.landingPages.map((p) => (
                  <tr key={p.id} style={{ cursor: "default" }}>
                    <td className="col-client">{p.title}</td>
                    <td style={{ color: "var(--primary-60)" }}>{p.campaignName ?? "—"}</td>
                    <td className="num">{p.totalVisits.toLocaleString()}</td>
                    <td><span className="pill" style={{ background: p.isPublished ? "#d1fae5" : "var(--primary-5)", color: p.isPublished ? "#065f46" : "var(--primary-60)" }}>{p.isPublished ? "Published" : "Draft"}</span></td>
                  </tr>
                ))}
                {m.landingPages.length === 0 && <tr><td colSpan={4}><div className="an-empty">No landing pages yet.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}
