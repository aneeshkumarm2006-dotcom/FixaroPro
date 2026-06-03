"use client";

import { useState } from "react";
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import DatePicker from "@/components/customer/DatePicker";
import PremiumSelect from "@/components/ui/PremiumSelect";
import { ConfirmDeleteModal } from "@/components/common/ConfirmDeleteModal";
import { createPromoCode, togglePromoCode, deletePromoCode } from "./actions";

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function PromoCodesClient({ codes }: { codes: PromoCode[] }) {
  const [list, setList] = useState(codes);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    const res = await createPromoCode({
      code,
      description,
      discountType,
      discountValue: parseFloat(discountValue),
      maxUses: maxUses ? parseInt(maxUses) : null,
      expiresAt: expiresAt || null,
    });
    setCreating(false);
    if (!res.success) { setFormError(res.error ?? "Failed"); return; }
    // Reset form
    setCode(""); setDescription(""); setDiscountValue(""); setMaxUses(""); setExpiresAt("");
    setShowForm(false);
    window.location.reload();
  }

  async function handleToggle(id: string) {
    setBusyId(id);
    await togglePromoCode(id);
    setList((l) => l.map((c) => c.id === id ? { ...c, isActive: !c.isActive } : c));
    setBusyId(null);
  }

  const [deleteId, setDeleteId] = useState<string | null>(null);
  function handleDelete(id: string) { setDeleteId(id); }
  async function runDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    setBusyId(id);
    await deletePromoCode(id);
    setList((l) => l.filter((c) => c.id !== id));
    setBusyId(null);
  }

  function fmt(c: PromoCode) {
    return c.discountType === "PERCENT"
      ? `${c.discountValue}% off`
      : `$${c.discountValue.toFixed(2)} off`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl !font-light tracking-tight text-[#1c1917] flex items-center gap-3">
            <Tag className="w-7 h-7" /> Promo Codes
          </h1>
          <p className="text-sm text-[#1c1917]/70 mt-1">
            Create and manage discount codes for customers.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-[#e85d04] text-white rounded-xl text-sm font-semibold hover:bg-[#c44c03] transition-colors">
          <Plus className="w-4 h-4" />
          New code
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-[#1c1917]">New promo code</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Code</label>
              <input
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#e85d04]/30"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SUMMER20"
                maxLength={24}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Description</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e85d04]/30"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Summer 2026 promo"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Discount type</label>
              <PremiumSelect
                value={discountType}
                onChange={(v) => setDiscountType(v as "FIXED" | "PERCENT")}
                options={[
                  { value: "FIXED", label: "Fixed ($)" },
                  { value: "PERCENT", label: "Percentage (%)" },
                ]}
                size="sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                Value {discountType === "FIXED" ? "($)" : "(%)"}
              </label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e85d04]/30"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "FIXED" ? "20.00" : "15"}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Max uses (blank = unlimited)</label>
              <input
                type="number"
                min="1"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e85d04]/30"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Expires (blank = never)</label>
              <DatePicker
                value={expiresAt}
                onChange={setExpiresAt}
                min={new Date().toISOString().slice(0, 10)}
                placeholder="No expiry"
              />
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 bg-[#e85d04] text-white rounded-xl text-sm font-semibold hover:bg-[#c44c03] transition-colors disabled:opacity-60 flex items-center gap-2">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 text-gray-600 text-sm hover:text-gray-900">
              Cancel
            </button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No promo codes yet.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Code</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Discount</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Uses</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Expires</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-semibold text-[#1c1917]">{c.code}</td>
                  <td className="px-5 py-3.5 font-medium">{fmt(c)}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {c.usesCount}{c.maxUses ? ` / ${c.maxUses}` : ""}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggle(c.id)}
                        disabled={busyId === c.id}
                        className="text-gray-400 hover:text-[#1c1917] transition-colors disabled:opacity-40"
                        title={c.isActive ? "Deactivate" : "Activate"}>
                        {c.isActive
                          ? <ToggleRight className="w-5 h-5 text-[#1c1917]" />
                          : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={busyId === c.id}
                        className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                        title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={runDelete}
        fileName="this promo code"
        title="Delete promo code?"
        message="This action cannot be undone."
      />
    </div>
  );
}
