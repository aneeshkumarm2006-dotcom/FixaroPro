"use client";

import { useState } from "react";
import { Plus, Trash2, DollarSign, Sparkles, Clock } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { updateAppSetting } from "../../actions/updateAppSetting";
import { AppSettingRecord, getSetting } from "../types";
import { SectionCard, Field, Feedback, Msg } from "./_shared";

interface PricingRulesTabProps {
  settings: AppSettingRecord[];
}

interface PerUnitRates {
  hourlyRate: number;
  threeHourPackage: number;
  // Legacy fields (kept for backward compat with existing saved blobs)
  siliconePerRoom?: number;
  weatherproofingMin?: number;
  weatherproofingMax?: number;
  baseServicePrice?: number;
  perBedroom?: number;
  perFullBath?: number;
  perHalfBath?: number;
}

export type RoomType =
  | "KITCHEN"
  | "BATHROOM"
  | "BEDROOM"
  | "LIVING_ROOM"
  | "LAUNDRY"
  | "OUTDOOR"
  | "WHOLE_HOME";

const ROOM_OPTIONS: { value: RoomType; label: string }[] = [
  { value: "KITCHEN", label: "Kitchen" },
  { value: "BATHROOM", label: "Bathroom" },
  { value: "BEDROOM", label: "Bedroom" },
  { value: "LIVING_ROOM", label: "Living room" },
  { value: "LAUNDRY", label: "Laundry" },
  { value: "OUTDOOR", label: "Outdoor / patio" },
  { value: "WHOLE_HOME", label: "Whole home" },
];

interface AddOn {
  id: string;
  name: string;
  price: number;
  roomType?: RoomType;
}

const PER_UNIT_KEY = "pricing.perUnit";
const ADDONS_KEY = "pricing.addOns";
// Canonical billing keys read by src/lib/billing.ts (getBillingConfig). The
// labour rate is written here AND kept inside the perUnit blob so the two never
// diverge (decision D1.1). Increment + minimum are the D0.8 billing knobs.
const LABOUR_RATE_KEY = "pricing.labourRate";
const THREE_HOUR_PACKAGE_KEY = "pricing.threeHourPackage";
const BILLING_INCREMENT_KEY = "pricing.billingIncrementMinutes";
const MIN_BILLABLE_HOURS_KEY = "pricing.minBillableHours";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function PricingRulesTab({ settings }: PricingRulesTabProps) {
  const initialRates = getSetting<PerUnitRates>(settings, PER_UNIT_KEY, {
    hourlyRate: 79,
    threeHourPackage: 209,
  });

  // Canonical labour rate wins over the legacy perUnit.hourlyRate if it exists
  // (getBillingConfig reads it first). Increment + minimum drive clocked billing.
  const savedLabourRate = getSetting<number | null>(settings, LABOUR_RATE_KEY, null);
  const initialHourlyRate =
    typeof savedLabourRate === "number" && savedLabourRate > 0
      ? savedLabourRate
      : initialRates.hourlyRate ?? 79;
  const initialIncrement = getSetting<number>(settings, BILLING_INCREMENT_KEY, 15);
  const initialMinBillableHours = getSetting<number>(settings, MIN_BILLABLE_HOURS_KEY, 2);

  // Legacy key still used by add-ons fallback
  const legacyConfig = getSetting<{ addOns?: AddOn[] }>(settings, "pricing.rules", {});
  const initialAddOns = getSetting<AddOn[]>(
    settings,
    ADDONS_KEY,
    legacyConfig.addOns ?? [
      { id: uid(), name: "Inside Fridge", price: 25 },
      { id: uid(), name: "Inside Oven", price: 30 },
    ]
  );

  const [rates, setRates] = useState<PerUnitRates>({
    // Preserve any legacy keys already in the blob rather than dropping them on
    // the next save — they are dead, but silently deleting an admin's saved data
    // is not this tab's call to make.
    ...initialRates,
    hourlyRate: initialHourlyRate,
    threeHourPackage: initialRates.threeHourPackage ?? 209,
  });
  const [billingIncrement, setBillingIncrement] = useState<number>(initialIncrement);
  const [minBillableHours, setMinBillableHours] = useState<number>(initialMinBillableHours);
  const [addOns, setAddOns] = useState<AddOn[]>(initialAddOns);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  function updateAddOn(id: string, patch: Partial<AddOn>) {
    setAddOns((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function addAddOn() {
    setAddOns((prev) => [...prev, { id: uid(), name: "", price: 0, roomType: "WHOLE_HOME" }]);
  }

  function removeAddOn(id: string) {
    setAddOns((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);

    const safeIncrement = billingIncrement > 0 ? billingIncrement : 15;
    const safeMinHours = minBillableHours > 0 ? minBillableHours : 2;

    const results = await Promise.all([
      updateAppSetting({ key: PER_UNIT_KEY, category: "pricing", value: rates }),
      updateAppSetting({ key: ADDONS_KEY, category: "pricing", value: addOns }),
      // Canonical keys consumed by the config layer (policy-registry.ts). These
      // MUST be written alongside the legacy `pricing.perUnit` blob: resolvePolicy
      // prefers the canonical key, so writing only the blob would leave the
      // canonical value stale and this tab would silently do nothing (D1.1).
      updateAppSetting({ key: LABOUR_RATE_KEY, category: "pricing", value: rates.hourlyRate }),
      updateAppSetting({ key: THREE_HOUR_PACKAGE_KEY, category: "pricing", value: rates.threeHourPackage }),
      // Clocked-billing knobs (D0.8).
      updateAppSetting({ key: BILLING_INCREMENT_KEY, category: "pricing", value: safeIncrement }),
      updateAppSetting({ key: MIN_BILLABLE_HOURS_KEY, category: "pricing", value: safeMinHours }),
    ]);

    const failed = results.find((r) => !r.success);
    if (!failed) {
      setMsg({ type: "success", text: "Pricing rules saved." });
    } else {
      setMsg({ type: "error", text: failed.error ?? "Failed to save." });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* Hourly Rates. As of Stage 8 the labour rate, 3-hour package, increment
          and minimum all live in the policy registry and are edited on Service
          Catalog → Policy. This tab keeps them for continuity and dual-writes
          the canonical keys, so saving here can never silently revert a change
          made there. The Silicone/Weatherproofing fields are GONE: they wrote
          `pricing.perUnit.siliconePerRoom` / `weatherproofingMin` / `Max`, which
          nothing ever read — booking-pricing.ts hardcoded 209 and 74.5. Both
          prices are now real, editable fields on the service record itself. */}
      <SectionCard
        title="Hourly Pricing"
        description="Standard rate + clocked-billing knobs. These are the same values as Service Catalog → Policy — edit them in either place."
        icon={Clock}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Hourly rate ($/hr)">
            <Input
              variant="form"
              type="number"
              min="0"
              step="1"
              value={rates.hourlyRate}
              onChange={(e) =>
                setRates((r) => ({ ...r, hourlyRate: parseFloat(e.target.value) || 79 }))
              }
            />
          </Field>
          <Field label="Billing round-up increment (minutes)">
            <Input
              variant="form"
              type="number"
              min="1"
              step="1"
              value={billingIncrement}
              onChange={(e) => setBillingIncrement(parseInt(e.target.value, 10) || 15)}
            />
          </Field>
          <Field label="Minimum billable hours">
            <Input
              variant="form"
              type="number"
              min="0"
              step="0.5"
              value={minBillableHours}
              onChange={(e) => setMinBillableHours(parseFloat(e.target.value) || 2)}
            />
          </Field>
          <Field label="3-hour package price ($)">
            <Input
              variant="form"
              type="number"
              min="0"
              step="1"
              value={rates.threeHourPackage}
              onChange={(e) =>
                setRates((r) => ({ ...r, threeHourPackage: parseFloat(e.target.value) || 209 }))
              }
            />
          </Field>
        </div>
        <p className="text-sm text-[#1c1917]/60 mt-3">
          Example: 2h = <strong>${(rates.hourlyRate * 2).toFixed(0)}</strong> · 3h = <strong>${rates.threeHourPackage.toFixed(0)}</strong> · 4h = <strong>${(rates.hourlyRate * 4).toFixed(0)}</strong>
        </p>
        <p className="text-sm text-[#1c1917]/60 mt-2">
          Fixed-price services (Silicone Sealing, Weatherproofing) are priced on their own
          catalog record — <strong>Service Catalog → Services</strong>.
        </p>
      </SectionCard>

      {/* Add-Ons */}
      <SectionCard
        title="Add-Ons"
        description="Optional services that can be added to a booking."
        icon={Sparkles}
        actions={
          <Button
            type="button"
            variant="default"
            border={false}
            size="sm"
            onClick={addAddOn}
            className="rounded-xl">
            <Plus className="w-4 h-4 mr-1" /> Add Add-On
          </Button>
        }>
        <div className="space-y-3">
          {addOns.length === 0 && (
            <p className="text-sm text-[#1c1917]/60">No add-ons configured.</p>
          )}
          {addOns.map((addon) => (
            <div key={addon.id} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.4fr_auto] gap-3 items-end">
              <Field label="Name">
                <Input
                  variant="form"
                  value={addon.name}
                  onChange={(e) => updateAddOn(addon.id, { name: e.target.value })}
                  placeholder="e.g. Inside Fridge"
                />
              </Field>
              <Field label="Price ($)">
                <Input
                  variant="form"
                  type="number"
                  min="0"
                  step="0.01"
                  value={addon.price}
                  onChange={(e) =>
                    updateAddOn(addon.id, { price: parseFloat(e.target.value) || 0 })
                  }
                />
              </Field>
              <Field label="Room">
                <select
                  value={addon.roomType ?? "WHOLE_HOME"}
                  onChange={(e) =>
                    updateAddOn(addon.id, { roomType: e.target.value as RoomType })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#1c1917]/15 bg-white text-[#003C46] text-sm focus:outline-none focus:border-[#1c1917] focus:ring-2 focus:ring-[#e85d04]/10">
                  {ROOM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <IconButton
                icon={Trash2}
                variant="ghost"
                size="sm"
                onClick={() => removeAddOn(addon.id)}
                className="text-red-500"
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {msg && <Feedback msg={msg} />}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="action"
          border={false}
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl px-6 py-2.5">
          {saving ? "Saving..." : "Save Pricing Rules"}
        </Button>
      </div>
    </div>
  );
}
