"use client";

import { useEffect, useState } from "react";
import { DollarSign, Download, FileText } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  getIncomeData,
  type IncomeData,
} from "../../actions/getIncomeData";
import { generateTaxSummary } from "../../actions/generateTaxSummary";
import { SectionCard } from "./_shared";

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  });
}

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface IncomeSectionProps {
  employeeId?: string;
}

export default function IncomeSection({ employeeId }: IncomeSectionProps) {
  const [data, setData] = useState<IncomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await getIncomeData({ employeeId });
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

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const res = await generateTaxSummary({ employeeId });
      if (!res.success) {
        setError(res.error);
        return;
      }

      const summary = res.summary;
      const { pdf, Document, Page, Text, View, StyleSheet } = await import(
        "@react-pdf/renderer"
      );

      const styles = StyleSheet.create({
        page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 20,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#005F6A",
        },
        title: { fontSize: 18, color: "#005F6A" },
        meta: { fontSize: 9, color: "#666" },
        section: { marginBottom: 14 },
        sectionTitle: {
          fontSize: 9,
          textTransform: "uppercase",
          color: "#888",
          marginBottom: 6,
          letterSpacing: 1,
        },
        kpis: { flexDirection: "row", gap: 12, marginBottom: 14 },
        kpiBox: {
          flex: 1,
          padding: 10,
          backgroundColor: "#f3f7f8",
          borderRadius: 6,
        },
        kpiLabel: { fontSize: 8, color: "#666", marginBottom: 3 },
        kpiValue: { fontSize: 14, color: "#005F6A" },
        tableHeader: {
          flexDirection: "row",
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: "#ccc",
          fontSize: 9,
          color: "#666",
          textTransform: "uppercase",
        },
        tableRow: {
          flexDirection: "row",
          paddingVertical: 6,
          borderBottomWidth: 0.5,
          borderBottomColor: "#eee",
        },
        col1: { flex: 3 },
        col2: { flex: 1, textAlign: "right" },
        col3: { flex: 1, textAlign: "right" },
        col4: { flex: 1, textAlign: "right" },
        total: {
          flexDirection: "row",
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: "#005F6A",
          marginTop: 8,
          fontSize: 12,
        },
        footer: {
          marginTop: 24,
          paddingTop: 10,
          borderTopWidth: 0.5,
          borderTopColor: "#ccc",
          fontSize: 8,
          color: "#888",
        },
      });

      const doc = (
        <Document>
          <Page size="A4" style={styles.page}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>TAX SUMMARY {summary.year}</Text>
                <Text style={styles.meta}>{summary.documentNumber}</Text>
                <Text style={styles.meta}>
                  Generated {formatDate(summary.generatedAt)}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 14, color: "#005F6A" }}>Cleano</Text>
                <Text style={styles.meta}>Annual Income Statement</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recipient</Text>
              <Text>{summary.employee.name}</Text>
              <Text style={styles.meta}>{summary.employee.email}</Text>
              {summary.employee.phone ? (
                <Text style={styles.meta}>{summary.employee.phone}</Text>
              ) : null}
            </View>

            <View style={styles.kpis}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>GROSS INCOME</Text>
                <Text style={styles.kpiValue}>
                  {formatCurrency(summary.grossIncome)}
                </Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>NET INCOME</Text>
                <Text style={styles.kpiValue}>
                  {formatCurrency(summary.netIncome)}
                </Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>
                  EST. TAXES ({(summary.estimatedTaxRate * 100).toFixed(1)}%)
                </Text>
                <Text style={styles.kpiValue}>
                  {formatCurrency(summary.estimatedTaxes)}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pay Periods (PAID)</Text>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>Period</Text>
                <Text style={styles.col2}>Jobs</Text>
                <Text style={styles.col3}>Hours</Text>
                <Text style={styles.col4}>Net</Text>
              </View>
              {summary.payPeriods.map((p) => (
                <View key={p.payoutId} style={styles.tableRow}>
                  <Text style={styles.col1}>
                    {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                  </Text>
                  <Text style={styles.col2}>{p.jobCount}</Text>
                  <Text style={styles.col3}>{p.totalHours.toFixed(1)}</Text>
                  <Text style={styles.col4}>
                    {formatCurrency(p.finalAmount)}
                  </Text>
                </View>
              ))}
              <View style={styles.total}>
                <Text style={styles.col1}>Total</Text>
                <Text style={styles.col2}>{summary.jobsCompleted}</Text>
                <Text style={styles.col3}>
                  {summary.totalHours.toFixed(1)}
                </Text>
                <Text style={styles.col4}>
                  {formatCurrency(summary.netIncome)}
                </Text>
              </View>
            </View>

            <View style={styles.footer}>
              <Text>
                Estimated taxes are an approximation only and not an official
                tax document. Consult a tax professional before filing.
              </Text>
            </View>
          </Page>
        </Document>
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${summary.documentNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <SectionCard title="My Income" icon={DollarSign}>
        <p className="text-sm text-[#005F6A]/60">Loading income...</p>
      </SectionCard>
    );
  }

  if (error || !data) {
    return (
      <SectionCard title="My Income" icon={DollarSign}>
        <p className="text-sm text-red-600">
          {error ?? "Could not load income data."}
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title={`Year-To-Date Earnings (${data.year})`}
        description="Earnings from PAID payouts and estimated taxes."
        icon={DollarSign}
        actions={
          <Button
            variant="cleano"
            submit={false}
            onClick={handleDownload}
            disabled={downloading}>
            <Download className="w-4 h-4 mr-1" />
            {downloading ? "Generating..." : "Download Tax Summary"}
          </Button>
        }>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Gross YTD" value={formatCurrency(data.grossYTD)} />
          <Stat
            label="Net Income"
            value={formatCurrency(data.netYTD)}
            highlight
          />
          <Stat
            label={`Est. Taxes (${(data.estimatedTaxRate * 100).toFixed(1)}%)`}
            value={formatCurrency(data.estimatedTaxes)}
            tone="amber"
          />
          <Stat
            label="Cleano Deductions"
            value={formatCurrency(data.deductionsYTD)}
            tone="red"
          />
          <Stat
            label="Adjustments"
            value={formatCurrency(data.adjustmentsYTD)}
            tone="blue"
          />
          <Stat
            label="Reimbursements"
            value={formatCurrency(data.reimbursementsYTD)}
          />
          <Stat
            label="Hours Worked"
            value={`${data.totalHoursYTD.toFixed(1)}h`}
          />
          <Stat
            label="Jobs Completed"
            value={data.jobsCompletedYTD.toString()}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Other Activity"
        description="Pending earnings and withdrawals this year."
        icon={FileText}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat
            label="Pending Pay"
            value={formatCurrency(data.pendingAmount)}
          />
          <Stat
            label="Withdrawn YTD"
            value={formatCurrency(data.withdrawnYTD)}
          />
          <Stat
            label="Paid Periods"
            value={data.paidPayoutCount.toString()}
          />
        </div>
        <p className="text-[11px] text-[#005F6A]/60 mt-3">
          Estimated taxes are an approximation; not an official tax document.
        </p>
      </SectionCard>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "amber" | "red" | "blue";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-600"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "blue"
          ? "text-blue-600"
          : "text-[#005F6A]";
  return (
    <div className="rounded-2xl bg-[#005F6A]/5 p-4">
      <p className="text-[10px] uppercase tracking-wider text-[#005F6A]/50 mb-1">
        {label}
      </p>
      <p
        className={`text-xl font-[400] ${toneClass} ${
          highlight ? "font-[500]" : ""
        }`}>
        {value}
      </p>
    </div>
  );
}
