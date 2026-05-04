"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { AlertTriangle, Calendar, Clock, MapPin, Zap } from "lucide-react";
import PayBreakdownModal from "./PayBreakdownModal";

interface MissingEquipmentInfo {
  productId: string;
  productName: string;
  needed: number;
  have: number;
}

interface JobRowProps {
  job: any;
  isMainEmployee: boolean;
  missingEquipment?: MissingEquipmentInfo[];
}

export function JobRow({
  job,
  isMainEmployee,
  missingEquipment = [],
}: JobRowProps) {
  const router = useRouter();
  const jobWithClock = job as any;
  const canClockIn = !jobWithClock.clockInTime && job.status !== "COMPLETED";
  const canClockOut = jobWithClock.clockInTime && !jobWithClock.clockOutTime;
  const isCompleted = job.status === "COMPLETED" || jobWithClock.clockOutTime;
  const instantPayoutEligible =
    job.status === "COMPLETED" &&
    job.paymentReceived === true &&
    job.status !== "PAID";

  const [payModalOpen, setPayModalOpen] = useState(false);

  const duration =
    jobWithClock.clockInTime && jobWithClock.clockOutTime
      ? Math.round(
          (new Date(jobWithClock.clockOutTime).getTime() -
            new Date(jobWithClock.clockInTime).getTime()) /
            1000 /
            60
        )
      : null;

  return (
    <div className="flex hover:bg-gray-50/50 transition-colors items-center min-w-max">
      {/* Client Name */}
      <div className="px-6 py-4 flex items-center gap-2 w-[200px] min-w-[200px]">
        <span className="text-sm font-[400] text-gray-900 truncate">
          {job.clientName}
        </span>
        {missingEquipment.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/my-inventory/resolve?jobId=${job.id}`);
            }}
            title={`Missing equipment: ${missingEquipment
              .map((m) => m.productName)
              .join(", ")}`}
            className="flex-shrink-0 inline-flex items-center text-amber-600 hover:text-amber-700">
            <AlertTriangle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Location */}
      <div className="px-6 py-4 flex items-center w-[220px] min-w-[220px]">
        {job.location ? (
          <span className="text-sm text-gray-600 flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate">{job.location}</span>
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </div>

      {/* Date */}
      <div className="px-6 py-4 flex items-center w-[140px] min-w-[140px]">
        {job.jobDate ? (
          <span className="text-sm text-gray-900 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {new Date(job.jobDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </div>

      {/* Start Time */}
      <div className="px-6 py-4 flex items-center w-[140px] min-w-[140px]">
        <span className="text-sm text-gray-900 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          {new Date(job.startTime).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </span>
      </div>

      {/* Scheduled End Time */}
      <div className="px-6 py-4 flex items-center w-[140px] min-w-[140px]">
        {job.endTime ? (
          <span className="text-sm text-gray-600">
            {new Date(job.endTime).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </div>

      {/* Actual End Time (Clock Out) */}
      <div className="px-6 py-4 flex items-center w-[150px] min-w-[150px]">
        {jobWithClock.clockOutTime ? (
          <span className="text-sm font-[400] text-green-600">
            {new Date(jobWithClock.clockOutTime).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </span>
        ) : jobWithClock.clockInTime ? (
          <span className="text-xs text-blue-600">In Progress</span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </div>

      {/* Pay (clickable opens breakdown) */}
      <div className="px-6 py-4 flex items-center w-[140px] min-w-[140px]">
        {job.employeePay !== null && job.employeePay !== undefined ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPayModalOpen(true);
            }}
            title="View pay breakdown"
            className="text-sm font-[400] text-[#005F6A] underline decoration-dotted underline-offset-2 hover:text-[#005F6A]/80 transition-colors">
            ${Number(job.employeePay).toFixed(2)}
          </button>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </div>

      {/* Status */}
      <div className="px-6 py-4 flex flex-col justify-center gap-1 w-[200px] min-w-[200px]">
        <Badge
          variant={
            job.status === "COMPLETED"
              ? "cleano"
              : job.status === "IN_PROGRESS"
              ? "secondary"
              : "default"
          }
          size="sm"
          className="!w-fit">
          {job.status.replace("_", " ")}
        </Badge>
        {instantPayoutEligible && (
          <span
            title="Eligible for instant payout"
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-[500] bg-amber-50 text-amber-700 w-fit">
            <Zap className="w-3 h-3" />
            Instant Payout
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 text-right text-sm flex items-center justify-end gap-2 w-[160px] min-w-[160px]">
        <Button
          variant="primary"
          size="sm"
          submit={false}
          href={`/my-jobs/${job.id}`}>
          {canClockIn
            ? "Start Job"
            : canClockOut
            ? "Complete Job"
            : "View Details"}
        </Button>
      </div>

      <PayBreakdownModal
        jobId={job.id}
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
      />
    </div>
  );
}
