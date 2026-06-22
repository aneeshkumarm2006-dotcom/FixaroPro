import { db } from "@/db";
import { requireCleaner } from "@/lib/page-guards";
import MyPayClient from "./MyPayClient";
import { getEmployeeAvgRating } from "../actions/setEmployeeRating";

export default async function MyPayPage() {
  const session = await requireCleaner();
  const userId = session.user.id;

  const [payouts, withdrawals, starRating, ragWashes, ragCreditSetting] = await Promise.all([
    db.payout.findMany({
      where: { employeeId: userId },
      include: { payPeriod: true },
      orderBy: { payPeriod: { startDate: "desc" } },
    }),
    db.withdrawal.findMany({
      where: { employeeId: userId },
      orderBy: { createdAt: "desc" },
    }),
    getEmployeeAvgRating(userId),
    db.ragWash.findMany({
      where: { employeeId: userId },
      orderBy: { washDate: "desc" },
    }),
    db.appSetting.findUnique({ where: { key: "payroll.ragCreditPerRag" } }),
  ]);

  const currentPayout =
    payouts.find(
      (p) => p.payPeriod.status === "DRAFT" || p.payPeriod.status === "APPROVED"
    ) ?? null;

  const paidPayouts = payouts.filter((p) => p.payPeriod.status === "PAID");
  const walletBalance = paidPayouts.reduce((sum, p) => sum + p.finalAmount, 0);
  const pendingAmount = payouts
    .filter(
      (p) =>
        p.payPeriod.status === "DRAFT" || p.payPeriod.status === "APPROVED"
    )
    .reduce((sum, p) => sum + p.finalAmount, 0);

  // Reserved = withdrawals not rejected
  const reservedTotal = withdrawals
    .filter(
      (w) =>
        w.status === "PENDING" ||
        w.status === "APPROVED" ||
        w.status === "COMPLETED"
    )
    .reduce((sum, w) => sum + w.amount, 0);

  const availableBalance = Math.max(0, walletBalance - reservedTotal);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const paidThisYear = paidPayouts
    .filter((p) => p.payPeriod.paidAt && p.payPeriod.paidAt >= yearStart)
    .reduce((sum, p) => sum + p.finalAmount, 0);
  const totalHoursYear = paidPayouts
    .filter((p) => p.payPeriod.paidAt && p.payPeriod.paidAt >= yearStart)
    .reduce((sum, p) => sum + p.totalHours, 0);

  // Rag credit rate (default $0.50 per rag)
  const ragCreditRate =
    typeof (ragCreditSetting?.value as Record<string, unknown> | null)?.rate === "number"
      ? (ragCreditSetting!.value as Record<string, unknown>).rate as number
      : 0.5;

  const allTimeRags = ragWashes.reduce((s, w) => s + w.ragCount, 0);
  const allTimeCredit = Math.round(allTimeRags * ragCreditRate * 100) / 100;

  // Rag washes during the current pay period
  const currentPeriodStart = currentPayout
    ? new Date(currentPayout.payPeriod.startDate)
    : null;
  const currentPeriodEnd = currentPayout
    ? new Date(currentPayout.payPeriod.endDate)
    : null;

  // Rag Wash credits removed from Fixaro (SOP §9) — no ragData passed to the client.

  // Serialize Dates to strings for client component
  const serializePayout = (p: (typeof payouts)[number]) => ({
    id: p.id,
    baseAmount: p.baseAmount,
    adjustments: p.adjustments,
    deductions: p.deductions,
    reimbursements: p.reimbursements,
    finalAmount: p.finalAmount,
    jobCount: p.jobCount,
    totalHours: p.totalHours,
    payPeriod: {
      startDate: p.payPeriod.startDate.toISOString(),
      endDate: p.payPeriod.endDate.toISOString(),
      status: p.payPeriod.status,
      paidAt: p.payPeriod.paidAt ? p.payPeriod.paidAt.toISOString() : null,
    },
  });

  return (
    <MyPayClient
      payouts={payouts.map(serializePayout)}
      withdrawals={withdrawals.map((w) => ({
        id: w.id,
        amount: w.amount,
        status: w.status,
        paymentMethod: w.paymentMethod,
        createdAt: w.createdAt.toISOString(),
        processedAt: w.processedAt ? w.processedAt.toISOString() : null,
        notes: w.notes,
      }))}
      walletBalance={walletBalance}
      pendingAmount={pendingAmount}
      paidThisYear={paidThisYear}
      totalHoursYear={totalHoursYear}
      availableBalance={availableBalance}
      currentPayout={currentPayout ? serializePayout(currentPayout) : null}
      year={now.getFullYear()}
      starRating={starRating}
    />
  );
}
