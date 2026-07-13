"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  useServiceCatalog,
  useServiceCategories,
} from "@/lib/config/ServiceConfigProvider";
import { setEmployeeServiceEligibility } from "../../actions/setEmployeeServiceEligibility";

// Admin matrix of which services a provider is approved for (SOP §8). Read-only
// to providers; changes here are audit-logged server-side.
export default function EligibilityTab({
  employeeId,
  initialEligible,
}: {
  employeeId: string;
  initialEligible: string[];
}) {
  // The live catalog, so a service an admin ADDS can be granted immediately —
  // this used to be the TS constant, which meant a new service was unassignable
  // until someone shipped a deploy. Retired services are hidden from the matrix;
  // any existing eligibility row on one is left alone server-side.
  const catalog = useServiceCatalog();
  const categories = useServiceCategories();

  const [eligible, setEligible] = useState<Set<string>>(new Set(initialEligible));
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(serviceType: string) {
    const next = !eligible.has(serviceType);
    setSavingKey(serviceType);
    setError(null);
    // optimistic
    setEligible((prev) => {
      const s = new Set(prev);
      if (next) s.add(serviceType);
      else s.delete(serviceType);
      return s;
    });
    startTransition(async () => {
      const res = await setEmployeeServiceEligibility({
        employeeId,
        serviceType,
        isActive: next,
      });
      if (!res.success) {
        setError(res.error ?? "Failed to update");
        // revert
        setEligible((prev) => {
          const s = new Set(prev);
          if (next) s.delete(serviceType);
          else s.add(serviceType);
          return s;
        });
      }
      setSavingKey(null);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Approved services</h3>
        <p className="text-sm text-neutral-500 mt-1">
          Toggle the services this provider is approved to claim or bid on. Providers can only see
          and accept jobs for approved services — changes apply immediately.
        </p>
        {error ? <p className="text-sm text-red-600 mt-2">{error}</p> : null}
      </div>

      {categories.map((category) => {
        const services = catalog.filter((s) => s.category === category);
        if (services.length === 0) return null;
        return (
          <div key={category}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">
              {category}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {services.map((s) => {
                const on = eligible.has(s.value);
                const saving = savingKey === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    disabled={saving}
                    onClick={() => toggle(s.value)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left transition ${
                      on
                        ? "border-[#e85d04] bg-[#e85d04]/5 text-neutral-900"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                    }`}>
                    <span>{s.label}</span>
                    {saving ? (
                      <Loader2 size={16} className="animate-spin text-neutral-400" />
                    ) : on ? (
                      <Check size={16} className="text-[#e85d04]" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-neutral-300" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
