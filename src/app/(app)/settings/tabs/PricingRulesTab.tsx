"use client";

import { useState } from "react";
import { Plus, Trash2, DollarSign, Sparkles, BedDouble, Bath } from "lucide-react";
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
  perBedroom: number;
  perFullBath: number;
  perHalfBath: number;
}

interface AddOn {
  id: string;
  name: string;
  price: number;
}

const PER_UNIT_KEY = "pricing.perUnit";
const ADDONS_KEY = "pricing.addOns";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function PricingRulesTab({ settings }: PricingRulesTabProps) {
  const initialRates = getSetting<PerUnitRates>(settings, PER_UNIT_KEY, {
    perBedroom: 19,
    perFullBath: 19,
    perHalfBath: 10,
  });

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

  const [rates, setRates] = useState<PerUnitRates>(initialRates);
  const [addOns, setAddOns] = useState<AddOn[]>(initialAddOns);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  function updateAddOn(id: string, patch: Partial<AddOn>) {
    setAddOns((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function addAddOn() {
    setAddOns((prev) => [...prev, { id: uid(), name: "", price: 0 }]);
  }

  function removeAddOn(id: string) {
    setAddOns((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);

    const [r1, r2] = await Promise.all([
      updateAppSetting({ key: PER_UNIT_KEY, category: "pricing", value: rates }),
      updateAppSetting({ key: ADDONS_KEY, category: "pricing", value: addOns }),
    ]);

    if (r1.success && r2.success) {
      setMsg({ type: "success", text: "Pricing rules saved." });
    } else {
      setMsg({ type: "error", text: r1.error ?? r2.error ?? "Failed to save." });
    }
    setSaving(false);
  }

  const examplePrice =
    2 * rates.perBedroom + 1 * rates.perFullBath + 0 * rates.perHalfBath;

  return (
    <div className="space-y-6">
      {/* Per-Unit Rates */}
      <SectionCard
        title="Per-Unit Pricing"
        description="Base price is calculated as: (bedrooms × rate) + (full baths × rate) + (half baths × rate)."
        icon={BedDouble}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Per Bedroom ($)">
            <Input
              variant="form"
              type="number"
              min="0"
              step="1"
              value={rates.perBedroom}
              onChange={(e) =>
                setRates((r) => ({ ...r, perBedroom: parseFloat(e.target.value) || 0 }))
              }
            />
          </Field>
          <Field label="Per Full Bathroom ($)">
            <Input
              variant="form"
              type="number"
              min="0"
              step="1"
              value={rates.perFullBath}
              onChange={(e) =>
                setRates((r) => ({ ...r, perFullBath: parseFloat(e.target.value) || 0 }))
              }
            />
          </Field>
          <Field label="Per Half Bathroom ($)">
            <Input
              variant="form"
              type="number"
              min="0"
              step="1"
              value={rates.perHalfBath}
              onChange={(e) =>
                setRates((r) => ({ ...r, perHalfBath: parseFloat(e.target.value) || 0 }))
              }
            />
          </Field>
        </div>
        <p className="text-sm text-[#005F6A]/60 mt-3">
          Example: 2 bed + 1 full bath = <strong>${examplePrice.toFixed(2)}</strong>
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
            <p className="text-sm text-[#005F6A]/60">No add-ons configured.</p>
          )}
          {addOns.map((addon) => (
            <div key={addon.id} className="grid grid-cols-[2fr_1fr_auto] gap-3 items-end">
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
