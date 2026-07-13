// Service-specific intake fields (SOP v4.2 §4) rendered as label/value rows.
// Shared by the admin job detail, the handyman job card, and the Get-a-Quote
// review drawer so the structured answers a customer gave for Small paint
// repair / AC installation surface identically everywhere. Pure — no I/O.

export interface IntakeSource {
  paintRepairArea?: string | null;
  paintRepairSurface?: string | null;
  acType?: string | null;
  acLocation?: string | null;
  acMountType?: string | null;
  clientHasAcUnit?: boolean | null;
}

export interface IntakeRow {
  label: string;
  value: string;
}

/**
 * Build the display rows for whichever service-specific intake fields are set.
 * Returns [] when the job/quote carries no structured intake (i.e. not one of
 * the two new services, or the customer left the fields blank).
 */
export function buildIntakeRows(src: IntakeSource): IntakeRow[] {
  const rows: IntakeRow[] = [];

  // Small paint repair
  if (src.paintRepairArea?.trim()) {
    rows.push({ label: "Repair area", value: src.paintRepairArea.trim() });
  }
  if (src.paintRepairSurface?.trim()) {
    rows.push({ label: "Surface type", value: src.paintRepairSurface.trim() });
  }

  // AC installation
  if (src.acType?.trim()) {
    rows.push({ label: "AC type", value: src.acType.trim() });
  }
  if (src.acLocation?.trim()) {
    rows.push({ label: "Install location", value: src.acLocation.trim() });
  }
  if (src.acMountType?.trim()) {
    rows.push({ label: "Mounting / window", value: src.acMountType.trim() });
  }
  if (src.clientHasAcUnit != null) {
    rows.push({
      label: "Has the AC unit & accessories",
      value: src.clientHasAcUnit ? "Yes" : "No, not yet",
    });
  }

  return rows;
}
