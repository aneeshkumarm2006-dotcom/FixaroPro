"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

type StrikeAction = "add" | "remove" | "excuse" | "reactivate";

interface ManageStrikesInput {
  action: StrikeAction;
  cleanerId?: string; // required for "add"
  strikeId?: string; // required for remove / excuse / reactivate
  note: string; // required for every action (audit trail)
}

/**
 * Admin management of cleaner strikes:
 *  - add        → issue a MANUAL strike against a cleaner
 *  - remove     → mark a strike REMOVED (no longer counts)
 *  - excuse     → mark a strike EXCUSED (no longer counts)
 *  - reactivate → set a removed/excused strike back to ACTIVE
 * A note is required on every action.
 */
export async function manageStrikes(input: ManageStrikesInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };

  const role = (session.user as { role?: string }).role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { success: false, error: "Not authorized" };
  }

  const note = input.note?.trim();
  if (!note) return { success: false, error: "A note is required" };

  if (input.action === "add") {
    if (!input.cleanerId) return { success: false, error: "Missing cleaner" };
    const cleaner = await db.user.findUnique({
      where: { id: input.cleanerId },
      select: { id: true },
    });
    if (!cleaner) return { success: false, error: "Pro not found" };

    await db.cleanerStrike.create({
      data: {
        cleanerId: input.cleanerId,
        reason: "MANUAL",
        status: "ACTIVE",
        note,
        actionBy: session.user.id,
      },
    });
    revalidatePath(`/employees/${input.cleanerId}`);
    return { success: true };
  }

  if (!input.strikeId) return { success: false, error: "Missing strike" };
  const strike = await db.cleanerStrike.findUnique({
    where: { id: input.strikeId },
    select: { id: true, cleanerId: true, note: true },
  });
  if (!strike) return { success: false, error: "Strike not found" };

  const status =
    input.action === "remove"
      ? "REMOVED"
      : input.action === "excuse"
      ? "EXCUSED"
      : "ACTIVE";

  await db.cleanerStrike.update({
    where: { id: input.strikeId },
    data: {
      status,
      // Append the admin note to the audit trail.
      note: [strike.note, `[${input.action}] ${note}`].filter(Boolean).join("\n"),
      actionBy: session.user.id,
    },
  });

  revalidatePath(`/employees/${strike.cleanerId}`);
  return { success: true };
}
