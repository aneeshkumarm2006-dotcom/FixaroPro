import { db } from "@/db";

// Best-effort audit trail for stock movements.
//
// Every action that mutates a Product's warehouse stock or a Pro's kit
// quantity records one row here per movement, so the admin product page and a
// Pro's own history can show "prev → new" with who moved it and why.
//
// The write is deliberately DECOUPLED from the mutation it accompanies: callers
// invoke `recordInventoryChanges` AFTER their own mutation has already
// committed, and this function never throws. A failed audit write must never
// roll back or block a real stock change — the movement is the source of truth,
// the log is best-effort.

export interface InventoryChangeRow {
  productId: string;
  /** Set when the change is to a specific Pro's kit; null/undefined = warehouse. */
  employeeId?: string | null;
  employeeName?: string | null;
  /** Signed delta (prev → new). Positive = added, negative = removed. */
  quantityChange: number;
  /** The resulting on-hand count after this movement. */
  newQuantity: number;
  unit?: string | null;
  reason?: string | null;
  /** The authenticated actor who caused the change (from session, never client). */
  changedById?: string | null;
  changedByName?: string | null;
}

export async function recordInventoryChanges(
  rows: InventoryChangeRow[]
): Promise<void> {
  // Drop no-op movements (prev === new) and malformed rows at the boundary so
  // the trail never fills with zero-delta noise.
  const clean = rows.filter(
    (r) => r && typeof r.productId === "string" && r.productId && r.quantityChange !== 0
  );
  if (clean.length === 0) return;

  try {
    await db.inventoryChange.createMany({
      data: clean.map((r) => ({
        productId: r.productId,
        employeeId: r.employeeId ?? null,
        employeeName: r.employeeName ?? null,
        quantityChange: r.quantityChange,
        newQuantity: r.newQuantity,
        unit: r.unit ?? null,
        reason: r.reason ?? null,
        changedById: r.changedById ?? null,
        changedByName: r.changedByName ?? null,
      })),
    });
  } catch (e) {
    // Server log only — never surface to the client, never rethrow.
    console.error("[inventory-change] failed to record audit rows", e);
  }
}
