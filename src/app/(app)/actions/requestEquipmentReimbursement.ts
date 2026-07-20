"use server";

// Pro bought equipment for a job and submits the receipt/details to ops for
// compensation (SOP §8 — "buy equipment and send receipt/details to ops").
//
// Fix #7 (7d): this used to be fire-and-forget — an admin Alert plus an audit
// row, with nothing to review, approve or pay against. It now delegates to
// createEquipmentReimbursement, which writes a real EquipmentReimbursement row
// tied to the job, gated on an APPROVED pre-job equipment plan, and still
// raises the same ops Alert.
//
// Kept as a thin adapter so the existing EquipmentPanel call site (and any
// other caller) keeps working with the old `description` field name.

import { createEquipmentReimbursement } from "./preJobEquipment";

export async function requestEquipmentReimbursement(input: {
  jobId?: string;
  description: string;
  amount: number;
  receiptUrl?: string;
}) {
  // A reimbursement must hang off a job now — that is what makes it reviewable
  // and payable, and what the approval gate is checked against.
  if (!input?.jobId) {
    return { success: false, error: "Pick the job this purchase was for" };
  }

  return createEquipmentReimbursement({
    jobId: input.jobId,
    item: input.description,
    amount: input.amount,
    receiptUrl: input.receiptUrl,
  });
}
