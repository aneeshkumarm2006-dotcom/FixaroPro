import { getCachedSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import Link from "next/link";
import {
  Briefcase,
  Users,
  Package,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Clock,
  CreditCard,
  ChevronRight,
  Plus,
} from "lucide-react";

import { requireAdmin } from "@/lib/page-guards";
import { isAdminRole } from "@/lib/role-routing";
import CleanerDashboard from "./CleanerDashboard";
import { StatusPill } from "@/lib/status-icons";

// ─── formatting helpers ───
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const moneyShort = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;
const dateStr = (d: Date) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const timeStr = (d: Date) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

export default async function DashboardPage() {
  const preCheck = await getCachedSession();
  if (!preCheck) redirect("/sign-in");

  const role = (preCheck.user as { role?: string }).role;
  if (!isAdminRole(role)) {
    return (
      <CleanerDashboard userId={preCheck.user.id} userName={preCheck.user.name ?? ""} />
    );
  }

  const session = await requireAdmin();
  const { user } = session;

  // ─── data ───
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

  const [
    totalJobs,
    completedJobs,
    inProgressJobs,
    pendingPaymentJobs,
    todaysJobs,
    upcomingJobs,
    recentJobs,
  ] = await Promise.all([
    db.job.count(),
    db.job.count({ where: { status: "COMPLETED" } }),
    db.job.count({ where: { status: "IN_PROGRESS" } }),
    db.job.count({ where: { status: "COMPLETED", paymentReceived: false } }),
    db.job.count({
      where: {
        jobDate: {
          gte: startOfToday,
          lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    }),
    db.job.findMany({
      where: { jobDate: { gte: new Date() }, status: { in: ["CREATED", "SCHEDULED"] } },
      orderBy: { jobDate: "asc" },
      take: 5,
      include: { cleaners: { select: { id: true, name: true } } },
    }),
    db.job.findMany({
      where: { status: "COMPLETED" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { cleaners: { select: { id: true, name: true } } },
    }),
  ]);

  const revenueData = await db.job.aggregate({
    where: { status: { in: ["COMPLETED", "PAID"] } },
    _sum: { price: true },
  });
  const totalRevenue = revenueData._sum.price || 0;

  const monthlyRevenueData = await db.job.aggregate({
    where: { status: { in: ["COMPLETED", "PAID"] }, createdAt: { gte: thirtyDaysAgo } },
    _sum: { price: true },
  });
  const monthlyRevenue = monthlyRevenueData._sum.price || 0;

  const [employeeCount, activeEmployees] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { cleaningJobs: { some: { status: "IN_PROGRESS" } } } }),
  ]);

  const products = await db.product.findMany();
  const totalProducts = products.length;
  const lowStockProducts = products
    .filter((p) => p.stockLevel <= p.minStock)
    .sort((a, b) => a.stockLevel - b.stockLevel)
    .slice(0, 6);
  const totalInventoryValue = products.reduce((sum, p) => sum + p.stockLevel * p.costPerUnit, 0);

  const [inventoryRules, employeesWithProducts] = await Promise.all([
    db.inventoryRule.findMany(),
    db.employeeProduct.findMany({ include: { product: true } }),
  ]);
  let refillAlertCount = 0;
  for (const ep of employeesWithProducts) {
    const rule = inventoryRules.find((r) => r.productId === ep.productId);
    if (rule && ep.quantity <= rule.refillThreshold) refillAlertCount++;
  }

  // ─── derived ───
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const firstName = (user.name ?? "there").split(/\s+/)[0];
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const alerts: AlertTileProps[] = [];
  if (pendingPaymentJobs > 0)
    alerts.push({ icon: AlertCircle, label: "Pending payment", value: String(pendingPaymentJobs), hint: "unpaid completed jobs", href: "/jobs?payment=pending" });
  if (lowStockProducts.length > 0)
    alerts.push({ icon: Package, label: "Low stock", value: String(lowStockProducts.length), hint: lowStockProducts.length === 1 ? "1 product" : `${lowStockProducts.length} products`, href: "/inventory?status=low" });
  if (refillAlertCount > 0)
    alerts.push({ icon: AlertTriangle, label: "Refill alerts", value: String(refillAlertCount), hint: "cleaners low on supplies", href: "/inventory" });

  const QUICK = [
    { icon: Plus, label: "New job", sub: "Schedule a job", href: "/jobs/new" },
    { icon: Users, label: "Employees", sub: `${employeeCount} on the team`, href: "/employees" },
    { icon: Package, label: "Inventory", sub: `${totalProducts} products`, href: "/inventory" },
    { icon: Calendar, label: "All jobs", sub: `${totalJobs} total`, href: "/jobs" },
  ];

  return (
    <div className="admin-font" style={{ padding: 32 }}>
      <header style={{ marginBottom: 32 }}>
        <p className="eyebrow">{dateLabel}</p>
        <h1 className="display" style={{ fontSize: "clamp(34px, 4.4vw, 50px)", marginTop: 6 }}>
          {greeting}, <em>{firstName}.</em>
        </h1>
        <p className="subtitle" style={{ marginTop: 12, fontSize: 16 }}>
          Here&apos;s what&apos;s happening with your business today.
        </p>
      </header>

      {/* Primary metrics */}
      <div className="astat-grid" style={{ marginBottom: 18 }}>
        <AStat icon={CreditCard} label="Total revenue" value={moneyShort(totalRevenue)} delta={moneyShort(monthlyRevenue)} deltaDir="up" hint="this month" />
        <AStat icon={Briefcase} label="Total jobs" value={totalJobs} delta={String(completedJobs)} hint="completed" />
        <AStat icon={Users} label="Employees" value={employeeCount} delta={String(activeEmployees)} deltaDir="up" hint="active now" />
        <AStat icon={Package} label="Products" value={totalProducts} delta={money(totalInventoryValue)} hint="inventory value" />
      </div>

      {/* Secondary metrics + alerts */}
      <div className="dash-secondary" style={{ marginBottom: 32 }}>
        <AStat icon={Calendar} label="Today's jobs" value={todaysJobs} hint="scheduled today" />
        <AStat icon={Clock} label="In progress" value={inProgressJobs} hint="cleaners on site" />
        {alerts.map((a, i) => <AlertTile key={i} {...a} />)}
      </div>

      {/* Two-column lists */}
      <div className="dash-twocol" style={{ marginBottom: lowStockProducts.length ? 18 : 32 }}>
        <ListCard title="Upcoming jobs" actionHref="/jobs?tab=upcoming" empty="No upcoming jobs scheduled." rows={upcomingJobs} />
        <ListCard title="Recently completed" actionHref="/jobs?status=COMPLETED" empty="No completed jobs yet." rows={recentJobs} />
      </div>

      {/* Low stock banner */}
      {lowStockProducts.length > 0 && (
        <div className="dash-lowstock" style={{ marginBottom: 32 }}>
          <div className="dash-lowstock-head">
            <div className="row" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span className="dash-lowstock-icon"><AlertCircle size={16} /></span>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--amber-800)" }}>Low stock alert</h3>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--amber-700)" }}>
                  {lowStockProducts.length} {lowStockProducts.length === 1 ? "product is" : "products are"} at or below the refill threshold.
                </p>
              </div>
            </div>
            <Link href="/inventory?status=low" className="link" style={{ color: "var(--amber-800)", fontWeight: 600, fontSize: 13 }}>
              Manage inventory →
            </Link>
          </div>
          <div className="dash-lowstock-grid">
            {lowStockProducts.map((p) => (
              <Link key={p.id} href={`/inventory/${p.id}`} className="dash-lowstock-item">
                <div className="dash-lowstock-name">{p.name}</div>
                <div className="dash-lowstock-qty"><strong>{p.stockLevel}</strong> / {p.minStock} {p.unit}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Quick actions</p>
        <div className="dash-qa-grid">
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <Link key={q.href} href={q.href} className="dash-qa">
                <span className="dash-qa-icon"><Icon size={20} /></span>
                <span className="dash-qa-text">
                  <span className="dash-qa-label">{q.label}</span>
                  <span className="dash-qa-sub">{q.sub}</span>
                </span>
                <span className="dash-qa-arrow"><ChevronRight size={16} /></span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── primitives ─── */
function AStat({ icon: Icon, label, value, hint, delta, deltaDir }: {
  icon: React.ElementType; label: string; value: number | string;
  hint?: string; delta?: string; deltaDir?: "up" | "down";
}) {
  return (
    <div className="astat">
      <div className="astat-head">
        <span>{label}</span>
        <span className="astat-icon"><Icon size={15} /></span>
      </div>
      <div className="astat-value">{value}</div>
      {(hint || delta) && (
        <div className={`astat-delta ${deltaDir ?? ""}`}>
          {delta && <strong>{delta}</strong>}
          {hint && <> {hint}</>}
        </div>
      )}
    </div>
  );
}

interface AlertTileProps { icon: React.ElementType; label: string; value: string; hint?: string; href: string }
function AlertTile({ icon: Icon, label, value, hint, href }: AlertTileProps) {
  return (
    <Link href={href} className="astat dash-alert">
      <div className="astat-head" style={{ color: "var(--amber-800)" }}>
        <span>{label}</span>
        <span className="astat-icon" style={{ background: "#fef3c7", color: "var(--amber-700)" }}><Icon size={15} /></span>
      </div>
      <div className="astat-value" style={{ color: "var(--amber-800)" }}>{value}</div>
      {hint && <div className="astat-delta" style={{ color: "var(--amber-700)" }}>{hint}</div>}
    </Link>
  );
}

type JobRow = {
  id: string; clientName: string; jobDate: Date | null; startTime: Date;
  price: number | null; discount?: number | null; status: string;
};
function ListCard({ title, actionHref, rows, empty }: {
  title: string; actionHref: string; rows: JobRow[]; empty: string;
}) {
  return (
    <div className="dcard dash-listcard">
      <div className="dash-listcard-head">
        <h3>{title}</h3>
        <Link href={actionHref} className="link" style={{ fontSize: 13, fontWeight: 500 }}>View all →</Link>
      </div>
      {rows.length === 0 ? (
        <div className="dash-list-empty">{empty}</div>
      ) : (
        <div className="dash-list">
          {rows.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="dash-listrow">
              <span className="dash-avatar">{initials(j.clientName || "??")}</span>
              <div className="dash-listrow-meta">
                <div className="dash-listrow-name">{j.clientName || "Unknown client"}</div>
                <div className="dash-listrow-sub">
                  {dateStr(j.jobDate ?? j.startTime)} · {timeStr(j.startTime)}
                </div>
              </div>
              <div className="dash-listrow-right">
                <div className="dash-listrow-price">{money((j.price || 0) - (j.discount || 0))}</div>
                <StatusPill status={j.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
