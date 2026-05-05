"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ShoppingCart, MapPin, Package } from "lucide-react";

interface SummaryItem {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
}

interface CheckoutSummaryProps {
  locationName: string;
  locationAddress: string | null;
  items: SummaryItem[];
  notes: string;
  onNotesChange: (val: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  submitting: boolean;
}

export default function CheckoutSummary({
  locationName,
  locationAddress,
  items,
  notes,
  onNotesChange,
  onConfirm,
  onBack,
  submitting,
}: CheckoutSummaryProps) {
  const totalItems = items.length;
  const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <Card variant="default" className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <ShoppingCart className="w-5 h-5 text-[#005F6A]" />
        <h2 className="text-xl font-[400] text-gray-900">Review & Confirm</h2>
      </div>

      <div className="rounded-xl bg-[#005F6A]/5 p-4">
        <div className="flex items-center gap-2 text-sm text-[#005F6A]">
          <MapPin className="w-4 h-4" />
          <span className="font-[400]">{locationName}</span>
        </div>
        {locationAddress && (
          <p className="text-xs text-[#005F6A]/70 mt-1 ml-6">
            {locationAddress}
          </p>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-[#005F6A]/60 mb-2">
          Items ({totalItems})
        </p>
        <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
          {items.map((i) => (
            <div
              key={i.productId}
              className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900">{i.productName}</span>
              </div>
              <span className="text-gray-700">
                {i.quantity} {i.unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-[350] text-[#005F6A]/70 uppercase tracking-wide mb-2 block">
          Pickup Notes (optional)
        </label>
        <Input
          variant="form"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="e.g. Picking up before 8am job"
        />
      </div>

      <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
        <span className="text-gray-600">Total units</span>
        <span className="font-[400] text-gray-900">
          {totalUnits.toFixed(2)}
        </span>
      </div>

      <div className="flex justify-between gap-2 pt-2">
        <Button
          variant="ghost"
          submit={false}
          onClick={onBack}
          disabled={submitting}>
          Back
        </Button>
        <Button
          variant="primary"
          submit={false}
          onClick={onConfirm}
          disabled={submitting || items.length === 0}>
          {submitting ? "Processing..." : "Confirm Pickup"}
        </Button>
      </div>
    </Card>
  );
}
