"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { setSaveOfferConfig } from "@/lib/retention";
import type { SaveOfferConfig } from "@/lib/retention-constants";

export async function saveRetentionConfig(config: SaveOfferConfig) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };
  const role = (session.user as { role?: string }).role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { success: false, error: "Not authorized" };
  }

  if (config.offerType !== "FIXED" && config.offerType !== "PERCENT") {
    return { success: false, error: "Invalid offer type" };
  }
  if (!Number.isFinite(config.offerValue) || config.offerValue <= 0) {
    return { success: false, error: "Offer value must be positive" };
  }

  await setSaveOfferConfig({
    enabled: !!config.enabled,
    offerType: config.offerType,
    offerValue: config.offerValue,
    expiresInDays:
      Number.isFinite(config.expiresInDays) && config.expiresInDays > 0
        ? Math.round(config.expiresInDays)
        : 30,
    headline: config.headline?.trim() || "",
    body: config.body?.trim() || "",
    buttonLabel: config.buttonLabel?.trim() || "Claim your offer",
  });

  revalidatePath("/settings");
  return { success: true };
}
