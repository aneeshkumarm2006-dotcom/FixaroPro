"use server";

// Phase 2D — record the agreed price on a quote request BEFORE (or without)
// converting it, so ops can quote a customer, save the number, and convert days
// later without retyping it. convertQuote() writes the same field when it runs.

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "OPS_MANAGER"]);
const MAX_QUOTED_PRICE = 100_000;

export async function saveQuotedPrice(input: {
  quoteId: string;
  /** Pre-tax agreed price, or null to clear it. */
  quotedPrice: number | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.has(role)) {
      return { success: false, error: "Not authorized" };
    }

    if (
      typeof input?.quoteId !== "string" ||
      !/^[a-z0-9]{20,40}$/i.test(input.quoteId)
    ) {
      return { success: false, error: "Quote request not found" };
    }

    let value: number | null = null;
    if (input.quotedPrice !== null && input.quotedPrice !== undefined) {
      const n = Number(input.quotedPrice);
      if (!Number.isFinite(n) || n <= 0 || n > MAX_QUOTED_PRICE) {
        return { success: false, error: "Enter a valid quoted price." };
      }
      value = Math.round(n * 100) / 100;
    }

    const existing = await db.quoteRequest.findUnique({
      where: { id: input.quoteId },
      select: { id: true, quotedPrice: true, status: true, convertedJobId: true },
    });
    if (!existing) return { success: false, error: "Quote request not found" };

    // A converted quote's price is settled — the job carries it now, and editing
    // it here would silently disagree with what was invoiced.
    if (existing.convertedJobId || existing.status === "CONVERTED") {
      return {
        success: false,
        error: "This quote has already been converted — edit the job instead.",
      };
    }

    await db.quoteRequest.update({
      where: { id: input.quoteId },
      data: { quotedPrice: value },
    });

    await logAudit({
      entityType: "QuoteRequest",
      entityId: input.quoteId,
      action: "QUOTE_PRICED",
      field: "quotedPrice",
      oldValue: existing.quotedPrice != null ? String(existing.quotedPrice) : null,
      newValue: value != null ? String(value) : null,
      description:
        value != null
          ? `Quoted price set to $${value.toFixed(2)} + tax.`
          : "Quoted price cleared.",
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    revalidatePath("/quotes");
    return { success: true };
  } catch (error) {
    console.error("saveQuotedPrice failed", error);
    return { success: false, error: "Could not save the quoted price." };
  }
}
