"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  Banknote,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowUpRight,
} from "lucide-react";
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
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-blue-50 text-blue-700",
  PAID: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};

type Tab = "current" | "history" | "income";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
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
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#005F6A] flex items-center justify-center">
            <Banknote className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl !font-light tracking-tight text-[#005F6A]">
              My Pay
            </h1>
            <p className="text-sm text-[#005F6A]/70 !font-light mt-1">
              Track your earnings and payment history
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            disabled={availableBalance <= 0}
            className="text-left disabled:cursor-not-allowed">
            <Card
              variant="cleano_light"
              className="p-6 h-[7rem] hover:bg-[#005F6A]/10 transition-colors cursor-pointer disabled:cursor-not-allowed">
              <div className="h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="app-title-small !text-[#005F6A]/70">
                    Wallet Balance
                  </span>
                  <DollarSign className="w-4 h-4 text-[#005F6A]/50" />
                </div>
                <div className="flex items-end justify-between">
                  <p className="h2-title text-[#005F6A]">
                    ${walletBalance.toFixed(2)}
                  </p>
                  {availableBalance > 0 && (
                    <span className="text-[10px] uppercase tracking-wider text-[#005F6A]/50">
                      Tap to withdraw
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </button>

          <Card variant="cleano_light" className="p-6 h-[7rem]">
            <div className="h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="app-title-small !text-[#005F6A]/70">
                  Pending
                </span>
                <Clock className="w-4 h-4 text-[#005F6A]/50" />
              </div>
              <p className="h2-title text-[#005F6A]">
                ${pendingAmount.toFixed(2)}
              </p>
            </div>
          </Card>

          <Card variant="cleano_light" className="p-6 h-[7rem]">
            <div className="h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="app-title-small !text-[#005F6A]/70">
                  Earned {year}
                </span>
                <TrendingUp className="w-4 h-4 text-[#005F6A]/50" />
              </div>
              <p className="h2-title text-[#005F6A]">
                ${paidThisYear.toFixed(2)}
              </p>
            </div>
          </Card>

          <Card variant="cleano_light" className="p-6 h-[7rem]">
            <div className="h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="app-title-small !text-[#005F6A]/70">
                  Hours {year}
                </span>
                <Clock className="w-4 h-4 text-[#005F6A]/50" />
              </div>
              <p className="h2-title text-[#005F6A]">
                {totalHoursYear.toFixed(1)}h
              </p>
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 bg-[#005F6A]/5 rounded-2xl p-1">
            {[
              { id: "current" as const, label: "Current Period" },
              { id: "history" as const, label: "Payment History" },
              { id: "income" as const, label: "Income" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm transition-colors ${
                  tab === t.id
                    ? "bg-white text-[#005F6A] font-[500] shadow-sm"
                    : "text-[#005F6A]/60 hover:text-[#005F6A]"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <Button
            variant="action"
            submit={false}
            size="md"
            onClick={() => setWithdrawOpen(true)}
            disabled={availableBalance <= 0}>
            <ArrowUpRight className="w-4 h-4 mr-1" />
            Withdraw
          </Button>
        </div>

        {tab === "current" && (
          <>
            {currentPayout ? (
              <Card variant="cleano_light" className="p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-[#005F6A]" />
                  <h2 className="text-lg font-[400] text-[#005F6A]">
                    Current Pay Period
                  </h2>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-[500] ${STATUS_STYLES[currentPayout.payPeriod.status]}`}>
                    {currentPayout.payPeriod.status}
                  </span>
                </div>
                <p className="text-sm text-[#005F6A]/70 mb-4">
                  {formatDate(currentPayout.payPeriod.startDate)} —{" "}
                  {formatDate(currentPayout.payPeriod.endDate)}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#005F6A]/50 font-[400]">
                      Base
                    </p>
                    <p className="text-lg font-[400] text-[#005F6A]">
                      ${currentPayout.baseAmount.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#005F6A]/50 font-[400]">
                      Adjustments
                    </p>
                    <p className="text-lg font-[400] text-blue-600">
                      ${currentPayout.adjustments.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#005F6A]/50 font-[400]">
                      Deductions
                    </p>
                    <p className="text-lg font-[400] text-red-600">
                      -${currentPayout.deductions.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#005F6A]/50 font-[400]">
                      Final
                    </p>
                    <p className="text-lg font-[500] text-[#005F6A]">
                      ${currentPayout.finalAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#005F6A]/10 flex items-center gap-4 text-xs text-[#005F6A]/60">
                  <span>{currentPayout.jobCount} jobs</span>
                  <span>·</span>
                  <span>{currentPayout.totalHours.toFixed(1)} hours</span>
                </div>
              </Card>
            ) : (
              <Card variant="cleano_light" className="p-6 mb-6">
                <div className="text-center py-6">
                  <Calendar className="w-8 h-8 text-[#005F6A]/30 mx-auto mb-2" />
                  <p className="text-sm text-[#005F6A]/70">
                    No active pay period
                  </p>
                </div>
              </Card>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card variant="cleano_light" className="p-6">
              <p className="text-xs uppercase tracking-wider text-[#005F6A]/50 mb-1">
                Gross Pay {year}
              </p>
              <p className="text-2xl font-[400] text-[#005F6A]">
                ${grossPay.toFixed(2)}
              </p>
              <p className="text-xs text-[#005F6A]/60 mt-2">
                Sum of base amounts on PAID payouts
              </p>
            </Card>
            <Card variant="cleano_light" className="p-6">
              <p className="text-xs uppercase tracking-wider text-[#005F6A]/50 mb-1">
                Net Pay {year}
              </p>
              <p className="text-2xl font-[400] text-[#005F6A]">
                ${paidThisYear.toFixed(2)}
              </p>
              <p className="text-xs text-[#005F6A]/60 mt-2">
                After adjustments and deductions
              </p>
            </Card>
            <Card variant="cleano_light" className="p-6">
              <p className="text-xs uppercase tracking-wider text-[#005F6A]/50 mb-1">
                Adjustments
              </p>
              <p className="text-2xl font-[400] text-blue-600">
                ${totalAdjustments.toFixed(2)}
              </p>
            </Card>
            <Card variant="cleano_light" className="p-6">
              <p className="text-xs uppercase tracking-wider text-[#005F6A]/50 mb-1">
                Deductions
              </p>
              <p className="text-2xl font-[400] text-red-600">
                ${totalDeductions.toFixed(2)}
              </p>
            </Card>
            <Card variant="cleano_light" className="p-6">
              <p className="text-xs uppercase tracking-wider text-[#005F6A]/50 mb-1">
                Reimbursements
              </p>
              <p className="text-2xl font-[400] text-[#005F6A]">
                ${totalReimbursements.toFixed(2)}
              </p>
            </Card>
            <Card variant="cleano_light" className="p-6">
              <p className="text-xs uppercase tracking-wider text-[#005F6A]/50 mb-1">
                Hours Worked
              </p>
              <p className="text-2xl font-[400] text-[#005F6A]">
                {totalHoursYear.toFixed(1)}h
              </p>
            </Card>
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
