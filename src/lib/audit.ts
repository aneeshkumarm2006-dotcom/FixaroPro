// Generic high-impact audit trail (SOP §9). Records who changed what, when, and
// why across entities (eligibility, deposits, refunds, overrides). Fire-and-
// forget friendly — never throws into the caller.

import { db } from "@/db";

export interface AuditEntry {
  entityType: string;
  entityId: string;
  action: string;
  description: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        description: entry.description,
        field: entry.field ?? null,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
        reason: entry.reason ?? null,
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
      },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
