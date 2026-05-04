"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  FileText,
  DollarSign,
  AlertTriangle,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ChevronDown,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Loader,
  Eye,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import CustomDropdown from "@/components/ui/custom-dropdown";
import CreateInvoiceModal from "./CreateInvoiceModal";
import { sendInvoice } from "../actions/sendInvoice";
import { updateInvoice } from "../actions/updateInvoice";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  jobId: string | null;
  jobClientName: string | null;
  jobType: string | null;
  jobDate: string | null;
  subtotal: number;
  gstAmount: number;
  qstAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
  dueDate: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
  lineItems: LineItem[];
}

interface ClientOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface InvoicesPageClientProps {
  invoices: Invoice[];
  clients: ClientOption[];
  taxConfig: {
    gstRate: number;
    qstRate: number;
    gstNumber: string;
    qstNumber: string;
  };
}

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Sent", value: "SENT" },
  { label: "Paid", value: "PAID" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function InvoicesPageClient({
  invoices,
  clients,
  taxConfig,
}: InvoicesPageClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const totalRevenue = invoices
      .filter((i) => i.status === "PAID")
      .reduce((sum, i) => sum + i.totalAmount, 0);
    const pendingAmount = invoices
      .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
      .reduce((sum, i) => sum + i.totalAmount, 0);
    const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;
    return { totalInvoices, totalRevenue, pendingAmount, overdueCount };
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (clientFilter && inv.clientId !== clientFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.clientName.toLowerCase().includes(q) ||
          (inv.notes?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [invoices, searchTerm, statusFilter, clientFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const startIdx = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(startIdx, startIdx + rowsPerPage);

  const goToPage = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));

  const handleSend = async (invoiceId: string) => {
    setSendingId(invoiceId);
    const result = await sendInvoice(invoiceId);
    setSendingId(null);
    if (!result.success) {
      setErrorMsg(result.error || "Failed to send invoice");
    } else {
      router.refresh();
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    setMarkingPaidId(invoiceId);
    const result = await updateInvoice({ id: invoiceId, status: "PAID" });
    setMarkingPaidId(null);
    if (!result.success) {
      setErrorMsg(result.error || "Failed to mark as paid");
    } else {
      router.refresh();
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "warning" | "success" | "error" | "cleano" | "secondary"; label: string }> = {
      DRAFT: { variant: "default", label: "Draft" },
      SENT: { variant: "secondary", label: "Sent" },
      PAID: { variant: "success", label: "Paid" },
      OVERDUE: { variant: "warning", label: "Overdue" },
      CANCELLED: { variant: "error", label: "Cancelled" },
    };
    const c = config[status] || { variant: "default" as const, label: status };
    return <Badge variant={c.variant} size="sm">{c.label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "DRAFT": return <FileText className="w-3.5 h-3.5 text-gray-400" />;
      case "SENT": return <Send className="w-3.5 h-3.5 text-blue-500" />;
      case "PAID": return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case "OVERDUE": return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
      case "CANCELLED": return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      default: return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const MetricCard = ({
    label,
    value,
    variant = "default",
  }: {
    label: string;
    value: string;
    variant?: "default" | "warning";
  }) => (
    <Card
      variant={variant === "warning" ? "warning" : "cleano_light"}
      className="p-6 h-[7rem]">
      <div className="h-full flex flex-col justify-between">
        <span className={`app-title-small ${variant === "warning" ? "text-yellow-700" : "!text-[#005F6A]/70"}`}>
          {label}
        </span>
        <p className={`h2-title ${variant === "warning" ? "text-yellow-700" : "text-[#005F6A]"}`}>
          {value}
        </p>
      </div>
    </Card>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl !font-light tracking-tight text-[#005F6A]">
            Invoices
          </h1>
          <p className="text-sm text-[#005F6A]/70 !font-light mt-1">
            Create, send, and track invoices for your clients
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          border={false}
          onClick={() => setIsModalOpen(true)}
          className="rounded-2xl px-6 py-3">
          <Plus className="w-4 h-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Invoices" value={String(stats.totalInvoices)} />
        <MetricCard label="Collected" value={`$${stats.totalRevenue.toFixed(2)}`} />
        <MetricCard label="Pending" value={`$${stats.pendingAmount.toFixed(2)}`} />
        {stats.overdueCount > 0 ? (
          <MetricCard label="Overdue" value={String(stats.overdueCount)} variant="warning" />
        ) : (
          <MetricCard label="Overdue" value="0" />
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
          <div className="flex-1 text-sm text-red-700">{errorMsg}</div>
          <button className="text-xs text-red-600 underline" onClick={() => setErrorMsg(null)}>
            dismiss
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-2 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#005F6A]/60 z-[100] w-4 h-4" />
          <Input
            placeholder="Search by invoice number, client name..."
            value={searchTerm}
            size="md"
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-10 h-[42px] py-3 placeholder:!text-[#005F6A]/40 placeholder:!font-[350]"
            variant="form"
            border={false}
          />
        </div>
        <CustomDropdown
          trigger={
            <Button variant="default" size="md" border={false} className="min-w-36 h-[42px] px-4 py-3 flex items-center justify-between w-fit">
              <span className="text-sm font-[350]">
                {STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label || "All Statuses"}
              </span>
              <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
            </Button>
          }
          options={STATUS_OPTIONS.map((s) => ({
            label: s.label,
            onClick: () => { setStatusFilter(s.value); setPage(1); },
          }))}
          maxHeight="12rem"
        />
        <CustomDropdown
          trigger={
            <Button variant="default" size="md" border={false} className="min-w-36 h-[42px] px-4 py-3 flex items-center justify-between w-fit">
              <span className="text-sm font-[350] truncate max-w-[150px]">
                {clientFilter ? clients.find((c) => c.id === clientFilter)?.name || "Client" : "All Clients"}
              </span>
              <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
            </Button>
          }
          options={[
            { label: "All Clients", onClick: () => { setClientFilter(""); setPage(1); } },
            ...clients.map((c) => ({
              label: c.name,
              onClick: () => { setClientFilter(c.id); setPage(1); },
            })),
          ]}
          maxHeight="16rem"
        />
        <CustomDropdown
          trigger={
            <Button variant="default" size="md" border={false} className="min-w-20 h-[42px] px-4 py-3 flex items-center justify-between w-fit">
              <span className="text-sm font-[350]">{rowsPerPage} / page</span>
              <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
            </Button>
          }
          options={[5, 10, 25, 50].map((n) => ({
            label: String(n),
            onClick: () => { setRowsPerPage(n); setPage(1); },
          }))}
          maxHeight="12rem"
        />
      </div>

      {/* Table */}
      {total === 0 ? (
        <div className="bg-white rounded-2xl">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#005F6A]/5 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="w-8 h-8 text-[#005F6A]/40" />
            </div>
            <p className="text-sm font-[350] text-[#005F6A]/70">No invoices found</p>
            <p className="text-xs font-[350] text-[#005F6A]/60 mt-1">
              Create your first invoice to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto rounded-t-2xl">
            <div className="min-w-max">
              <div className="flex bg-[#005F6A]/5 rounded-t-2xl">
                {[
                  { label: "Invoice #", className: "w-[160px] text-left" },
                  { label: "Client", className: "w-[200px] text-left" },
                  { label: "Date", className: "w-[120px] text-left" },
                  { label: "Due Date", className: "w-[120px] text-left" },
                  { label: "Amount", className: "w-[120px] text-right" },
                  { label: "Status", className: "w-[110px] text-center" },
                  { label: "Actions", className: "w-[220px] text-left" },
                ].map((col) => (
                  <div
                    key={col.label}
                    className={`p-4 text-xs font-[350] !text-[#005F6A]/40 uppercase !tracking-wider ${col.className}`}>
                    {col.label}
                  </div>
                ))}
              </div>

              <div className="divide-y divide-[#005F6A]/4">
                {paginated.map((inv) => (
                  <div key={inv.id} className="flex items-center hover:bg-[#005F6A]/1 transition-colors">
                    <div className="w-[160px] p-4">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="app-title-small text-[#005F6A] hover:underline flex items-center gap-1.5">
                        {getStatusIcon(inv.status)}
                        {inv.invoiceNumber}
                      </Link>
                    </div>

                    <div className="w-[200px] p-4">
                      <p className="app-title-small text-[#005F6A] truncate">{inv.clientName}</p>
                      {inv.jobId && (
                        <p className="text-[10px] text-[#005F6A]/50 truncate">
                          Job: {inv.jobType || "—"}{inv.jobDate ? ` · ${new Date(inv.jobDate).toLocaleDateString()}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="w-[120px] p-4">
                      <span className="app-title-small !text-[#005F6A]/60 text-xs">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="w-[120px] p-4">
                      <span className="app-title-small !text-[#005F6A]/60 text-xs">
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                      </span>
                    </div>

                    <div className="w-[120px] p-4 text-right">
                      <span className="app-title-small !text-[#005F6A]">
                        ${inv.totalAmount.toFixed(2)}
                      </span>
                    </div>

                    <div className="w-[110px] p-4 text-center">
                      {getStatusBadge(inv.status)}
                    </div>

                    <div className="w-[220px] p-4 flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        border={false}
                        href={`/invoices/${inv.id}`}
                        className="rounded-2xl px-3 py-2">
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      {inv.status === "DRAFT" && (
                        <Button
                          variant="default"
                          size="sm"
                          border={false}
                          disabled={sendingId === inv.id}
                          onClick={() => handleSend(inv.id)}
                          className="rounded-2xl px-3 py-2">
                          {sendingId === inv.id ? (
                            <Loader className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Send className="w-3 h-3 mr-1" />
                          )}
                          Send
                        </Button>
                      )}
                      {(inv.status === "SENT" || inv.status === "OVERDUE") && (
                        <Button
                          variant="default"
                          size="sm"
                          border={false}
                          disabled={markingPaidId === inv.id}
                          onClick={() => handleMarkPaid(inv.id)}
                          className="rounded-2xl px-3 py-2">
                          {markingPaidId === inv.id ? (
                            <Loader className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <DollarSign className="w-3 h-3 mr-1" />
                          )}
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3 p-4">
            {paginated.map((inv) => (
              <Card key={inv.id} variant="cleano_light" className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-sm font-[400] text-[#005F6A] hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                      <p className="text-xs text-[#005F6A]/60 mt-0.5">{inv.clientName}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-[400] text-[#005F6A]">
                        ${inv.totalAmount.toFixed(2)}
                      </span>
                      <div className="mt-1">{getStatusBadge(inv.status)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#005F6A]/60">
                    <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                    {inv.dueDate && <span>Due: {new Date(inv.dueDate).toLocaleDateString()}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      border={false}
                      href={`/invoices/${inv.id}`}
                      className="rounded-2xl px-4 py-2 flex-1">
                      View
                    </Button>
                    {inv.status === "DRAFT" && (
                      <Button
                        variant="default"
                        size="sm"
                        border={false}
                        disabled={sendingId === inv.id}
                        onClick={() => handleSend(inv.id)}
                        className="rounded-2xl px-4 py-2 flex-1">
                        {sendingId === inv.id ? "Sending..." : "Send"}
                      </Button>
                    )}
                    {(inv.status === "SENT" || inv.status === "OVERDUE") && (
                      <Button
                        variant="default"
                        size="sm"
                        border={false}
                        disabled={markingPaidId === inv.id}
                        onClick={() => handleMarkPaid(inv.id)}
                        className="rounded-2xl px-4 py-2 flex-1">
                        {markingPaidId === inv.id ? "Processing..." : "Mark Paid"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-2 px-3 bg-[#005F6A]/4 rounded-b-2xl">
            <div className="text-xs text-[#005F6A]/70 font-[350]">
              Showing {startIdx + 1} to {Math.min(startIdx + rowsPerPage, total)} of {total} invoices
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => goToPage(1)} disabled={page === 1} className="px-2">
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => goToPage(page - 1)} disabled={page === 1} className="px-2">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-[#005F6A]/70 px-2">
                Page {page} / {totalPages}
              </span>
              <Button variant="ghost" size="sm" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="px-2">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => goToPage(totalPages)} disabled={page >= totalPages} className="px-2">
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <CreateInvoiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clients={clients}
        taxConfig={taxConfig}
      />
    </div>
  );
}
