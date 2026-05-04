"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { LogOut, Package, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { clockOut } from "../actions/clockOut";
import { requestRefill } from "../actions/requestRefill";

interface InventoryRule {
  usagePerJob: number;
  refillThreshold: number;
}

interface EmployeeProduct {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    unit: string;
    inventoryRule?: InventoryRule | null;
  };
}

interface ClockOutButtonProps {
  jobId: string;
  employeeProducts: EmployeeProduct[];
}

export default function ClockOutButton({
  jobId,
  employeeProducts,
}: ClockOutButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inventories, setInventories] = useState<{ [key: string]: string }>({});
  const [refillingId, setRefillingId] = useState<string | null>(null);
  const [refillRequested, setRefillRequested] = useState<{ [key: string]: boolean }>({});

  const handleOpenModal = () => {
    const initial: { [key: string]: string } = {};
    employeeProducts.forEach((ep) => {
      initial[ep.productId] = ep.quantity.toString();
    });
    setInventories(initial);
    setRefillRequested({});
    setShowModal(true);
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const productInventories = employeeProducts
        .map((ep) => ({
          productId: ep.productId,
          inventoryAfter: parseFloat(inventories[ep.productId] || "0"),
        }))
        .filter((inv) => !isNaN(inv.inventoryAfter));

      const result = await clockOut(jobId, productInventories);
      if (result.success) {
        setShowModal(false);
      } else {
        alert(result.error || "Failed to clock out");
      }
    } catch (error) {
      console.error("Error clocking out:", error);
      alert("Failed to clock out");
    } finally {
      setLoading(false);
    }
  };

  const handleInventoryChange = (productId: string, value: string) => {
    setInventories((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  const handleRequestRefill = async (ep: EmployeeProduct) => {
    setRefillingId(ep.productId);
    try {
      const usagePerJob = ep.product.inventoryRule?.usagePerJob ?? 0;
      const suggestedQty = usagePerJob > 0 ? Math.max(usagePerJob * 5, 1) : 1;
      const result = await requestRefill({
        productId: ep.productId,
        quantity: suggestedQty,
        reason: `Low stock during clock-out for job ${jobId}`,
      });
      if (result.success) {
        setRefillRequested((prev) => ({ ...prev, [ep.productId]: true }));
      } else {
        alert(result.error || "Failed to request refill");
      }
    } catch (error) {
      console.error("Error requesting refill:", error);
      alert("Failed to request refill");
    } finally {
      setRefillingId(null);
    }
  };

  return (
    <>
      <Button
        variant="cleano"
        size="md"
        onClick={handleOpenModal}
        className="flex-1">
        <LogOut className="w-4 h-4 mr-2" />
        Clock Out
      </Button>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Clock Out"
        className="max-w-2xl">
        <div className="space-y-4">
          <p className="text-sm text-neutral-950/70">
            Before clocking out, please update your product inventory levels.
            The system will calculate how much you&apos;ve used during this job.
          </p>

          {employeeProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-neutral-950/40 mx-auto mb-4" />
              <p className="text-sm text-neutral-950/60">
                No products assigned to you
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {employeeProducts.map((ep) => {
                const currentValue = parseFloat(
                  inventories[ep.productId] || "0"
                );
                const originalValue = ep.quantity;
                const used = originalValue - currentValue;
                const remaining = isNaN(currentValue) ? originalValue : currentValue;

                const refillThreshold = ep.product.inventoryRule?.refillThreshold ?? 0;
                const usagePerJob = ep.product.inventoryRule?.usagePerJob ?? 0;

                const isOutOfStock = remaining <= 0;
                const isLowStock =
                  !isOutOfStock &&
                  refillThreshold > 0 &&
                  remaining < refillThreshold;

                const cardBorder = isOutOfStock
                  ? "border-red-500/40 bg-red-500/5"
                  : isLowStock
                  ? "border-orange-500/40 bg-orange-500/5"
                  : "border-neutral-950/10 bg-neutral-950/10";

                return (
                  <div
                    key={ep.productId}
                    className={`p-4 rounded-lg border ${cardBorder}`}>
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-neutral-950/10 rounded-lg">
                        <Package className="w-5 h-5 text-neutral-950" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div>
                            <h4 className="font-[400] text-neutral-950">
                              {ep.product.name}
                            </h4>
                            <p className="text-sm text-neutral-950/60">
                              Started with: {originalValue} {ep.product.unit}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {isOutOfStock && (
                              <span className="inline-flex items-center gap-1 text-xs font-[400] text-red-700 bg-red-500/10 border border-red-500/30 rounded px-2 py-0.5">
                                <AlertCircle className="w-3 h-3" />
                                Out of stock
                              </span>
                            )}
                            {isLowStock && (
                              <span className="inline-flex items-center gap-1 text-xs font-[400] text-orange-700 bg-orange-500/10 border border-orange-500/30 rounded px-2 py-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                Low stock
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Input
                            label={`Remaining ${ep.product.unit}`}
                            type="number"
                            step="0.01"
                            min="0"
                            max={originalValue}
                            value={inventories[ep.productId] || ""}
                            onChange={(e) =>
                              handleInventoryChange(
                                ep.productId,
                                e.target.value
                              )
                            }
                            placeholder="Enter remaining quantity"
                          />

                          {usagePerJob > 0 && (
                            <div className="flex items-center gap-2 text-xs text-neutral-950/60">
                              <Info className="w-3 h-3" />
                              <span>
                                Average usage: {usagePerJob} {ep.product.unit}{" "}
                                per job
                              </span>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center justify-between p-2 bg-neutral-950/5 rounded">
                              <span className="text-neutral-950/70">Used:</span>
                              <span className="font-[400] text-neutral-950">
                                {used > 0 ? used.toFixed(2) : "0"}{" "}
                                {ep.product.unit}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-neutral-950/5 rounded">
                              <span className="text-neutral-950/70">
                                Remaining:
                              </span>
                              <span
                                className={`font-[400] ${
                                  isOutOfStock
                                    ? "text-red-700"
                                    : isLowStock
                                    ? "text-orange-700"
                                    : "text-neutral-950"
                                }`}>
                                {isNaN(currentValue)
                                  ? "-"
                                  : currentValue.toFixed(2)}{" "}
                                {ep.product.unit}
                              </span>
                            </div>
                          </div>

                          {(isLowStock || isOutOfStock) && (
                            <div className="pt-1">
                              {refillRequested[ep.productId] ? (
                                <p className="text-xs text-neutral-950/60 italic">
                                  Refill requested
                                </p>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRequestRefill(ep)}
                                  loading={refillingId === ep.productId}
                                  className="text-xs">
                                  Request refill
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => setShowModal(false)}
              disabled={loading}
              className="flex-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleClockOut}
              loading={loading}
              className="flex-1">
              Confirm Clock Out
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
