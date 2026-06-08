"use client";

import React, { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, Resolver, SubmitHandler, useForm } from "react-hook-form";
import {
  X,
  Briefcase,
  Loader,
  Trash2,
  DollarSign,
  MapPin,
  FileText,
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  ChevronDown,
  Hash,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import CustomDropdown from "@/components/ui/custom-dropdown";
import SmartSearch from "@/components/SmartSearch";
import SaveCardOnFile from "./SaveCardOnFile";

interface User {
  id: string;
  name: string;
  email: string;
}

interface Job {
  id: string;
  clientName: string;
  clientId?: string | null;
  location: string | null;
  apartmentNumber?: string | null;
  description: string | null;
  jobType: string | null;
  jobDate: string | null;
  startTime: string;
  endTime: string | null;
  price: number | null;
  employeePay: number | null;
  totalTip: number | null;
  parking: number | null;
  notes: string | null;
  paymentType?: string | null;
  discountAmount?: number | null;
  bedCount?: number | null;
  bathCount?: number | null;
  halfBathCount?: number | null;
  payRateMultiplier?: number | null;
  cleaners: Array<{ id: string; name: string }>;
  addOns?: Array<{ id: string; name: string; price: number }>;
}

interface ClientLite {
  id: string;
  name: string;
  email?: string | null;
  address?: string | null;
  discountPercent?: number | null;
  defaultPaymentMethodId?: string | null;
}

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  job?: Job | null;
  mode: "create" | "edit";
  users: User[];
  clients?: ClientLite[];
  onSubmit: (data: FormData) => Promise<{ success?: boolean; error?: string }>;
  onDelete?: (jobId: string) => Promise<{ success?: boolean; error?: string }>;
}

const formSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  location: z.string().optional(),
  apartmentNumber: z.string().optional(),
  description: z.string().optional(),
  jobType: z.string().optional(),
  startDate: z.string().optional(),
  startTime: z.string().optional(),
  price: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  employeePay: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  totalTip: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  parking: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  notes: z.string().optional(),
  bedCount: z.union([z.coerce.number().int().min(0), z.literal("")]).optional(),
  bathCount: z.union([z.coerce.number().int().min(0), z.literal("")]).optional(),
  halfBathCount: z.union([z.coerce.number().int().min(0), z.literal("")]).optional(),
  discountAmount: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const jobTypes = [
  { value: "", label: "Select type" },
  { value: "R", label: "Residential" },
  { value: "C", label: "Commercial" },
  { value: "PC", label: "Post-Construction" },
  { value: "F", label: "Follow-up" },
];

const STEPS = [
  { id: 1, title: "Basic Info", icon: Briefcase },
  { id: 2, title: "Schedule & Team", icon: Calendar },
  { id: 3, title: "Pricing & Notes", icon: DollarSign },
];

type CustomDatePickerProps = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

const toISODate = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;

function CustomDatePicker({
  label,
  value,
  onChange,
  placeholder = "Select date",
  disabled,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(
    value ? new Date(`${value}T00:00:00`) : new Date()
  );
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (value) {
      setViewDate(new Date(`${value}T00:00:00`));
    }
  }, [value]);

  useEffect(() => {
    if (isOpen && pickerRef.current) {
      const rect = pickerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [isOpen]);

  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const monthLabel = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const startDay = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1
  ).getDay();
  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0
  ).getDate();
  const today = new Date();

  const handleSelectDay = (day: number) => {
    const isoDate = toISODate(viewDate.getFullYear(), viewDate.getMonth(), day);
    onChange(isoDate);
    setIsOpen(false);
  };

  const handleToday = () => {
    const isoDate = toISODate(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    setViewDate(today);
    onChange(isoDate);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <div className="space-y-2 relative" ref={pickerRef}>
      <label className="input-label tracking-tight">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full px-4 py-3 rounded-2xl border border-[#1c1917]/15 bg-[#e85d04]/5 flex items-center justify-between text-left transition-all tracking-tight ${
          disabled
            ? "opacity-60 cursor-not-allowed"
            : "hover:border-[#1c1917]/40"
        }`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center border border-[#1c1917]/15">
            <Calendar className="w-4 h-4 text-[#1c1917]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-[#1c1917]/70">Selected date</span>
            <span
              className={`text-sm font-[450] ${
                value ? "text-[#1c1917]" : "text-[#1c1917]/50"
              }`}>
              {value
                ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : placeholder}
            </span>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-[#1c1917]/60 flex-shrink-0" />
      </button>

      {isOpen && (
        <div
          className="fixed z-[9999] w-full max-w-sm rounded-2xl bg-white shadow-xl border border-[#1c1917]/10 p-4"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}>
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-[#e85d04]/10 text-[#1c1917]"
              onClick={() =>
                setViewDate(
                  new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)
                )
              }>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-[600] text-[#1c1917] tracking-tight">
              {monthLabel}
            </p>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-[#e85d04]/10 text-[#1c1917]"
              onClick={() =>
                setViewDate(
                  new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)
                )
              }>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-[11px] text-[#1c1917]/60 mb-2 tracking-tight">
            {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
              <div key={day} className="text-center py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDay }).map((_, index) => (
              <div key={`empty-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const candidate = new Date(
                viewDate.getFullYear(),
                viewDate.getMonth(),
                day
              );
              const isSelected =
                !!selectedDate && isSameDay(selectedDate, candidate);
              const isToday = isSameDay(today, candidate);

              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => handleSelectDay(day)}
                  className={`h-10 rounded-xl text-sm font-[450] transition-all tracking-tight ${
                    isSelected
                      ? "bg-[#e85d04] text-white shadow-sm"
                      : "hover:bg-[#e85d04]/10 text-[#1c1917]"
                  } ${
                    isToday && !isSelected ? "border border-[#1c1917]/30" : ""
                  }`}>
                  {day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 gap-2">
            <button
              type="button"
              className="flex-1 px-3 py-2 rounded-xl bg-[#e85d04]/10 text-[#1c1917] text-sm font-[500] tracking-tight hover:bg-[#e85d04]/15"
              onClick={handleToday}>
              Today
            </button>
            <button
              type="button"
              className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#1c1917]/20 text-[#1c1917]/80 text-sm font-[500] tracking-tight hover:border-[#1c1917]/40"
              onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type TimeInputProps = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function TimeInput({ label, value, onChange, disabled }: TimeInputProps) {
  const handleNow = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    onChange(`${h}:${m}`);
  };

  return (
    <div className="space-y-2">
      <label className="input-label tracking-tight">{label}</label>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1c1917]/50 pointer-events-none z-10" />
          <input
            type="time"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full pl-11 pr-4 py-3 rounded-2xl border border-[#1c1917]/15 bg-[#e85d04]/5 text-sm text-[#1c1917] tracking-tight focus:outline-none focus:border-[#e85d04]/60 focus:ring-2 focus:ring-[#e85d04]/10 transition-all ${
              disabled ? "opacity-60 cursor-not-allowed" : "hover:border-[#1c1917]/40"
            }`}
          />
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={handleNow}
          className="px-3 py-2.5 rounded-xl text-xs font-[500] bg-[#e85d04]/10 text-[#1c1917] hover:bg-[#e85d04]/20 transition-colors whitespace-nowrap disabled:opacity-50">
          Now
        </button>
      </div>
    </div>
  );
}

// ── Searchable client picker ───────────────────────────────────────────────
function ClientSearchField({
  clients,
  disabled,
  selectedClientId,
  value,
  error,
  onSelect,
  onClear,
  onChange,
}: {
  clients: ClientLite[];
  disabled?: boolean;
  selectedClientId: string;
  value: string;
  error?: string;
  onSelect: (c: ClientLite) => void;
  onClear: () => void;
  onChange: (val: string) => void;
}) {
  const [query, setQuery] = React.useState(value || "");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Keep query in sync when parent resets
  React.useEffect(() => { setQuery(value || ""); }, [value]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim().length === 0
    ? clients.slice(0, 8)
    : clients.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.email?.toLowerCase().includes(query.toLowerCase()) ||
        c.address?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8);

  const isLinked = !!selectedClientId;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <label className="input-label tracking-tight">
        Client <span className="text-red-500">*</span>
      </label>

      <div style={{ position: "relative" }}>
        {/* Search icon */}
        <svg
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: isLinked ? "#e85d04" : "rgba(28,25,23,0.4)", pointerEvents: "none", zIndex: 1 }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isLinked
            ? <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></>
            : <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>
          }
        </svg>

        <input
          type="text"
          disabled={disabled}
          value={query}
          placeholder="Search existing clients or type a new name…"
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            onChange(val);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          style={{
            width: "100%", height: 44, borderRadius: 10,
            border: error ? "1px solid #dc2626" : isLinked ? "1px solid rgba(232,93,4,0.35)" : "1px solid rgba(28,25,23,0.12)",
            background: isLinked ? "rgba(232,93,4,0.04)" : "#fff",
            padding: "0 40px 0 42px",
            fontSize: 14, color: "#1c1917", outline: "none",
            fontFamily: "inherit",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = "#e85d04";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,93,4,0.12)";
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.borderColor = error
              ? "#dc2626"
              : isLinked ? "rgba(232,93,4,0.35)" : "rgba(28,25,23,0.12)";
          }}
        />

        {/* Clear button */}
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); onClear(); setOpen(false); }}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(28,25,23,0.4)", display: "flex", padding: 2 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Linked client badge */}
      {isLinked && (
        <p style={{ fontSize: 11, color: "#e85d04", marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Existing client linked · info auto-filled
        </p>
      )}

      {error && !isLinked && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {open && !disabled && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999,
          background: "#fff", border: "1px solid rgba(28,25,23,0.1)", borderRadius: 12,
          boxShadow: "0 8px 24px rgba(28,25,23,0.12)", overflow: "hidden", maxHeight: 280, overflowY: "auto",
        }}>
          {filtered.length === 0 && query.trim() ? (
            <div style={{ padding: "10px 14px" }}>
              <div style={{ fontSize: 12, color: "rgba(28,25,23,0.5)", marginBottom: 4 }}>No existing clients match</div>
              <button type="button" onClick={() => { onChange(query); setOpen(false); }}
                style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "8px 0", fontSize: 14, color: "#1c1917", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, background: "rgba(232,93,4,0.1)", color: "#e85d04", padding: "2px 7px", borderRadius: 6, fontWeight: 600 }}>NEW</span>
                Create &ldquo;{query}&rdquo; as new client
              </button>
            </div>
          ) : (
            <>
              {query.trim() === "" && (
                <div style={{ padding: "8px 14px 4px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(28,25,23,0.4)" }}>
                  Existing clients
                </div>
              )}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setQuery(c.name); onSelect(c); setOpen(false); }}
                  style={{ width: "100%", textAlign: "left", background: c.id === selectedClientId ? "rgba(232,93,4,0.06)" : "none", border: "none", cursor: "pointer", padding: "10px 14px", fontFamily: "inherit", borderBottom: "1px solid rgba(28,25,23,0.04)", display: "flex", flexDirection: "column", gap: 2 }}
                  onMouseEnter={(e) => { if (c.id !== selectedClientId) e.currentTarget.style.background = "rgba(28,25,23,0.03)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = c.id === selectedClientId ? "rgba(232,93,4,0.06)" : "none"; }}>
                  <span style={{ fontSize: 14, color: "#1c1917", fontWeight: c.id === selectedClientId ? 600 : 400 }}>{c.name}</span>
                  {(c.email || c.address) && (
                    <span style={{ fontSize: 11, color: "rgba(28,25,23,0.5)" }}>
                      {[c.email, c.address].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
              ))}
              {query.trim() !== "" && (
                <button type="button" onClick={() => { onChange(query); setSelectedClientIdLocal(); setOpen(false); }}
                  style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "10px 14px", fontSize: 13, color: "rgba(28,25,23,0.6)", fontFamily: "inherit", borderTop: "1px solid rgba(28,25,23,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, background: "rgba(232,93,4,0.1)", color: "#e85d04", padding: "2px 7px", borderRadius: 6, fontWeight: 600 }}>NEW</span>
                  Use &ldquo;{query}&rdquo; as new client name
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  function setSelectedClientIdLocal() { onClear(); }
}

export default function JobModal({
  isOpen,
  onClose,
  job,
  mode,
  users,
  clients = [],
  onSubmit,
  onDelete,
}: JobModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCleaners, setSelectedCleaners] = useState<string[]>([]);
  const [selectedJobType, setSelectedJobType] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>("");
  // Flips to true after admin saves a card via the inline SaveCardOnFile
  // panel. Keeps the success state visible until the modal closes /
  // re-opens (the parent server data still shows defaultPaymentMethodId
  // as null until the page revalidates).
  const [cardSavedNow, setCardSavedNow] = useState(false);
  const [addOns, setAddOns] = useState<Array<{ name: string; price: number }>>(
    []
  );
  const [newAddOnName, setNewAddOnName] = useState("");
  const [newAddOnPrice, setNewAddOnPrice] = useState("");
  const [discountMode, setDiscountMode] = useState<"percent" | "amount">(
    "amount"
  );
  const [discountInput, setDiscountInput] = useState<string>("");
  const [discountTouched, setDiscountTouched] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    trigger,
    control,
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: (zodResolver as any)(formSchema) as Resolver<FormValues>,
    mode: "onChange",
  });

  // Initialize form when modal opens or job changes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      if (job) {
        reset({
          clientName: job.clientName || "",
          location: job.location || "",
          apartmentNumber: job.apartmentNumber || "",
          description: job.description || "",
          jobType: job.jobType || "",
          startDate: job.startTime
            ? new Date(job.startTime).toISOString().split("T")[0]
            : "",
          startTime: job.startTime
            ? new Date(job.startTime).toISOString().split("T")[1].slice(0, 5)
            : "",
          price: job.price || "",
          employeePay: job.employeePay || "",
          totalTip: job.totalTip || "",
          parking: job.parking || "",
          notes: job.notes || "",
          bedCount: job.bedCount ?? "",
          bathCount: job.bathCount ?? "",
          halfBathCount: job.halfBathCount ?? "",
          discountAmount: job.discountAmount ?? "",
        });
        setSelectedCleaners(job.cleaners?.map((c) => c.id) || []);
        setSelectedJobType(job.jobType || "");
        setSelectedClientId(job.clientId || "");
        setSelectedPaymentType(job.paymentType || "");
        setCardSavedNow(false);
        setAddOns(
          (job.addOns || []).map((a) => ({ name: a.name, price: a.price }))
        );
        // Existing job: keep its stored amount as the source of truth
        setDiscountMode("amount");
        setDiscountInput(
          job.discountAmount && job.discountAmount > 0
            ? String(job.discountAmount)
            : ""
        );
        setDiscountTouched(true);
      } else {
        reset({
          clientName: "",
          location: "",
          apartmentNumber: "",
          description: "",
          jobType: "",
          startDate: "",
          startTime: "",
          price: "",
          employeePay: "",
          totalTip: "",
          parking: "",
          notes: "",
          bedCount: "",
          bathCount: "",
          halfBathCount: "",
          discountAmount: "",
        });
        setSelectedCleaners([]);
        setSelectedJobType("");
        setSelectedClientId("");
        setSelectedPaymentType("");
        setCardSavedNow(false);
        setAddOns([]);
        setDiscountMode("percent");
        setDiscountInput("");
        setDiscountTouched(false);
      }
    }
  }, [isOpen, job, reset]);

  // Auto-prefill discount from selected client's default percent
  useEffect(() => {
    if (!isOpen || discountTouched) return;
    const linked = clients.find((c) => c.id === selectedClientId);
    if (linked && (linked.discountPercent ?? 0) > 0) {
      setDiscountMode("percent");
      setDiscountInput(String(linked.discountPercent));
    } else if (!linked) {
      setDiscountInput("");
    }
  }, [isOpen, selectedClientId, clients, discountTouched]);

  const disableForm = submitting || isDeleting;

  // Step validation
  const validateStep = async (step: number): Promise<boolean> => {
    if (step === 1) {
      return await trigger("clientName");
    }
    return true;
  };

  const handleNextStep = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1);
      setGlobalError(null);
    }
  };

  const handlePrevStep = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setGlobalError(null);
    }
  };

  const goToStep = async (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
      setGlobalError(null);
    } else if (step > currentStep) {
      // Validate all steps up to the target step
      for (let i = currentStep; i < step; i++) {
        const isValid = await validateStep(i);
        if (!isValid) return;
      }
      setCurrentStep(step);
      setGlobalError(null);
    }
  };

  // Transform users to SmartSearch format
  const smartSearchUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
  }));

  const toggleCleaner = (userId: string) => {
    setSelectedCleaners((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleFormSubmit: SubmitHandler<FormValues> = async (values) => {
    setSubmitting(true);
    setGlobalError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      if (job?.id) formData.append("jobId", job.id);
      formData.append("clientName", values.clientName);
      formData.append("clientId", selectedClientId);
      formData.append("location", values.location || "");
      formData.append("apartmentNumber", values.apartmentNumber || "");
      formData.append("description", values.description || "");
      formData.append("jobType", selectedJobType);
      formData.append("startDate", values.startDate || "");
      formData.append("startTime", values.startTime || "");
      formData.append("price", String(values.price || ""));
      formData.append("employeePay", String(values.employeePay || ""));
      formData.append("totalTip", String(values.totalTip || ""));
      formData.append("parking", String(values.parking || ""));
      formData.append("notes", values.notes || "");
      formData.append("bedCount", String(values.bedCount || ""));
      formData.append("bathCount", String(values.bathCount || ""));
      formData.append("halfBathCount", String(values.halfBathCount || ""));

      // Resolve discount: convert percent to amount if needed.
      // If admin has touched the field, send an explicit value (including "0")
      // so server-side auto-apply doesn't override their choice.
      const discountValueNum = parseFloat(discountInput);
      let resolvedDiscount = "";
      if (Number.isFinite(discountValueNum) && discountValueNum > 0) {
        if (discountMode === "percent") {
          const priceNum = Number(values.price) || 0;
          resolvedDiscount =
            priceNum > 0
              ? (priceNum * (discountValueNum / 100)).toFixed(2)
              : "0";
        } else {
          resolvedDiscount = String(discountValueNum);
        }
      } else if (discountTouched) {
        resolvedDiscount = "0";
      }
      formData.append("discountAmount", resolvedDiscount);
      formData.append("paymentType", selectedPaymentType);
      formData.append("addOns", JSON.stringify(addOns));

      // Add cleaners
      selectedCleaners.forEach((id) => {
        formData.append("cleaners", id);
      });

      const result = await onSubmit(formData);

      if (result.error) {
        throw new Error(result.error);
      }

      setSuccessMessage(
        mode === "create"
          ? "Job created successfully"
          : "Job updated successfully"
      );

      setTimeout(() => {
        handleClose();
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Submit error:", error);
      setGlobalError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!job || !onDelete) return;

    setIsDeleting(true);
    setGlobalError(null);

    try {
      const result = await onDelete(job.id);

      if (result.error) {
        throw new Error(result.error);
      }

      handleClose();
      window.location.reload();
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "Failed to delete job"
      );
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleClose = () => {
    if (!submitting && !isDeleting) {
      reset();
      setGlobalError(null);
      setSuccessMessage(null);
      setShowDeleteConfirm(false);
      setSelectedCleaners([]);
      setSelectedJobType("");
      setCurrentStep(1);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: "blur(2px)",
          backgroundColor: "rgba(175, 175, 175, 0.1)",
        }}
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="relative z-[1001] w-full max-w-2xl max-h-[95vh] bg-white rounded-3xl tracking-tight">
        {/* Scrollable Content */}
        <div className="w-full max-h-[95vh] overflow-y-auto overflow-x-visible">
          <div className="w-full px-6 md:px-8 py-6 md:py-8">
            {/* Header */}
            <div className="w-full flex items-start justify-between gap-1 mb-6">
              <div>
                <h1 className="text-2xl font-[350] tracking-tight text-[#1c1917]">
                  {mode === "create" ? "Create New Job" : "Edit Job"}
                </h1>
                <p className="text-sm text-[#1c1917]/60 mt-1">
                  Step {currentStep} of 3 — {STEPS[currentStep - 1].title}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={disableForm}
                className="!p-2">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-8">
              {STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <button
                      type="button"
                      onClick={() => goToStep(step.id)}
                      disabled={disableForm}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                        isActive
                          ? "bg-[#e85d04] text-white"
                          : isCompleted
                          ? "bg-[#e85d04]/10 text-[#1c1917] hover:bg-[#e85d04]/20"
                          : "bg-[#e85d04]/5 text-[#1c1917]/40"
                      }`}>
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                      <span className="text-xs font-[400] hidden sm:inline">
                        {step.title}
                      </span>
                    </button>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-[2px] mx-2 rounded-full ${
                          isCompleted ? "bg-[#e85d04]/30" : "bg-[#e85d04]/10"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="rounded-2xl p-4 flex items-start gap-3 bg-green-50 border border-green-200 mb-6">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 flex-1">
                  <p className="text-sm text-green-700 font-[400]">
                    {successMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Delete Confirmation */}
            {mode === "edit" && showDeleteConfirm && (
              <div className="rounded-2xl p-4 flex items-start gap-3 bg-red-50 border border-red-200 mb-6">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col gap-2 flex-1">
                  <p className="text-sm text-red-700 font-[400]">
                    Are you sure you want to delete this job?
                  </p>
                  <p className="text-xs text-red-600/70">
                    This action cannot be undone. All job data will be
                    permanently removed.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      variant="default"
                      size="sm"
                      border={false}
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="px-4 py-2">
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      border={false}
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="px-4 py-2">
                      {isDeleting ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Confirm Delete
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(handleFormSubmit)}>
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-5">
                  {/* Client Search — existing client picker + free-text fallback */}
                  <ClientSearchField
                    clients={clients}
                    disabled={disableForm}
                    selectedClientId={selectedClientId}
                    value={watch("clientName")}
                    error={errors.clientName?.message}
                    onSelect={(c) => {
                      setSelectedClientId(c.id);
                      setDiscountTouched(false);
                      setValue("clientName", c.name, { shouldValidate: true, shouldDirty: true });
                      setValue("location", c.address || "", { shouldDirty: true });
                    }}
                    onClear={() => {
                      setSelectedClientId("");
                      setDiscountTouched(false);
                      setValue("clientName", "", { shouldValidate: false });
                    }}
                    onChange={(val) => {
                      setSelectedClientId("");
                      setValue("clientName", val, { shouldValidate: false, shouldDirty: true });
                    }}
                  />

                  {/* Location */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="input-label tracking-tight">
                        Location
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10 text-[#1c1917]/50" />
                        <Input
                          variant="form"
                          type="text"
                          size="md"
                          {...register("location")}
                          disabled={disableForm}
                          className="w-full pl-11 px-4 py-3 tracking-tight placeholder:tracking-tight"
                          placeholder="Street address"
                          border={false}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="input-label tracking-tight">
                        Apt / Unit
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10 text-[#1c1917]/50" />
                        <Input
                          variant="form"
                          type="text"
                          size="md"
                          {...register("apartmentNumber")}
                          disabled={disableForm}
                          className="w-full pl-11 px-4 py-3 tracking-tight placeholder:tracking-tight"
                          placeholder="e.g. 4B"
                          border={false}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Job Type */}
                  <div>
                    <label className="input-label tracking-tight">
                      Job Type
                    </label>
                    <CustomDropdown
                      trigger={
                        <Button
                          variant="default"
                          size="md"
                          border={false}
                          type="button"
                          disabled={disableForm}
                          className="w-full h-[44px] px-4 py-3 flex items-center !justify-between bg-[#e85d04]/5">
                          <span className="text-sm font-[350] text-[#1c1917]">
                            {jobTypes.find((t) => t.value === selectedJobType)
                              ?.label || "Select type"}
                          </span>
                          <ChevronDown className="w-4 h-4 text-[#1c1917]/50" />
                        </Button>
                      }
                      options={jobTypes.map((type) => ({
                        label: type.label,
                        onClick: () => setSelectedJobType(type.value),
                      }))}
                      maxHeight="12rem"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="input-label tracking-tight">
                      Description
                    </label>
                    <div className="relative">
                      <Textarea
                        size="md"
                        variant="form"
                        {...register("description")}
                        disabled={disableForm}
                        className="w-full px-4 py-3 tracking-tight placeholder:tracking-tight"
                        placeholder="Brief description of the job..."
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Schedule & Team */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  {/* Date & Time Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-[400] text-[#1c1917] uppercase tracking-tight flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Schedule
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <Controller
                        name="startDate"
                        control={control}
                        render={({ field }) => (
                          <CustomDatePicker
                            label="Job Date"
                            value={field.value}
                            onChange={field.onChange}
                            disabled={disableForm}
                            placeholder="Select date"
                          />
                        )}
                      />

                      <Controller
                        name="startTime"
                        control={control}
                        render={({ field }) => (
                          <TimeInput
                            label="Start Time"
                            value={field.value}
                            onChange={field.onChange}
                            disabled={disableForm}
                          />
                        )}
                      />
                    </div>
                  </div>

                  {/* Team Section */}
                  <div className="space-y-4">
                    <h3 className="input-label tracking-tight flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Assign Cleaners
                    </h3>

                    {users.length === 0 ? (
                      <div className="bg-[#e85d04]/5 rounded-2xl p-6 text-center">
                        <Users className="w-8 h-8 text-[#1c1917]/30 mx-auto mb-2" />
                        <p className="text-sm text-[#1c1917]/60">
                          No team members available
                        </p>
                      </div>
                    ) : (
                      <SmartSearch
                        items={smartSearchUsers}
                        selectedIds={selectedCleaners}
                        onToggleItem={toggleCleaner}
                        disabled={disableForm}
                        placeholder="Search team members..."
                        selectedLabel="Assigned cleaners:"
                        emptyMessage="No team members found"
                        size="md"
                        filterFn={(item, query) =>
                          item.name
                            .toLowerCase()
                            .includes(query.toLowerCase()) ||
                          (item as { email?: string }).email
                            ?.toLowerCase()
                            .includes(query.toLowerCase()) ||
                          false
                        }
                        renderItem={(item, isSelected) => (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-[400] text-[#1c1917]">
                                {item.name}
                              </p>
                              <p className="text-xs text-[#1c1917]/60">
                                {(item as { email?: string }).email}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-[#1c1917]" />
                            )}
                          </>
                        )}
                        renderSelectedItem={(item) => (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#e85d04]/20 flex items-center justify-center">
                              <span className="text-xs font-[500] text-[#1c1917]">
                                {item.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-[350] text-[#1c1917]">
                              {item.name}
                            </span>
                          </div>
                        )}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Pricing & Notes */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  {/* Pricing Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-[400] text-[#1c1917] uppercase tracking-tight flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Pricing & Payment
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="input-label tracking-tight">
                          Price
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10 text-[#1c1917]/50" />
                          <Input
                            variant="form"
                            type="number"
                            size="md"
                            step="0.01"
                            min="0"
                            {...register("price")}
                            disabled={disableForm}
                            className="w-full pl-11 px-4 py-3 tracking-tight placeholder:tracking-tight"
                            placeholder="0.00"
                            border={false}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="input-label tracking-tight">
                          Employee Pay
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10 text-[#1c1917]/50" />
                          <Input
                            variant="form"
                            type="number"
                            size="md"
                            step="0.01"
                            min="0"
                            {...register("employeePay")}
                            disabled={disableForm}
                            className="w-full pl-11 px-4 py-3 tracking-tight placeholder:tracking-tight"
                            placeholder="0.00"
                            border={false}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="input-label tracking-tight">
                          Total Tip
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10 text-[#1c1917]/50" />
                          <Input
                            variant="form"
                            type="number"
                            size="md"
                            step="0.01"
                            min="0"
                            {...register("totalTip")}
                            disabled={disableForm}
                            className="w-full pl-11 px-4 py-3 tracking-tight placeholder:tracking-tight"
                            placeholder="0.00"
                            border={false}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="input-label tracking-tight">
                          Parking
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10 text-[#1c1917]/50" />
                          <Input
                            variant="form"
                            type="number"
                            size="md"
                            step="0.01"
                            min="0"
                            {...register("parking")}
                            disabled={disableForm}
                            className="w-full pl-11 px-4 py-3 tracking-tight placeholder:tracking-tight"
                            placeholder="0.00"
                            border={false}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className="input-label tracking-tight">
                            Discount
                          </label>
                          <div className="flex bg-[#e85d04]/5 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setDiscountMode("percent");
                                setDiscountTouched(true);
                              }}
                              disabled={disableForm}
                              className={`px-2 py-0.5 text-[11px] rounded-md transition-colors ${
                                discountMode === "percent"
                                  ? "bg-[#e85d04] text-white"
                                  : "text-[#1c1917]/60"
                              }`}>
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDiscountMode("amount");
                                setDiscountTouched(true);
                              }}
                              disabled={disableForm}
                              className={`px-2 py-0.5 text-[11px] rounded-md transition-colors ${
                                discountMode === "amount"
                                  ? "bg-[#e85d04] text-white"
                                  : "text-[#1c1917]/60"
                              }`}>
                              $
                            </button>
                          </div>
                        </div>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10 text-[#1c1917]/50" />
                          <Input
                            variant="form"
                            type="number"
                            size="md"
                            step="0.01"
                            min="0"
                            value={discountInput}
                            onChange={(e) => {
                              setDiscountInput(e.target.value);
                              setDiscountTouched(true);
                            }}
                            disabled={disableForm}
                            className="w-full pl-11 px-4 py-3"
                            placeholder={discountMode === "percent" ? "0" : "0.00"}
                            border={false}
                          />
                        </div>
                        {!discountTouched &&
                          (() => {
                            const linked = clients.find(
                              (c) => c.id === selectedClientId
                            );
                            return linked && (linked.discountPercent ?? 0) > 0 ? (
                              <p className="text-[11px] text-[#1c1917]/60 mt-1">
                                From client default ({linked.discountPercent}%)
                              </p>
                            ) : null;
                          })()}
                      </div>

                      <div>
                        <label className="input-label tracking-tight">
                          Bedrooms
                        </label>
                        <Input
                          variant="form"
                          type="number"
                          size="md"
                          min="0"
                          {...register("bedCount")}
                          disabled={disableForm}
                          className="w-full px-4 py-3"
                          placeholder="0"
                          border={false}
                        />
                      </div>

                      <div>
                        <label className="input-label tracking-tight">
                          Full Bathrooms
                        </label>
                        <Input
                          variant="form"
                          type="number"
                          size="md"
                          min="0"
                          {...register("bathCount")}
                          disabled={disableForm}
                          className="w-full px-4 py-3"
                          placeholder="0"
                          border={false}
                        />
                      </div>

                      <div>
                        <label className="input-label tracking-tight">
                          Half Bathrooms
                        </label>
                        <Input
                          variant="form"
                          type="number"
                          size="md"
                          min="0"
                          {...register("halfBathCount")}
                          disabled={disableForm}
                          className="w-full px-4 py-3"
                          placeholder="0"
                          border={false}
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="input-label tracking-tight">
                          Payment Type
                        </label>
                        <CustomDropdown
                          trigger={
                            <Button
                              variant="default"
                              size="md"
                              border={false}
                              type="button"
                              disabled={disableForm}
                              className="w-full h-[44px] px-4 py-3 flex items-center !justify-between bg-[#e85d04]/5">
                              <span className="text-sm font-[350] text-[#1c1917]">
                                {selectedPaymentType
                                  ? selectedPaymentType.replace("_", " ")
                                  : "Select payment type"}
                              </span>
                              <ChevronDown className="w-4 h-4 text-[#1c1917]/50" />
                            </Button>
                          }
                          options={[
                            {
                              label: "— None —",
                              onClick: () => setSelectedPaymentType(""),
                            },
                            {
                              label: "Cash",
                              onClick: () => setSelectedPaymentType("CASH"),
                            },
                            {
                              label: "Cheque",
                              onClick: () => setSelectedPaymentType("CHEQUE"),
                            },
                            {
                              label: "E-Transfer",
                              onClick: () =>
                                setSelectedPaymentType("E_TRANSFER"),
                            },
                            {
                              label: "Credit Card",
                              onClick: () =>
                                setSelectedPaymentType("CREDIT_CARD"),
                            },
                            {
                              label: "Other",
                              onClick: () => setSelectedPaymentType("OTHER"),
                            },
                          ]}
                          maxHeight="14rem"
                        />
                      </div>
                    </div>

                    {/* Card on file: shown when CREDIT_CARD selected and
                        the chosen client has no saved payment method. */}
                    {selectedPaymentType === "CREDIT_CARD" && (() => {
                      const selectedClient = clients.find(
                        (c) => c.id === selectedClientId
                      );
                      if (!selectedClientId || !selectedClient) {
                        return (
                          <div
                            style={{
                              marginTop: 12,
                              padding: 12,
                              background: "#fef3c7",
                              border: "1px solid #fde68a",
                              borderRadius: 10,
                              fontSize: 12.5,
                              color: "#854d0e",
                              lineHeight: 1.5,
                            }}>
                            To save a card on file, pick an existing client from the search above. For a brand-new client, save the job first then add the card from their client profile.
                          </div>
                        );
                      }
                      if (selectedClient.defaultPaymentMethodId || cardSavedNow) {
                        return (
                          <div
                            style={{
                              marginTop: 12,
                              padding: "8px 12px",
                              background: "#dcfce7",
                              color: "#166534",
                              fontSize: 13,
                              fontWeight: 600,
                              borderRadius: 8,
                            }}>
                            ✓ Card on file. Charges will run off-session.
                          </div>
                        );
                      }
                      return (
                        <SaveCardOnFile
                          clientId={selectedClient.id}
                          clientName={selectedClient.name}
                          clientEmail={selectedClient.email ?? null}
                          onSaved={() => setCardSavedNow(true)}
                        />
                      );
                    })()}
                  </div>

                  {/* Add-Ons Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-[400] text-[#1c1917] uppercase tracking-tight flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Add-Ons
                    </h3>
                    {addOns.length > 0 && (
                      <div className="space-y-2">
                        {addOns.map((a, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-3 rounded-xl bg-[#e85d04]/5">
                            <span className="text-sm text-[#1c1917]">
                              {a.name}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-[400] text-[#1c1917]">
                                ${a.price.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                className="text-xs text-red-600"
                                onClick={() =>
                                  setAddOns((prev) =>
                                    prev.filter((_, idx) => idx !== i)
                                  )
                                }>
                                remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        variant="form"
                        size="md"
                        value={newAddOnName}
                        onChange={(e) => setNewAddOnName(e.target.value)}
                        disabled={disableForm}
                        placeholder="Add-on name"
                        className="flex-1 px-4 py-3"
                        border={false}
                      />
                      <Input
                        variant="form"
                        type="number"
                        size="md"
                        step="0.01"
                        min="0"
                        value={newAddOnPrice}
                        onChange={(e) => setNewAddOnPrice(e.target.value)}
                        disabled={disableForm}
                        placeholder="Price"
                        className="w-28 px-4 py-3"
                        border={false}
                      />
                      <Button
                        type="button"
                        variant="default"
                        size="md"
                        border={false}
                        disabled={
                          disableForm || !newAddOnName.trim()
                        }
                        onClick={() => {
                          const price = parseFloat(newAddOnPrice);
                          setAddOns((prev) => [
                            ...prev,
                            {
                              name: newAddOnName.trim(),
                              price: Number.isFinite(price) ? price : 0,
                            },
                          ]);
                          setNewAddOnName("");
                          setNewAddOnPrice("");
                        }}
                        className="px-4 py-3">
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-[400] text-[#1c1917] uppercase tracking-tight flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Additional Notes
                    </h3>

                    <Textarea
                      size="md"
                      {...register("notes")}
                      disabled={disableForm}
                      className="w-full px-4 py-3 min-h-[120px] bg-[#e85d04]/5 border-0 focus:ring-1 focus:ring-[#e85d04]/20 rounded-2xl tracking-tight placeholder:tracking-tight"
                      placeholder="Any additional notes or special requirements..."
                      rows={4}
                    />
                  </div>
                </div>
              )}

              {/* Global Error */}
              {globalError && (
                <div className="bg-red-50 rounded-2xl p-3 mt-6">
                  <p className="text-xs text-red-600">{globalError}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="w-full flex flex-col md:flex-row justify-between pt-6 items-center border-[#1c1917]/10 gap-4">
                {/* Left side - Delete button (only in edit mode on last step) */}
                {mode === "edit" &&
                currentStep === 3 &&
                !showDeleteConfirm &&
                onDelete ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="md"
                    border={false}
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={disableForm}
                    className="px-4 py-3 w-full md:w-auto">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Job
                  </Button>
                ) : (
                  <div />
                )}

                {/* Right side - Navigation buttons */}
                <div className="flex gap-3 w-full md:w-auto">
                  {currentStep > 1 ? (
                    <Button
                      type="button"
                      variant="default"
                      size="md"
                      border={false}
                      onClick={handlePrevStep}
                      disabled={disableForm}
                      className="px-5 py-3 flex-1 md:flex-none">
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="default"
                      size="md"
                      border={false}
                      onClick={handleClose}
                      disabled={disableForm}
                      className="px-5 py-3 flex-1 md:flex-none">
                      Cancel
                    </Button>
                  )}

                  {currentStep < 3 ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={handleNextStep}
                      disabled={disableForm}
                      className="px-5 py-3 flex-1 md:flex-none">
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="md"
                      type="submit"
                      disabled={disableForm}
                      className="px-6 py-3 flex-1 md:flex-none">
                      {submitting ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          {mode === "create" ? "Creating..." : "Updating..."}
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          {mode === "create" ? "Create Job" : "Update Job"}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
