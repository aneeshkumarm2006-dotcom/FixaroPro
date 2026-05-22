"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import JobModal from "../JobModal";
import { saveJob } from "../../actions/saveJob";
import { deleteJob as deleteJobAction } from "../../actions/deleteJob";
import { togglePaymentReceived } from "../../actions/toggleJobPaymentStatus";
import { chargeJob } from "../../actions/chargeJob";
import { generateInvoiceFromJob } from "../../actions/generateInvoiceFromJob";
import { markJobComplete } from "../../actions/markJobComplete";
import { createRatingToken } from "../../actions/createRatingToken";
import {
  ArrowLeft, MapPin, Clock, DollarSign, Users,
  CheckCircle2, Package, Pencil, History, Activity,
  AlertTriangle, Trash2, Loader, Briefcase, Receipt, Camera, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText,
  Star, Copy, Check,
} from "lucide-react";
import { ConfirmDeleteModal } from "@/components/common/ConfirmDeleteModal";

type TabView = "details" | "financials" | "products" | "logs";

const TABS: Array<{ id: TabView; label: string; icon: React.ReactNode }> = [
  { id: "details",    label: "Job details",    icon: <Briefcase size={15} /> },
  { id: "financials", label: "Financials",     icon: <DollarSign size={15} /> },
  { id: "products",   label: "Product usage",  icon: <Package size={15} /> },
  { id: "logs",       label: "Logs",           icon: <History size={15} /> },
];

interface Job {
  id: string;
  clientName: string;
  clientId?: string | null;
  location: string | null;
  description: string | null;
  jobType: string | null;
  jobDate: string | null;
  startTime: string;
  endTime: string | null;
  clockInTime: string | null;
  clockOutTime: string | null;
  status: string;
  price: number | null;
  employeePay: number | null;
  totalTip: number | null;
  parking: number | null;
  paymentReceived: boolean;
  isCashJob?: boolean;
  invoiceSent: boolean;
  notes: string | null;
  paymentType?: string | null;
  discountAmount?: number | null;
  bedCount?: number | null;
  bathCount?: number | null;
  payRateMultiplier?: number | null;
  depositPaid?: boolean;
  depositPaymentIntentId?: string | null;
  addOns?: Array<{ id: string; name: string; price: number }>;
  employee: { id: string; name: string };
  cleaners: Array<{ id: string; name: string }>;
}

interface ClientLite { id: string; name: string; }

interface ProductUsage {
  id: string;
  quantity: number;
  notes: string | null;
  product: { id: string; name: string; unit: string; costPerUnit: number; };
}

interface JobLog {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  description: string;
  createdAt: string;
  user: { id: string; name: string; } | null;
}

interface JobPhoto {
  id: string;
  url: string;
  caption: string | null;
  createdAt: string;
  employee: { id: string; name: string; };
}

interface User { id: string; name: string; email: string; }

interface JobDetailViewProps {
  job: Job;
  productUsage: ProductUsage[];
  logs: JobLog[];
  photos?: JobPhoto[];
  totalLogs: number;
  logsPage: number;
  logsPerPage: number;
  totalProductCost: number;
  isAdmin: boolean;
  onDeleteJob?: () => Promise<void>;
  users: User[];
  clients?: ClientLite[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function avatarBg(name: string): string {
  const palette = ['#2c6e75','#1a5c63','#3d7f87','#0e4a52','#4f9097','#246a72'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0x7fffffff;
  return palette[h % palette.length];
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    CREATED:     { label: 'Created',     bg: '#f3f4f6', color: '#374151', dot: '#9ca3af' },
    SCHEDULED:   { label: 'Scheduled',   bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
    IN_PROGRESS: { label: 'In Progress', bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
    COMPLETED:   { label: 'Completed',   bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
    PAID:        { label: 'Paid',        bg: '#d1fae5', color: '#065f46', dot: '#059669' },
    CANCELLED:   { label: 'Cancelled',   bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  };
  const c = map[status] || { label: status, bg: '#f3f4f6', color: '#374151', dot: '#9ca3af' };
  return (
    <span className="pill" style={{ background: c.bg, color: c.color }}>
      <span className="pill-dot" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

function TypePill({ type }: { type: string | null }) {
  if (!type) return null;
  const labels: Record<string, string> = { R: 'Residential', C: 'Commercial', PC: 'Post-Construction', F: 'Follow-up' };
  const bgs: Record<string, { bg: string; color: string }> = {
    R:  { bg: 'var(--primary-10)', color: 'var(--primary)' },
    C:  { bg: '#dbeafe',           color: '#1e40af' },
    PC: { bg: '#fef3c7',           color: '#92400e' },
    F:  { bg: '#f3f4f6',           color: '#374151' },
  };
  const s = bgs[type] || { bg: '#f3f4f6', color: '#374151' };
  return <span className="pill" style={{ background: s.bg, color: s.color }}>{labels[type] || type}</span>;
}

function payTypeLabel(type: string | null | undefined): string {
  const map: Record<string, string> = {
    CASH: 'Cash', CHEQUE: 'Cheque', E_TRANSFER: 'E-Transfer',
    CREDIT_CARD: 'Card on file', OTHER: 'Other',
  };
  return type ? (map[type] || type.replace(/_/g, ' ')) : '—';
}

function getActionIcon(action: string) {
  switch (action) {
    case 'CLOCKED_IN': case 'CLOCKED_OUT': return <Clock size={14} />;
    case 'STATUS_CHANGED': return <Activity size={14} />;
    case 'PRODUCT_USED': return <Package size={14} />;
    case 'PAYMENT_RECEIVED': case 'INVOICE_SENT': return <DollarSign size={14} />;
    case 'CLEANER_ADDED': case 'CLEANER_REMOVED': return <Users size={14} />;
    default: return <FileText size={14} />;
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function JobDetailView({
  job,
  productUsage,
  logs,
  photos = [],
  totalLogs,
  logsPage,
  logsPerPage,
  totalProductCost,
  isAdmin,
  onDeleteJob,
  users,
  clients = [],
}: JobDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnToUrl = searchParams.get("returnTo");
  const backUrl   = returnToUrl ? decodeURIComponent(returnToUrl) : "/jobs";
  const backLabel = returnToUrl ? "Back to Calendar" : "Back to Jobs";

  const [activeView,       setActiveView]       = useState<TabView>("details");
  const [isDeleting,       setIsDeleting]       = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditModalOpen,  setIsEditModalOpen]  = useState(false);
  const [lightboxIdx,      setLightboxIdx]      = useState<number | null>(null);
  const [paymentReceived,  setPaymentReceived]  = useState(job.paymentReceived);
  const [invoiceSent,      setInvoiceSent]      = useState(job.invoiceSent);
  const [isTogglingPayment, setIsTogglingPayment] = useState(false);
  const [isTogglingInvoice, setIsTogglingInvoice] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const [isSendingReview, setIsSendingReview] = useState(false);
  const [reviewCopied, setReviewCopied] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(job.status);

  // Lightbox keyboard nav
  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      setLightboxIdx(null);
      if (e.key === 'ArrowLeft')   setLightboxIdx(i => i === null ? null : (i - 1 + photos.length) % photos.length);
      if (e.key === 'ArrowRight')  setLightboxIdx(i => i === null ? null : (i + 1) % photos.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIdx, photos.length]);

  // Sync tab with URL
  useEffect(() => {
    const viewParam = (searchParams.get("tab") as TabView) || "details";
    if (TABS.some(t => t.id === viewParam)) setActiveView(viewParam);
  }, [searchParams]);

  const updateView = (view: TabView) => {
    setActiveView(view);
    const params = new URLSearchParams(searchParams.toString());
    if (view === "details") { params.delete("tab"); } else { params.set("tab", view); }
    if (view !== "logs") params.delete("logsPage");
    const query = params.toString();
    router.replace(query ? `/jobs/${job.id}?${query}` : `/jobs/${job.id}`, { scroll: false });
  };

  const handleSubmit = async (formData: FormData) => {
    return saveJob(formData);
  };

  const handleModalDelete = async (jobId: string) => {
    return deleteJobAction(jobId);
  };

  const handleDelete = async () => {
    if (!onDeleteJob) return;
    setIsDeleting(true);
    try { await onDeleteJob(); } catch { setIsDeleting(false); setShowDeleteConfirm(false); }
  };

  const handleTogglePaymentReceived = async () => {
    if (!isAdmin || isTogglingPayment) return;
    setIsTogglingPayment(true);
    const prev = paymentReceived;
    setPaymentReceived(!prev);
    try {
      const result = await togglePaymentReceived(job.id);
      if (!result.success) setPaymentReceived(prev);
    } catch { setPaymentReceived(prev); }
    finally { setIsTogglingPayment(false); }
  };

  const handleMarkComplete = async () => {
    if (isMarkingComplete) return;
    setIsMarkingComplete(true);
    const result = await markJobComplete(job.id);
    if (result.success) setCurrentStatus("COMPLETED");
    setIsMarkingComplete(false);
  };

  const handleGetReviewLink = async () => {
    if (isSendingReview) return;
    setIsSendingReview(true);
    const result = await createRatingToken({ jobId: job.id });
    if (result.success && result.token) {
      const link = `${window.location.origin}/rate/${result.token}`;
      setReviewLink(link);
    }
    setIsSendingReview(false);
  };

  const handleCopyReviewLink = () => {
    if (!reviewLink) return;
    navigator.clipboard.writeText(reviewLink);
    setReviewCopied(true);
    setTimeout(() => setReviewCopied(false), 2000);
  };

  const handleGenerateInvoice = async () => {
    if (!isAdmin || isTogglingInvoice) return;
    setIsTogglingInvoice(true);
    try {
      const result = await generateInvoiceFromJob(job.id);
      if (result.success && result.invoiceId) {
        setInvoiceSent(true);
        router.push(`/invoices/${result.invoiceId}`);
      }
    } catch { /* silently fail */ }
    finally { setIsTogglingInvoice(false); }
  };

  // Derived values
  const duration = job.endTime && job.startTime
    ? Math.round((new Date(job.endTime).getTime() - new Date(job.startTime).getTime()) / 60000)
    : null;

  const netProfit = (job.price || 0) - (job.employeePay || 0) - (job.parking || 0) - totalProductCost;
  const grossRevenue = (job.price || 0) - (job.discountAmount || 0);
  const totalLogsPages = Math.ceil(totalLogs / logsPerPage);

  const showPayWarning = job.status === "COMPLETED" && !paymentReceived;

  // Date hero values
  const jobDateObj = job.jobDate ? new Date(job.jobDate) : new Date(job.startTime);
  const dayOfWeek = jobDateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum    = jobDateObj.toLocaleDateString('en-US', { day: 'numeric' });
  const mon       = jobDateObj.toLocaleDateString('en-US', { month: 'short' });
  const startTimeStr = new Date(job.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const endTimeStr   = job.endTime ? new Date(job.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null;

  // ── Tab content ────────────────────────────────────────────────────────────

  const DetailsTab = () => (
    <div className="tab-panel">
      {/* Date & Time */}
      <div className="dcard">
        <div className="dcard-head">
          <h3>Date &amp; time</h3>
        </div>
        <div className="date-hero">
          <div className="date-block">
            <span className="mon">{mon}</span>
            <span className="day">{dayNum}</span>
          </div>
          <div className="date-meta">
            <div className="day-of-week">{dayOfWeek}</div>
            <div className="time">
              {startTimeStr}{endTimeStr ? ` — ${endTimeStr}` : ''}
            </div>
            {duration !== null && (
              <div className="duration">{Math.floor(duration / 60)}h {duration % 60}m</div>
            )}
          </div>
        </div>
        {job.addOns && job.addOns.length > 0 && (
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--primary-10)' }}>
            <div className="label" style={{ marginBottom: 8 }}>Add-ons</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {job.addOns.map(a => (
                <span key={a.id} style={{ fontSize: 12, padding: '4px 10px', background: 'var(--cream)', borderRadius: 999, color: 'var(--primary-70)', fontWeight: 500 }}>
                  {a.name} · ${a.price.toFixed(2)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Team */}
      <div className="dcard">
        <div className="dcard-head">
          <h3>Team</h3>
          {job.cleaners.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--primary-50)' }}>{job.cleaners.length} assigned</span>
          )}
        </div>
        <div className="team-list">
          <div className="team-row">
            <div className="avatar avatar-lg" style={{ background: avatarBg(job.employee.name) }}>
              {initials(job.employee.name)}
            </div>
            <div className="team-meta">
              <div className="name">{job.employee.name}</div>
              <div className="role">Created by</div>
            </div>
          </div>
          {job.cleaners.map(c => (
            <div key={c.id} className="team-row">
              <div className="avatar avatar-lg" style={{ background: avatarBg(c.name) }}>
                {initials(c.name)}
              </div>
              <div className="team-meta">
                <div className="name">{c.name}</div>
                <div className="role">Cleaner</div>
              </div>
            </div>
          ))}
          {job.cleaners.length === 0 && (
            <p style={{ color: 'var(--primary-50)', fontSize: 14, padding: '4px 0' }}>No cleaners assigned yet.</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="dcard tab-panel-wide">
        <div className="dcard-head"><h3>Notes</h3></div>
        <p style={{ margin: 0, fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {job.notes || <span style={{ color: 'var(--primary-50)', fontStyle: 'italic' }}>No notes for this job.</span>}
        </p>
      </div>

      {/* Location */}
      {job.location && (
        <div className="dcard tab-panel-wide">
          <div className="dcard-head"><h3>Location</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink)' }}>
            <MapPin size={16} style={{ color: 'var(--primary-50)' }} />
            {job.location}
          </div>
        </div>
      )}
    </div>
  );

  const FinancialsTab = () => (
    <div>
      <div className="astat-grid" style={{ marginBottom: 24 }}>
        <div className="astat">
          <div className="astat-head"><span>Price</span></div>
          <div className="astat-value">{job.price !== null ? `$${job.price.toFixed(2)}` : '—'}</div>
          {(job.discountAmount || 0) > 0 && <div className="astat-delta">Discount −${job.discountAmount!.toFixed(2)}</div>}
        </div>
        <div className="astat">
          <div className="astat-head"><span>Employee pay</span></div>
          <div className="astat-value">{job.employeePay !== null ? `$${job.employeePay.toFixed(2)}` : '—'}</div>
          <div className="astat-delta">{job.cleaners.length} cleaner{job.cleaners.length === 1 ? '' : 's'}</div>
        </div>
        <div className="astat">
          <div className="astat-head"><span>Product cost</span></div>
          <div className="astat-value">{totalProductCost > 0 ? `$${totalProductCost.toFixed(2)}` : '—'}</div>
          <div className="astat-delta">{productUsage.length} item{productUsage.length === 1 ? '' : 's'} used</div>
        </div>
        <div className="astat">
          <div className="astat-head"><span>Net profit</span></div>
          <div className="astat-value" style={{ color: netProfit >= 0 ? 'var(--emerald-600)' : 'var(--error)' }}>
            ${netProfit.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="tab-panel" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        {/* Breakdown */}
        <div className="dcard">
          <div className="dcard-head">
            <h3>Breakdown</h3>
            <Button
              variant="default" size="sm" border={false}
              onClick={handleGenerateInvoice}
              disabled={!isAdmin || isTogglingInvoice}
              className="rounded-lg px-3 py-1.5 text-xs"
            >
              {isTogglingInvoice ? <Loader size={12} className="animate-spin mr-1" /> : <Receipt size={12} className="mr-1" />}
              {invoiceSent ? 'View Invoice' : 'Invoice'}
            </Button>
          </div>
          <div>
            {job.price !== null && (
              <div className="finrow">
                <span className="finrow-label">Base price</span>
                <span className="finrow-value">${job.price.toFixed(2)}</span>
              </div>
            )}
            {(job.discountAmount || 0) > 0 && (
              <div className="finrow negative">
                <span className="finrow-label">Discount</span>
                <span className="finrow-value">−${job.discountAmount!.toFixed(2)}</span>
              </div>
            )}
            <div className="finrow">
              <span className="finrow-label"><strong>Gross revenue</strong></span>
              <span className="finrow-value">${grossRevenue.toFixed(2)}</span>
            </div>
            {job.employeePay !== null && (
              <div className="finrow negative">
                <span className="finrow-label">Employee pay · {job.cleaners.length} cleaner{job.cleaners.length === 1 ? '' : 's'}</span>
                <span className="finrow-value">−${job.employeePay.toFixed(2)}</span>
              </div>
            )}
            {totalProductCost > 0 && (
              <div className="finrow negative">
                <span className="finrow-label">Product cost</span>
                <span className="finrow-value">−${totalProductCost.toFixed(2)}</span>
              </div>
            )}
            {(job.parking || 0) > 0 && (
              <div className="finrow negative">
                <span className="finrow-label">Parking</span>
                <span className="finrow-value">−${job.parking!.toFixed(2)}</span>
              </div>
            )}
            {(job.totalTip || 0) > 0 && (
              <div className="finrow">
                <span className="finrow-label">Tips</span>
                <span className="finrow-value" style={{ color: 'var(--emerald-600)' }}>+${job.totalTip!.toFixed(2)}</span>
              </div>
            )}
            <div className="finrow total">
              <span className="finrow-label">Net profit</span>
              <span className="finrow-value">${netProfit.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="dcard">
          <div className="dcard-head">
            <h3>Payment</h3>
            <span style={{ fontSize: 11, color: 'var(--primary-50)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {payTypeLabel(job.paymentType)}
            </span>
          </div>

          {job.depositPaid && (
            <div className="pay-toggle" style={{ background: 'rgba(0,95,106,0.06)', borderRadius: 10, marginBottom: 4 }}>
              <div className="pay-toggle-info">
                <div className="icon-bubble" style={{ background: 'rgba(22,163,74,0.12)' }}>
                  <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                </div>
                <div className="label-stack">
                  <span className="top">Deposit paid</span>
                  <span className="bottom">$20.00 collected at booking{job.depositPaymentIntentId ? ` · ${job.depositPaymentIntentId}` : ''}</span>
                </div>
              </div>
            </div>
          )}

          <div className="pay-toggle">
            <div className="pay-toggle-info">
              <div className="icon-bubble">
                {isTogglingPayment
                  ? <Loader size={18} className="animate-spin" />
                  : <CheckCircle2 size={18} />
                }
              </div>
              <div className="label-stack">
                <span className="top">Mark as paid</span>
                <span className="bottom">{paymentReceived ? `Paid · $${grossRevenue.toFixed(2)}` : 'Not paid yet'}</span>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                className={`tswitch ${paymentReceived ? 'on' : ''}`}
                onClick={handleTogglePaymentReceived}
                disabled={isTogglingPayment}
                role="switch"
                aria-checked={paymentReceived}
                aria-label="Toggle paid status"
              />
            )}
          </div>

          <div className="pay-toggle">
            <div className="pay-toggle-info">
              <div className="icon-bubble">
                {isTogglingInvoice
                  ? <Loader size={18} className="animate-spin" />
                  : <Receipt size={18} />
                }
              </div>
              <div className="label-stack">
                <span className="top">Invoice sent</span>
                <span className="bottom">{invoiceSent ? 'Invoice emailed to client.' : 'Not sent yet.'}</span>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                className={`tswitch ${invoiceSent ? 'on' : ''}`}
                onClick={handleGenerateInvoice}
                disabled={isTogglingInvoice}
                role="switch"
                aria-checked={invoiceSent}
                aria-label="Toggle invoice sent"
              />
            )}
          </div>

          {!paymentReceived && isAdmin && !job.isCashJob && (
            <ChargeButton jobId={job.id} amount={grossRevenue} />
          )}
        </div>
      </div>
    </div>
  );

  const ProductUsageTab = () => (
    <div className="tab-panel" style={{ gridTemplateColumns: '1fr' }}>
      <div className="dcard">
        <div className="dcard-head">
          <h3>Products used · {productUsage.length}</h3>
          {totalProductCost > 0 && (
            <span style={{ fontSize: 13, color: 'var(--primary-60)', fontWeight: 600 }}>
              Total ${totalProductCost.toFixed(2)}
            </span>
          )}
        </div>
        {productUsage.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--primary-50)', fontSize: 14 }}>
            No products logged for this job.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="prow" style={{ background: 'transparent', border: 0, padding: '8px 16px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary-60)', fontWeight: 700 }}>
              <span>Product</span>
              <span className="pnum">Qty</span>
              <span className="pnum">Unit cost</span>
              <span className="pnum">Total</span>
            </div>
            {productUsage.map(u => (
              <div key={u.id} className="prow">
                <div>
                  <div className="pname">{u.product.name}</div>
                  <div className="pmeta">per {u.product.unit}</div>
                </div>
                <span className="pnum">{u.quantity}</span>
                <span className="pnum">${u.product.costPerUnit.toFixed(2)}</span>
                <span className="pnum">${(u.quantity * u.product.costPerUnit).toFixed(2)}</span>
              </div>
            ))}
            <div className="finrow total" style={{ paddingTop: 18, marginTop: 6 }}>
              <span className="finrow-label">Total product cost</span>
              <span className="finrow-value">${totalProductCost.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const LogsTab = () => (
    <div className="tab-panel">
      {/* Photos */}
      <div className="dcard">
        <div className="dcard-head">
          <h3>Job photos · {photos.length}</h3>
        </div>
        {photos.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--primary-50)', fontSize: 14 }}>
            No photos for this job yet.
          </div>
        ) : (
          <div className="photo-grid">
            {photos.map((photo, idx) => (
              <button
                key={photo.id}
                type="button"
                className="photo-cell"
                onClick={() => setLightboxIdx(idx)}
                aria-label={photo.caption || `Job photo ${idx + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.caption || 'Job photo'} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Activity */}
      <div className="dcard">
        <div className="dcard-head">
          <h3>Activity · {totalLogs}</h3>
        </div>
        {logs.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--primary-50)', fontSize: 14 }}>
            No activity logged yet.
          </div>
        ) : (
          <>
            <div className="timeline">
              {logs.map(log => (
                <div key={log.id} className="tline-item">
                  <div className="tline-dot">{getActionIcon(log.action)}</div>
                  <div>
                    <div className="tline-text">{log.description}</div>
                    {log.user && <div className="tline-actor">by {log.user.name}</div>}
                    {log.field && log.oldValue && log.newValue && (
                      <div className="tline-actor">{log.field}: {log.oldValue} → {log.newValue}</div>
                    )}
                  </div>
                  <div className="tline-ts">
                    {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    <br />
                    <span style={{ fontSize: 11, color: 'var(--primary-40)' }}>
                      {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {totalLogs > logsPerPage && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--primary-10)', fontSize: 12, color: 'var(--primary-60)' }}>
                <span>Page {logsPage} of {totalLogsPages}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <a href={`/jobs/${job.id}?tab=logs&logsPage=1`} className="apager-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, opacity: logsPage === 1 ? 0.35 : 1, pointerEvents: logsPage === 1 ? 'none' : 'auto' }}>
                    <ChevronsLeft size={14} />
                  </a>
                  <a href={`/jobs/${job.id}?tab=logs&logsPage=${logsPage - 1}`} className="apager-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, opacity: logsPage === 1 ? 0.35 : 1, pointerEvents: logsPage === 1 ? 'none' : 'auto' }}>
                    <ChevronLeft size={14} />
                  </a>
                  <a href={`/jobs/${job.id}?tab=logs&logsPage=${logsPage + 1}`} className="apager-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, opacity: logsPage === totalLogsPages ? 0.35 : 1, pointerEvents: logsPage === totalLogsPages ? 'none' : 'auto' }}>
                    <ChevronRight size={14} />
                  </a>
                  <a href={`/jobs/${job.id}?tab=logs&logsPage=${totalLogsPages}`} className="apager-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, opacity: logsPage === totalLogsPages ? 0.35 : 1, pointerEvents: logsPage === totalLogsPages ? 'none' : 'auto' }}>
                    <ChevronsRight size={14} />
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="admin-font relative h-full overflow-y-auto pb-8 px-4">
      <div className="relative z-10 max-w-[80rem] w-full mx-auto" style={{ paddingTop: 32 }}>

        {/* Back button */}
        <a href={backUrl} className="jdetail-back">
          <ArrowLeft size={14} /> {backLabel}
        </a>

        {/* Header */}
        <div className="jdetail-head">
          <div className="jdetail-head-left">
            <h1 className="jdetail-title">{job.clientName}</h1>
            <div className="jdetail-meta-row">
              <StatusPill status={job.status} />
              <TypePill type={job.jobType} />
              <span style={{ fontSize: 11.5, color: 'var(--primary-50)', fontFamily: 'monospace' }}>{job.id}</span>
            </div>
            {(job.location || job.description) && (
              <p className="jdetail-desc">
                {job.location}
                {job.description ? <> · <span style={{ color: 'var(--ink-soft)' }}>{job.description}</span></> : null}
              </p>
            )}
          </div>
          <div className="jdetail-actions">
            {isAdmin && !["COMPLETED", "CANCELLED"].includes(currentStatus) && (
              <Button
                variant="default" border={false}
                onClick={handleMarkComplete}
                disabled={isMarkingComplete}
                className="rounded-xl px-4 py-2"
              >
                <CheckCircle2 size={14} className="mr-2" />
                {isMarkingComplete ? "Saving…" : "Mark Complete"}
              </Button>
            )}
            {isAdmin && currentStatus === "COMPLETED" && (
              <Button
                variant="default" border={false}
                onClick={handleGetReviewLink}
                disabled={isSendingReview}
                className="rounded-xl px-4 py-2"
              >
                <Star size={14} className="mr-2" />
                {isSendingReview ? "Generating…" : "Get Review Link"}
              </Button>
            )}
            <Button
              variant="default" border={false}
              onClick={() => setIsEditModalOpen(true)}
              className="rounded-xl px-4 py-2"
            >
              <Pencil size={14} className="mr-2" /> Edit
            </Button>
            {isAdmin && (
              <Button
                variant="destructive" border={false}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className="rounded-xl px-4 py-2"
              >
                <Trash2 size={14} className="mr-2" /> Delete
              </Button>
            )}
          </div>
        </div>

        {/* Payment warning banner */}
        {showPayWarning && (
          <div className="banner banner-amber">
            <AlertTriangle size={18} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <strong>Payment outstanding.</strong> This job was completed but hasn't been paid.
              {!job.isCashJob ? ' Card may be on file — charge anytime.' : ''}
            </div>
            {isAdmin && !job.isCashJob && <ChargeButton jobId={job.id} amount={grossRevenue} compact />}
          </div>
        )}

        {/* Review link banner */}
        {reviewLink && (
          <div className="banner" style={{ background: '#ecfdf5', borderColor: '#6ee7b7', color: '#065f46' }}>
            <Star size={16} style={{ flex: '0 0 auto', color: '#10b981' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>Review link ready.</strong> Share this with the client:
              <div style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 4, wordBreak: 'break-all', opacity: 0.8 }}>
                {reviewLink}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyReviewLink}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 10px', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}
            >
              {reviewCopied ? <Check size={13} /> : <Copy size={13} />}
              {reviewCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="dtabs">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`dtab ${activeView === t.id ? 'active' : ''}`}
              onClick={() => updateView(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeView === 'details'    && <DetailsTab />}
        {activeView === 'financials' && <FinancialsTab />}
        {activeView === 'products'   && <ProductUsageTab />}
        {activeView === 'logs'       && <LogsTab />}
      </div>

      {/* Edit modal */}
      <JobModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        job={job as any}
        mode="edit"
        users={users}
        clients={clients}
        onSubmit={handleSubmit}
        onDelete={handleModalDelete}
      />

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <ConfirmDeleteModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          fileName={job.clientName || 'this job'}
          title="Delete Job"
          message="This action cannot be undone. All job data will be permanently removed."
        />
      )}

      {/* Photo lightbox */}
      {lightboxIdx !== null && photos[lightboxIdx] && (
        <div className="admin-lightbox" onClick={() => setLightboxIdx(null)}>
          <button type="button" className="admin-lightbox-close" onClick={() => setLightboxIdx(null)} aria-label="Close">
            <X size={18} />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i === null ? null : (i - 1 + photos.length) % photos.length); }}
                className="admin-lightbox-close"
                style={{ left: 24, right: 'auto' }}
                aria-label="Previous"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i === null ? null : (i + 1) % photos.length); }}
                className="admin-lightbox-close"
                style={{ right: 80 }}
                aria-label="Next"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[lightboxIdx].url} alt={photos[lightboxIdx].caption || 'Job photo'} style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain' }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Charge button ──────────────────────────────────────────────────────────────

function ChargeButton({ jobId, amount, compact }: { jobId: string; amount: number; compact?: boolean }) {
  const [busy,   setBusy]   = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleCharge() {
    if (!confirm(`Charge $${amount.toFixed(2)} to the client's saved card?`)) return;
    setBusy(true);
    setResult(null);
    const res = await chargeJob(jobId);
    setBusy(false);
    setResult({ ok: res.success, msg: res.success ? `Charged $${(res as any).amount?.toFixed(2)}` : ((res as any).error ?? 'Failed') });
  }

  if (result?.ok) {
    return <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--emerald-600)', background: 'var(--emerald-100)', padding: '4px 12px', borderRadius: 8 }}>{result.msg}</span>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {result && <span style={{ fontSize: 12, color: 'var(--error)' }}>{result.msg}</span>}
      <button
        type="button"
        onClick={handleCharge}
        disabled={busy}
        style={{ fontSize: compact ? 12 : 13, fontWeight: 600, background: '#d97706', color: '#fff', border: 0, borderRadius: 8, padding: compact ? '4px 12px' : '8px 16px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
      >
        {busy ? 'Charging…' : `Charge · $${amount.toFixed(2)}`}
      </button>
    </div>
  );
}
