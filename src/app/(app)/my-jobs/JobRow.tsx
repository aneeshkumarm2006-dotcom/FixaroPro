"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock } from "lucide-react";
import PayBreakdownModal from "./PayBreakdownModal";
import { WARNING_VISUAL, jobStatusLabel, jobStatusSlug } from "@/lib/status-icons";
import { useJobTypeLabel } from "@/components/calendar/use-job-type-label";

const WarningIcon = WARNING_VISUAL.Icon;

interface MissingSupplyInfo {
  productId: string;
  productName: string;
  needed: number;
  have: number;
}

interface JobRowProps {
  job: any;
  isMainEmployee: boolean;
  /** Tool-checklist items the provider holds none of (SOP §8). Locker/buy-and-expense. */
  missingTools?: string[];
  /** Kit consumables they're short of. Restockable from the locker. */
  missingSupplies?: MissingSupplyInfo[];
}

// Label comes from the live catalog via useJobTypeLabel() — the local switch
// this replaces returned the RAW ENUM CODE for every Fixaro service.


export function JobRow({
  job,
  isMainEmployee,
  missingTools = [],
  missingSupplies = [],
}: JobRowProps) {
  const router = useRouter();
  const jobTypeLabel = useJobTypeLabel();
  const jobWithClock = job as any;
  const canClockIn = !jobWithClock.clockInTime && !["COMPLETED", "CANCELLED", "PAID"].includes(job.status);
  const canClockOut = jobWithClock.clockInTime && !jobWithClock.clockOutTime;
  const isCompleted = job.status === "COMPLETED" || job.status === "PAID" || jobWithClock.clockOutTime;
  const instantPayoutEligible = job.status === "COMPLETED" && job.paymentReceived === true;

  const [payModalOpen, setPayModalOpen] = useState(false);

  const ctaLabel = canClockIn ? "Start job" : canClockOut ? "Complete job" : "View details";
  const sc = jobStatusSlug(job.status);

  const date = job.jobDate ? new Date(job.jobDate) : null;
  const mo = date ? date.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : null;
  const day = date ? date.getDate() : null;
  const wd = date ? date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase() : null;

  return (
    <>
      <div
        className={`cl-jobs2-card ${sc}`}
        onClick={() => router.push(`/my-jobs/${job.id}`)}>
        {/* Date pill */}
        <div className="cl-jobs2-datepill">
          {mo && <span className="mo">{mo}</span>}
          {day && <span className="day">{day}</span>}
          {wd && <span className="wd">{wd}</span>}
          {!date && <span className="mo" style={{ fontSize: 12 }}>—</span>}
        </div>

        {/* Meta */}
        <div className="cl-jobs2-meta">
          <div className="cl-jobs2-meta-head">
            <span className="cl-jobs2-client">{job.clientName}</span>
            <span className={`cl-pill ${sc}`}>{jobStatusLabel(job.status)}</span>
            {jobTypeLabel(job.jobType) && (
              <span className="cl-pill" style={{ background: "var(--primary-5)", color: "var(--primary)" }}>
                {jobTypeLabel(job.jobType)}
              </span>
            )}
            {instantPayoutEligible && (
              <span className="cl-pill" style={{ background: "#fef3c7", color: "#b45309" }}>Instant payout</span>
            )}
            {/* Tools you don't have (SOP §8) — fixed at the locker or by buying
                them and expensing it. Deep-links to the job's equipment panel. */}
            {missingTools.length > 0 && (
              <button
                type="button"
                className="cl-job-card-warn"
                title={`Missing: ${missingTools.join(", ")}`}
                onClick={(e) => { e.stopPropagation(); router.push(`/my-jobs/${job.id}#equipment`); }}>
                <WarningIcon size={11} />
                Missing tools
              </button>
            )}
            {/* Consumables a kit says this job burns through — a different
                problem with a different fix (restock), so a different chip. */}
            {missingSupplies.length > 0 && (
              <button
                type="button"
                className="cl-job-card-warn"
                title={`Short of: ${missingSupplies.map((s) => s.productName).join(", ")}`}
                onClick={(e) => { e.stopPropagation(); router.push(`/my-inventory/resolve?jobId=${job.id}`); }}>
                <WarningIcon size={11} />
                Restock supplies
              </button>
            )}
          </div>
          <div className="cl-jobs2-meta-rows">
            {job.location && (
              <span className="row">
                <MapPin size={13} className="icon" />
                {job.location}{job.apartmentNumber ? `, Unit ${job.apartmentNumber}` : ''}
              </span>
            )}
            {job.startTime && (
              <span className="row">
                <Clock size={13} className="icon" />
                {new Date(job.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                {job.endTime && <> – {new Date(job.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</>}
              </span>
            )}
          </div>
        </div>

        {/* Side: pay + CTA */}
        <div className="cl-jobs2-side">
          {job.employeePay != null && isMainEmployee && (
            <button
              type="button"
              className="cl-jobs2-pay"
              onClick={(e) => { e.stopPropagation(); setPayModalOpen(true); }}>
              <span className="lbl">{isCompleted ? "Earned" : "Est. pay"}</span>
              ${Number(job.employeePay).toFixed(2)}
            </button>
          )}
          <a
            href={`/my-jobs/${job.id}`}
            className={`cl-jobs2-cta${isCompleted ? " solid" : ""}`}
            onClick={(e) => e.stopPropagation()}>
            {ctaLabel}
          </a>
        </div>
      </div>

      <PayBreakdownModal
        jobId={job.id}
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
      />
    </>
  );
}
