"use client";

import { useState } from "react";
import { Calendar, ArrowUpRight, Star } from "lucide-react";
import WithdrawModal from "./WithdrawModal";
import PaymentHistory from "./PaymentHistory";
import ProviderInvoiceView from "./ProviderInvoiceView";

type PayPeriod = {
  startDate: string;
  endDate: string;
  status: string;
  paidAt: string | null;
};

type Payout = {
  id: string;
  baseAmount: number;
  adjustments: number;
  deductions: number;
  reimbursements: number;
  finalAmount: number;
  jobCount: number;
  totalHours: number;
  payPeriod: PayPeriod;
};

type Withdrawal = {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
  processedAt: string | null;
  notes: string | null;
};

interface MyPayClientProps {
  payouts: Payout[];
  withdrawals: Withdrawal[];
  walletBalance: number;
  pendingAmount: number;
  paidThisYear: number;
  totalHoursYear: number;
  availableBalance: number;
  currentPayout: Payout | null;
  year: number;
  starRating?: number | null;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-blue-50 text-blue-700",
  PAID: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};

type Tab = "current" | "history" | "income";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyPayClient({
  payouts,
  withdrawals,
  walletBalance,
  pendingAmount,
  paidThisYear,
  totalHoursYear,
  availableBalance,
  currentPayout,
  year,
  starRating,
}: MyPayClientProps) {
  const [tab, setTab] = useState<Tab>("current");
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const totalDeductions = payouts.reduce((sum, p) => sum + p.deductions, 0);
  const totalAdjustments = payouts.reduce((sum, p) => sum + p.adjustments, 0);
  const totalReimbursements = payouts.reduce(
    (sum, p) => sum + p.reimbursements,
    0
  );
  const grossPay = payouts
    .filter((p) => p.payPeriod.status === "PAID")
    .reduce((sum, p) => sum + p.baseAmount, 0);

  // Convert withdrawals to history shape (Date objects)
  const historyPayouts = payouts.map((p) => ({
    id: p.id,
    finalAmount: p.finalAmount,
    payPeriod: {
      startDate: p.payPeriod.startDate,
      endDate: p.payPeriod.endDate,
      status: p.payPeriod.status,
      paidAt: p.payPeriod.paidAt,
    },
  }));

  return (
    <div className="cl-page-wrap">
      <div>
        <div className="cl-page-head">
          <div>
            <h1 className="cl-page-title">My pay</h1>
            <p className="cl-page-sub">Track your earnings and payment history.</p>
          </div>
        </div>

        {/* Star Rating (read-only) */}
        {starRating != null && (
          <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-[600] text-amber-800">
                Your Rating: {Math.min(5, Math.max(4, Math.round(starRating * 10) / 10)).toFixed(1)} / 5.0
              </p>
              <p className="text-xs text-amber-700/70">Based on customer feedback and performance</p>
            </div>
            <div className="flex gap-0.5 ml-auto">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${s <= Math.round(Math.min(5, Math.max(4, starRating))) ? "text-amber-400 fill-amber-400" : "text-amber-200 fill-amber-200"}`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="cl-pay-hero">
          <div
            className={`cl-pay-tile featured${availableBalance > 0 ? " clickable" : ""}`}
            onClick={availableBalance > 0 ? () => setWithdrawOpen(true) : undefined}
            style={availableBalance > 0 ? { cursor: "pointer" } : undefined}>
            <div className="cl-pay-tile-head">
              <span>Wallet balance</span>
              <span>$</span>
            </div>
            <div className="cl-pay-tile-val">${walletBalance.toFixed(2)}</div>
            {availableBalance > 0 && (
              <div className="cl-pay-tile-cta">Tap to withdraw →</div>
            )}
          </div>
          <div className="cl-pay-tile">
            <div className="cl-pay-tile-head"><span>Pending</span></div>
            <div className="cl-pay-tile-val">${pendingAmount.toFixed(2)}</div>
          </div>
          <div className="cl-pay-tile">
            <div className="cl-pay-tile-head"><span>Earned {year}</span></div>
            <div className="cl-pay-tile-val">${paidThisYear.toFixed(2)}</div>
          </div>
          <div className="cl-pay-tile">
            <div className="cl-pay-tile-head"><span>Hours {year}</span></div>
            <div className="cl-pay-tile-val">{totalHoursYear.toFixed(1)}h</div>
          </div>
        </div>

        <div className="cl-pay-tabs">
          <button className={`cl-pay-tab ${tab === "current" ? "active" : ""}`} onClick={() => setTab("current")}>Current period</button>
          <button className={`cl-pay-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>Payment history</button>
          <button className={`cl-pay-tab ${tab === "income" ? "active" : ""}`} onClick={() => setTab("income")}>Income</button>
          <div className="cl-pay-tabs-spacer" />
          <button className="cl-pay-withdraw" onClick={() => setWithdrawOpen(true)}>
            <ArrowUpRight size={12} /> Withdraw
          </button>
        </div>

        {tab === "current" && (
          <>
            {currentPayout ? (
              <div className="cl-block">
                <div className="cl-block-head">
                  <h2 className="cl-block-title">
                    <Calendar className="w-5 h-5" style={{ color: "var(--primary)" }} />
                    Current Pay Period
                  </h2>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-[500] ${STATUS_STYLES[currentPayout.payPeriod.status]}`}>
                    {currentPayout.payPeriod.status}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--primary-60)", margin: 0 }}>
                  {formatDate(currentPayout.payPeriod.startDate)} — {formatDate(currentPayout.payPeriod.endDate)}
                </p>
                <div className="cl-block-stats">
                  <div>
                    <div className="cl-block-stat-label">Base</div>
                    <div className="cl-block-stat-val">${currentPayout.baseAmount.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="cl-block-stat-label">Adjustments</div>
                    <div className="cl-block-stat-val" style={{ color: "#2563eb" }}>${currentPayout.adjustments.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="cl-block-stat-label">Deductions</div>
                    <div className="cl-block-stat-val" style={{ color: "#dc2626" }}>-${currentPayout.deductions.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="cl-block-stat-label">Final</div>
                    <div className="cl-block-stat-val pos">${currentPayout.finalAmount.toFixed(2)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--primary-60)", paddingTop: 4, borderTop: "1px solid rgba(232,93,4,0.07)" }}>
                  <span>{currentPayout.jobCount} jobs</span>
                  <span>·</span>
                  <span>{currentPayout.totalHours.toFixed(1)} hours</span>
                </div>
              </div>
            ) : (
              <div className="cl-empty-block" style={{ marginBottom: 14 }}>
                <div className="icon-bubble">
                  <Calendar size={28} />
                </div>
                <p style={{ margin: 0, color: "var(--ink-soft)" }}>No active pay period</p>
              </div>
            )}

            <ProviderInvoiceView />
          </>
        )}

        {tab === "history" && (
          <PaymentHistory
            payouts={historyPayouts}
            withdrawals={withdrawals}
          />
        )}

        {tab === "income" && (
          <div className="cl-income-grid">
            <div className="cl-income-tile">
              <div className="label">Gross pay {year}</div>
              <div className="val">${grossPay.toFixed(2)}</div>
              <div className="hint">Sum of base amounts on PAID payouts</div>
            </div>
            <div className="cl-income-tile">
              <div className="label">Net pay {year}</div>
              <div className="val">${paidThisYear.toFixed(2)}</div>
              <div className="hint">After adjustments and deductions</div>
            </div>
            <div className="cl-income-tile">
              <div className="label">Adjustments</div>
              <div className="val accent">${totalAdjustments.toFixed(2)}</div>
            </div>
            <div className="cl-income-tile">
              <div className="label">Deductions</div>
              <div className="val neg">-${totalDeductions.toFixed(2)}</div>
            </div>
            <div className="cl-income-tile">
              <div className="label">Reimbursements</div>
              <div className="val">${totalReimbursements.toFixed(2)}</div>
            </div>
            <div className="cl-income-tile">
              <div className="label">Hours worked</div>
              <div className="val">{totalHoursYear.toFixed(1)}h</div>
            </div>
          </div>
        )}
      </div>

      <WithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        availableBalance={availableBalance}
      />
    </div>
  );
}
