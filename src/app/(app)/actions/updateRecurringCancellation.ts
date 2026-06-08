"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Admin actions on a recurring-cancellation save-offer row. Currently:
 *  - "replied" → the customer responded to outreach (stamps repliedAt).
 * Used from the retention KPI drill-down.
 */
export async function updateRecurringCancellation(input: {
  id: string;
  action: "replied";
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };

  const role = (session.user as { role?: string }).role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { success: false, error: "Not authorized" };
  }

  const row = await db.recurringCancellation.findUnique({
    where: { id: input.id },
    select: { id: true, reactivatedAt: true },
  });
  if (!row) return { success: false, error: "Not found" };

  if (input.action === "replied") {
    await db.recurringCancellation.update({
      where: { id: input.id },
      data: {
        repliedAt: new Date(),
        // Don't downgrade a reactivated row's status.
        ...(row.reactivatedAt ? {} : { offerStatus: "REPLIED" }),
      },
    });
  }

  revalidatePath("/kpi");
  return { success: true };
}
