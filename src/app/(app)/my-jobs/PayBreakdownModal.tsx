"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Info } from "lucide-react";
import { getPayBreakdown } from "../actions/getPayBreakdown";
import type { PayBreakdown } from "../actions/getPayBreakdown.types";

interface PayBreakdownModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function PayBreakdownModal({
  jobId,
  isOpen,
  onClose,
}: PayBreakdownModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PayBreakdown | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    getPayBreakdown(jobId).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setData(result.breakdown);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [jobId, isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pay Breakdown">
      {loading && (
        <div className="py-8 text-center text-sm text-gray-500">
          Loading breakdown...
        </div>
      )}

      {error && (
        <div className="py-6 text-center text-sm text-red-600">{error}</div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Provider pay only. Client pricing (base price, add-ons, discount,
              parking, client total) is intentionally NOT shown to crew and is
              no longer returned by getPayBreakdown at all (Fix #3d). */}
          <section>
            <h3 className="text-xs font-[400] text-gray-500 uppercase tracking-wider mb-3">
              Your Pay
            </h3>
            <div className="space-y-2">
              <Row
                label="Your hourly rate"
                value={`$${data.hourlyRate.toFixed(2)}/hr`}
                hint={
                  data.hourlyRateSource === "JOB_OVERRIDE"
                    ? "Rate set for this job"
                    : data.hourlyRateSource === "PROVIDER_RATE"
                    ? "Your standard rate"
                    : "Standard rate"
                }
              />
              <Row
                label={
                  data.teamSize > 1
                    ? `Your hours (${data.totalJobHours.toFixed(2)}h split ${
                        data.teamSize
                      } ways)`
                    : "Hours clocked"
                }
                value={`${data.hours.toFixed(2)}h`}
                hint={
                  data.clockIncomplete
                    ? "Not clocked out yet — hours update when you finish"
                    : undefined
                }
              />
              <Row
                label="Hourly pay"
                value={`$${data.hourlyPay.toFixed(2)}`}
                subtle
              />
              {data.totalTip > 0 && (
                <>
                  <Row
                    label={`Total tips (split ${data.teamSize} ${
                      data.teamSize === 1 ? "way" : "ways"
                    })`}
                    value={`$${data.totalTip.toFixed(2)}`}
                    subtle
                  />
                  <Row
                    label="Your tip share"
                    value={`+ $${data.tipShare.toFixed(2)}`}
                    valueClass="text-green-600"
                  />
                </>
              )}
              <div className="pt-2 mt-2 border-t border-gray-200">
                <Row
                  label="Total pay for this job"
                  value={`$${data.totalEmployeePay.toFixed(2)}`}
                  bold
                  highlight
                />
              </div>
            </div>
          </section>

          <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>
              You are paid by the hour: your rate × the hours you clock. Tips are
              divided equally among the lead and all assigned crew. Final pay may
              adjust after clock corrections and admin review.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({
  label,
  value,
  hint,
  bold,
  highlight,
  subtle,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  bold?: boolean;
  highlight?: boolean;
  subtle?: boolean;
  valueClass?: string;
}) {
  return (
    <div
      className={`flex justify-between items-center px-3 py-2 rounded-xl ${
        highlight ? "bg-[#e85d04]/10" : "bg-gray-50"
      } ${subtle ? "opacity-80" : ""}`}>
      <div className="flex flex-col">
        <span
          className={`text-sm ${
            bold ? "font-[500] text-gray-900" : "text-gray-700"
          }`}>
          {label}
        </span>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      <span
        className={`text-sm ${
          bold ? "font-[500]" : "font-[400]"
        } ${valueClass ?? (highlight ? "text-[#1c1917]" : "text-gray-900")}`}>
        {value}
      </span>
    </div>
  );
}
