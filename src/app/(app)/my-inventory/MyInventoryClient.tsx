"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  AlertTriangle,
  AlertCircle,
  ShoppingCart,
  RefreshCw,
  Droplets,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { createInventoryRequest } from "../actions/createInventoryRequest";

interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productDescription: string | null;
  unit: string;
  quantity: number;
  refillThreshold: number;
  usagePerJob: number;
  assignedAt: string;
  updatedAt: string;
  isLow: boolean;
  isOutOfStock: boolean;
}

interface RequestItem {
  id: string;
  productName: string | null;
  kitName: string | null;
  quantity: number;
  status: string;
  reason: string | null;
  createdAt: string;
}

interface Location {
  id: string;
  name: string;
  address: string | null;
}

interface MyInventoryClientProps {
  items: InventoryItem[];
  requests: RequestItem[];
  locations: Location[];
}

type TabId = "inventory" | "requests";

export default function MyInventoryClient({
  items,
  requests,
  locations,
}: MyInventoryClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("inventory");
  const [refillItem, setRefillItem] = useState<InventoryItem | null>(null);
  const [refillQuantity, setRefillQuantity] = useState<number>(0);
  const [refillReason, setRefillReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const lowOrOutCount = items.filter(
    (i) => i.isLow || i.isOutOfStock
  ).length;

  function openRefill(item: InventoryItem) {
    setRefillItem(item);
    setRefillQuantity(Math.max(item.refillThreshold * 2, item.usagePerJob, 1));
    setRefillReason("");
    setFeedback(null);
  }

  function closeRefill() {
    setRefillItem(null);
    setRefillQuantity(0);
    setRefillReason("");
  }

  async function submitRefill() {
    if (!refillItem) return;
    if (refillQuantity <= 0) {
      setFeedback({ type: "error", text: "Quantity must be greater than 0." });
      return;
    }
    setSubmitting(true);
    const res = await createInventoryRequest({
      productId: refillItem.productId,
      quantity: refillQuantity,
      reason: refillReason || `Refill for ${refillItem.productName}`,
    });
    setSubmitting(false);
    if (res.success) {
      setFeedback({ type: "success", text: "Refill request submitted." });
      setTimeout(() => {
        closeRefill();
        router.refresh();
      }, 600);
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Failed to submit request.",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card variant="ghost">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-[400] text-gray-900">My Inventory</h1>
            <p className="text-sm text-[#005F6A]/70 mt-1">
              Equipment and supplies assigned to you
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="md"
              submit={false}
              href="/my-inventory/rag-wash">
              <Droplets className="w-4 h-4 mr-1.5" />
              Rag Washes
            </Button>
            <Button
              variant="primary"
              size="md"
              submit={false}
              href="/my-inventory/checkout">
              <ShoppingCart className="w-4 h-4 mr-1.5" />
              Pick Up from Storage
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="default" className="p-5">
          <p className="text-xs uppercase tracking-wide text-[#005F6A]/60">
            Items Assigned
          </p>
          <p className="text-2xl font-[400] text-[#005F6A] mt-1">
            {items.length}
          </p>
        </Card>
        <Card variant="default" className="p-5">
          <p className="text-xs uppercase tracking-wide text-[#005F6A]/60">
            Needs Attention
          </p>
          <p className="text-2xl font-[400] text-amber-600 mt-1">
            {lowOrOutCount}
          </p>
        </Card>
        <Card variant="default" className="p-5">
          <p className="text-xs uppercase tracking-wide text-[#005F6A]/60">
            Storage Locations
          </p>
          <p className="text-2xl font-[400] text-[#005F6A] mt-1">
            {locations.length}
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-[#005F6A]/5 rounded-2xl p-1 w-fit">
        <Button
          border={false}
          onClick={() => setActiveTab("inventory")}
          variant={activeTab === "inventory" ? "action" : "ghost"}
          size="md"
          className="rounded-xl px-4 md:px-6 py-3 whitespace-nowrap">
          <Package className="w-4 h-4 mr-2 hidden sm:inline" />
          Current Inventory
        </Button>
        <Button
          border={false}
          onClick={() => setActiveTab("requests")}
          variant={activeTab === "requests" ? "action" : "ghost"}
          size="md"
          className="rounded-xl px-4 md:px-6 py-3 whitespace-nowrap">
          <RefreshCw className="w-4 h-4 mr-2 hidden sm:inline" />
          Recent Requests
        </Button>
      </div>

      {activeTab === "inventory" && (
        <Card variant="default" className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                    Refill Threshold
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-[400] text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-gray-500">
                      <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="font-[400] text-gray-900 mb-1">
                        No products assigned
                      </p>
                      <p>
                        Visit{" "}
                        <a
                          href="/my-inventory/checkout"
                          className="text-[#005F6A] underline">
                          checkout
                        </a>{" "}
                        to pick up equipment.
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="font-[400] text-gray-900">
                          {item.productName}
                        </div>
                        {item.productDescription && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {item.productDescription}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {item.refillThreshold > 0
                          ? `${item.refillThreshold} ${item.unit}`
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        {item.isOutOfStock ? (
                          <Badge variant="default" size="sm" className="!w-fit">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Out
                          </Badge>
                        ) : item.isLow ? (
                          <Badge
                            variant="secondary"
                            size="sm"
                            className="!w-fit">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Low
                          </Badge>
                        ) : (
                          <Badge variant="cleano" size="sm" className="!w-fit">
                            OK
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {new Date(item.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openRefill(item)}
                          submit={false}>
                          Request Refill
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === "requests" && (
        <Card variant="default" className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-sm text-gray-500">
                      No requests yet.
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 text-gray-600 text-xs">
                        {new Date(r.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {r.productName || r.kitName || "Item"}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{r.quantity}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs max-w-md truncate">
                        {r.reason || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            r.status === "FULFILLED"
                              ? "cleano"
                              : r.status === "REJECTED"
                              ? "default"
                              : "secondary"
                          }
                          size="sm"
                          className="!w-fit">
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={refillItem !== null}
        onClose={closeRefill}
        title={
          refillItem ? `Request Refill: ${refillItem.productName}` : "Refill"
        }>
        {refillItem && (
          <div className="space-y-4">
            <div className="text-sm text-[#005F6A]/70">
              Current: {refillItem.quantity} {refillItem.unit} · Threshold:{" "}
              {refillItem.refillThreshold} {refillItem.unit}
            </div>
            <div>
              <label className="text-xs font-[350] text-[#005F6A]/70 uppercase tracking-wide mb-2 block">
                Quantity to Request
              </label>
              <Input
                variant="form"
                type="number"
                min="0"
                step="0.01"
                value={refillQuantity}
                onChange={(e) =>
                  setRefillQuantity(parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <label className="text-xs font-[350] text-[#005F6A]/70 uppercase tracking-wide mb-2 block">
                Reason (optional)
              </label>
              <Input
                variant="form"
                value={refillReason}
                onChange={(e) => setRefillReason(e.target.value)}
                placeholder="e.g. Running low for upcoming jobs"
              />
            </div>

            {feedback && (
              <div
                className={`px-4 py-3 rounded-xl text-sm ${
                  feedback.type === "success"
                    ? "bg-[#005F6A]/10 text-[#005F6A]"
                    : "bg-red-50 text-red-700"
                }`}>
                {feedback.text}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                border={false}
                onClick={closeRefill}
                className="rounded-xl">
                Cancel
              </Button>
              <Button
                type="button"
                variant="action"
                border={false}
                onClick={submitRefill}
                disabled={submitting}
                className="rounded-xl px-6">
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
