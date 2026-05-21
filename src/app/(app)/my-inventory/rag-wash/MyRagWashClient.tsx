"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import DatePicker from "@/components/ui/DatePicker";
import { createRagWash } from "../../actions/createRagWash";
import {
  ArrowLeft,
  Plus,
  Droplets,
  Calendar,
} from "lucide-react";

interface WashEntry {
  id: string;
  washDate: string;
  ragCount: number;
  notes: string | null;
}

interface MyRagWashClientProps {
  employeeId: string;
  washes: WashEntry[];
  totalRags: number;
  totalWashes: number;
  lastWashDate: string | null;
}

export default function MyRagWashClient({
  employeeId,
  washes,
  totalRags,
  totalWashes,
  lastWashDate,
}: MyRagWashClientProps) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [washDate, setWashDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [ragCount, setRagCount] = useState("1");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setWashDate(new Date().toISOString().split("T")[0]);
    setRagCount("1");
    setNotes("");
    setMessage(null);
  };

  const handleAdd = async () => {
    setSaving(true);
    setMessage(null);
    const res = await createRagWash({
      employeeId,
      washDate,
      ragCount: parseInt(ragCount) || 0,
      notes: notes || undefined,
    });
    if (res.success) {
      setMessage({ type: "success", text: "Wash entry logged." });
      setTimeout(() => {
        setShowAddModal(false);
        resetForm();
        router.refresh();
      }, 600);
    } else {
      setMessage({ type: "error", text: res.error || "Failed to log entry." });
    }
    setSaving(false);
  };

  const avgRagsPerWash =
    totalWashes > 0 ? (totalRags / totalWashes).toFixed(1) : "0";

  return (
    <div className="max-w-[80rem] mx-auto space-y-6">
      <Button
        variant="default"
        size="sm"
        border={false}
        onClick={() => router.push("/my-inventory")}
        className="mb-2 px-6 py-3">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to My Inventory
      </Button>

      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl !font-light tracking-tight text-[#005F6A]">
            My Rag Washes
          </h1>
          <p className="text-sm text-[#005F6A]/70 !font-light mt-1">
            Log and track the rags you have laundered
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          border={false}
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="px-6 py-3">
          <Plus className="w-4 h-4 mr-2" />
          Log New Wash
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card variant="cleano_light" className="p-6 h-[7rem]">
          <div className="h-full flex flex-col justify-between">
            <span className="app-title-small !text-[#005F6A]/70">
              Total Washes
            </span>
            <p className="h2-title text-[#005F6A]">{totalWashes}</p>
          </div>
        </Card>
        <Card variant="cleano_light" className="p-6 h-[7rem]">
          <div className="h-full flex flex-col justify-between">
            <span className="app-title-small !text-[#005F6A]/70">
              Total Rags
            </span>
            <p className="h2-title text-[#005F6A]">{totalRags}</p>
          </div>
        </Card>
        <Card variant="cleano_light" className="p-6 h-[7rem]">
          <div className="h-full flex flex-col justify-between">
            <span className="app-title-small !text-[#005F6A]/70">
              Avg Rags/Wash
            </span>
            <p className="h2-title text-[#005F6A]">{avgRagsPerWash}</p>
          </div>
        </Card>
        <Card variant="cleano_light" className="p-6 h-[7rem]">
          <div className="h-full flex flex-col justify-between">
            <span className="app-title-small !text-[#005F6A]/70">
              Last Wash
            </span>
            <p className="text-lg font-[400] text-[#005F6A]">
              {lastWashDate
                ? new Date(lastWashDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-[350] tracking-tight text-[#005F6A]">
          Wash History
        </h2>

        {washes.length === 0 ? (
          <Card variant="ghost" className="p-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#005F6A]/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Droplets className="w-6 h-6 text-[#005F6A]/40" />
              </div>
              <p className="text-sm text-[#005F6A]/60">No wash entries yet</p>
              <p className="text-xs text-[#005F6A]/40 mt-1">
                Click &ldquo;Log New Wash&rdquo; to record a rag wash
              </p>
            </div>
          </Card>
        ) : (
          <Card variant="default" className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                      Rag Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-[400] text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {washes.map((wash) => (
                    <tr key={wash.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-[#005F6A]/10 rounded-lg">
                            <Calendar className="w-4 h-4 text-[#005F6A]" />
                          </div>
                          <div className="text-gray-900">
                            {new Date(wash.washDate).toLocaleDateString(
                              "en-US",
                              {
                                weekday: "short",
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="cleano" size="sm" className="!w-fit">
                          {wash.ragCount} rag{wash.ragCount !== 1 ? "s" : ""}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs max-w-md">
                        {wash.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="Log New Wash">
        <div className="space-y-4">
          <div>
            <label className="input-label !text-[#005F6A]/70 mb-1 block">
              Wash Date
            </label>
            <DatePicker
              value={washDate}
              onChange={setWashDate}
              size="md"
            />
          </div>
          <div>
            <label className="input-label !text-[#005F6A]/70 mb-1 block">
              Rag Count
            </label>
            <Input
              type="number"
              min="1"
              value={ragCount}
              onChange={(e) => setRagCount(e.target.value)}
              placeholder="Number of rags washed"
              variant="form"
              border={false}
              size="md"
            />
          </div>
          <div>
            <label className="input-label !text-[#005F6A]/70 mb-1 block">
              Notes (optional)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              variant="form"
              border={false}
              size="md"
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded-xl text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="default"
              size="md"
              border={false}
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="px-6 py-3">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              border={false}
              onClick={handleAdd}
              disabled={saving}
              className="px-6 py-3">
              {saving ? "Saving..." : "Log Wash"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
