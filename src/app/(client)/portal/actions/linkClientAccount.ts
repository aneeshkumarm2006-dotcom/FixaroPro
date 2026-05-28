"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { sendAccountEmail } from "@/lib/email";

// Called right after a Better Auth sign-up for a client. Promotes the user's
// role to CLIENT and links the matching Client record by email.
export async function linkClientAccount() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };

    const userId = session.user.id;
    const email = session.user.email?.toLowerCase();
    if (!email) return { success: false, error: "Session has no email" };

    // Set role to CLIENT (most accounts default to EMPLOYEE).
    await db.user.update({
      where: { id: userId },
      data: { role: "CLIENT" },
    });

    // Find the Client record by email and link userId.
    const client = await db.client.findFirst({
      where: { email },
    });

    if (client) {
      // If already linked to a different user, leave it alone.
      if (client.userId && client.userId !== userId) {
        return { success: true, alreadyLinked: true };
      }
      await db.client.update({
        where: { id: client.id },
        data: { userId },
      });
    }

    // Welcome the customer — gated by `cust.account.new` + `cust.account.activated`.
    sendAccountEmail({
      to: email,
      name: session.user.name ?? email,
      role: "CUSTOMER",
      event: "new_account",
    }).catch((e) => console.error("customer new-account email", e));
    sendAccountEmail({
      to: email,
      name: session.user.name ?? email,
      role: "CUSTOMER",
      event: "activated",
    }).catch((e) => console.error("customer activated email", e));

    return { success: true };
  } catch (error) {
    console.error("Error linking client account:", error);
    return { success: false, error: "Failed to link account" };
  }
}
