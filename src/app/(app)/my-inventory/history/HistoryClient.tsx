"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  History,
  MapPin,
  Package,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import DatePicker from "@/components/ui/DatePicker";
import type { CheckoutHistoryEntry } from "../../actions/getCheckoutHistory.types";

interface KitChange {
  id: string;
  productName: string;
  quantityChange: number;
  newQuantity: number;
  unit: string;
  reason: string | null;
  createdAt: string;
}

interface HistoryClientProps {
  checkouts: CheckoutHistoryEntry[];
  error: string | null;
  initialStart: string;
  initialEnd: string;
  changes: KitChange[];
}

type SortDir = "desc" | "asc";

export default function HistoryClient({
  checkouts,
  error,
  initialStart,
  initialEnd,
  changes,
}: HistoryClientProps) {
  const router = useRouter();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    const arr = [...checkouts];
    arr.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sortDir === "desc" ? tb - ta : ta - tb;
    });
    return arr;
  }, [checkouts, sortDir]);

  function applyFilters() {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const qs = params.toString();
    router.push(qs ? `/my-inventory/history?${qs}` : "/my-inventory/history");
  }

  function clearFilters() {
    setStart("");
    setEnd("");
    router.push("/my-inventory/history");
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalPickups = sorted.length;
  const totalItems = sorted.reduce((acc, c) => acc + c.items.length, 0);

  return (
    <div className="space-y-6">
      <Card variant="ghost">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Button
              variant="ghost"
              size="sm"
              submit={false}
              href="/my-inventory"
              className="!px-2 mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <h1 className="text-3xl font-[400] text-gray-900 flex items-center gap-2">
              <History className="w-7 h-7 text-[#1c1917]" />
              Pickup History
            </h1>
            <p className="text-sm text-[#1c1917]/70 mt-1">
              All inventory pickups you have made
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card variant="default" className="p-5">
          <p className="text-xs uppercase tracking-wide text-[#1c1917]/60">
            Pickups
          </p>
          <p className="text-2xl font-[400] text-[#1c1917] mt-1">
            {totalPickups}
          </p>
        </Card>
        <Card variant="default" className="p-5">
          <p className="text-xs uppercase tracking-wide text-[#1c1917]/60">
            Items Picked Up
          </p>
          <p className="text-2xl font-[400] text-[#1c1917] mt-1">
            {totalItems}
          </p>
        </Card>
      </div>

      {/* Kit stock changes — the Pro's own audit trail (prev → new): pickups,
          admin adjustments, damage/loss, and job usage. */}
      {changes.length > 0 && (
        <Card variant="default" className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#1c1917]" />
            <h2 className="font-[400] text-[#1c1917]">Kit stock changes</h2>
          </div>
          <div className="space-y-2">
            {changes.map((c) => {
              const up = c.quantityChange >= 0;
              const previous = c.newQuantity - c.quantityChange;
              return (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#e85d04]/5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        up ? "bg-green-100" : "bg-red-100"
                      }`}>
                      {up ? (
                        <ArrowUpRight className="w-4 h-4 text-green-700" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-[400] text-[#1c1917]">
                        {c.productName}
                        <span className="text-[#1c1917]/60">
                          {" "}
                          · {previous} → {c.newQuantity} {c.unit}
                          {" ("}
                          {up ? "+" : ""}
                          {c.quantityChange})
                        </span>
                      </p>
                      <p className="text-xs text-[#1c1917]/60 truncate">
                        {new Date(c.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {c.reason ? ` · ${c.reason}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card variant="default" className="p-5">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-[350] text-[#1c1917]/70 uppercase tracking-wide mb-2 block">
              From
            </label>
            <DatePicker
              value={start}
              onChange={setStart}
              size="sm"
              placeholder="From date"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-[350] text-[#1c1917]/70 uppercase tracking-wide mb-2 block">
              To
            </label>
            <DatePicker
              value={end}
              onChange={setEnd}
              size="sm"
              placeholder="To date"
            />
          </div>
          <Button
            variant="primary"
            size="md"
            submit={false}
            onClick={applyFilters}>
            Apply
          </Button>
          {(initialStart || initialEnd) && (
            <Button
              variant="ghost"
              size="md"
              submit={false}
              onClick={clearFilters}>
              Clear
            </Button>
          )}
          <Button
            variant="ghost"
            size="md"
            submit={false}
            onClick={() =>
              setSortDir((d) => (d === "desc" ? "asc" : "desc"))
            }>
            {sortDir === "desc" ? (
              <ArrowDown className="w-4 h-4 mr-1.5" />
            ) : (
              <ArrowUp className="w-4 h-4 mr-1.5" />
            )}
            {sortDir === "desc" ? "Newest first" : "Oldest first"}
          </Button>
        </div>
      </Card>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {sorted.length === 0 ? (
        <Card variant="default" className="p-12 text-center">
          <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="font-[400] text-gray-900 mb-1">No pickups yet</p>
          <p className="text-sm text-gray-600 mb-4">
            Pickups you make from storage will appear here.
          </p>
          <Button
            variant="primary"
            size="md"
            submit={false}
            href="/my-inventory/checkout">
            Start a pickup
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((c) => {
            const isOpen = expanded.has(c.id);
            const totalUnits = c.items.reduce((a, i) => a + i.quantity, 0);
            return (
              <Card key={c.id} variant="default" className="p-5">
                <button
                  onClick={() => toggleExpand(c.id)}
                  className="w-full text-left">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm text-gray-500">
                        {new Date(c.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[#1c1917]">
                        <MapPin className="w-4 h-4" />
                        <span className="font-[400]">{c.location.name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-700">
                        {c.items.length} item
                        {c.items.length === 1 ? "" : "s"} ·{" "}
                        {totalUnits.toFixed(2)} units
                      </div>
                      <div className="text-xs text-[#1c1917]/60 mt-0.5">
                        {isOpen ? "Hide details" : "Show details"}
                      </div>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    {c.notes && (
                      <p className="text-sm text-gray-600 italic">
                        Note: {c.notes}
                      </p>
                    )}
                    <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
                      {c.items.map((i) => (
                        <div
                          key={i.productId}
                          className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-900">
                              {i.productName}
                            </span>
                          </div>
                          <span className="text-gray-700">
                            {i.quantity} {i.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
