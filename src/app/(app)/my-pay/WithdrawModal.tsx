"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";
import { requestWithdrawal } from "../actions/requestWithdrawal";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
}

const PAYMENT_METHODS = [
  { value: "E_TRANSFER", label: "E-Transfer" },
  { value: "CASH", label: "Direct Deposit" },
  { value: "CHEQUE", label: "Cheque" },
];

export default function WithdrawModal({
  isOpen,
  onClose,
  availableBalance,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("E_TRANSFER");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function reset() {
    setAmount("");
    setPaymentMethod("E_TRANSFER");
    setNotes("");
    setError(null);
    setSuccess(false);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function handleSubmit() {
    setError(null);
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (num > availableBalance + 0.001) {
      setError(`Amount exceeds available balance ($${availableBalance.toFixed(2)})`);
      return;
    }

    setSubmitting(true);
    const result = await requestWithdrawal({
      amount: num,
      paymentMethod: paymentMethod as
        | "CASH"
        | "CHEQUE"
        | "E_TRANSFER"
        | "CREDIT_CARD"
        | "OTHER",
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || "Failed to submit withdrawal request");
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Request Withdrawal">
      {success ? (
        <div className="py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <p className="text-base font-[400] text-[#005F6A]">
            Withdrawal request submitted
          </p>
          <p className="text-sm text-[#005F6A]/60 mt-1">
            An admin has been notified and will review your request shortly.
          </p>
          <div className="mt-6">
            <Button variant="primary" submit={false} onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#005F6A]/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#005F6A]/60">
                Available Balance
              </p>
              <p className="text-2xl font-[400] text-[#005F6A] mt-1">
                ${availableBalance.toFixed(2)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-[#005F6A]/30" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[#005F6A]/60 mb-2">
              Amount
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={availableBalance}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              variant="form"
              size="lg"
            />
            <button
              type="button"
              onClick={() => setAmount(availableBalance.toFixed(2))}
              className="text-xs text-[#005F6A]/70 hover:text-[#005F6A] underline decoration-dotted underline-offset-2 mt-1.5">
              Withdraw full balance
            </button>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[#005F6A]/60 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(m.value)}
                  className={`px-3 py-2 rounded-2xl text-sm border transition-colors ${
                    paymentMethod === m.value
                      ? "bg-[#005F6A] text-white border-[#005F6A]"
                      : "bg-white text-[#005F6A] border-[#005F6A]/15 hover:bg-[#005F6A]/5"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[#005F6A]/60 mb-2">
              Notes (optional)
            </label>
            <Textarea
              variant="form"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details for the admin..."
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 text-red-700 px-3 py-2 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="cancel"
              submit={false}
              onClick={handleClose}
              disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              submit={false}
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting || availableBalance <= 0}>
              Confirm Withdrawal
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
