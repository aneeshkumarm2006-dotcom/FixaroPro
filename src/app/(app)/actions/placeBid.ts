"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPaintingEligibleProviderIds } from "@/lib/painting-workflow";

interface PlaceBidInput {
  jobId: string;
  amount: number;
  note?: string;
}

// A provider submits (or updates) their bid on a painting job (SOP §6). One
// active bid per provider per job; the lowest valid bid is auto-accepted by the
// software when bidding closes.
export async function placeBid(input: PlaceBidInput) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (role === "CLIENT") return { success: false, error: "Not authorized" };

    if (!input.jobId) return { success: false, error: "Missing jobId" };
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { success: false, error: "Bid amount must be positive" };
    }

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: { id: true, jobType: true, paintingStatus: true },
    });
    if (!job || job.jobType !== "PAINTING") {
      return { success: false, error: "Not a painting job" };
    }
    if (job.paintingStatus !== "BIDDING") {
      return { success: false, error: "Bidding is closed for this job" };
    }

    // Provider must be eligible to bid (admin-controlled; Slice 3 will enforce
    // the per-provider PAINTING eligibility — for now all field providers).
    const eligible = await getPaintingEligibleProviderIds();
    if (!eligible.includes(session.user.id)) {
      return { success: false, error: "You are not eligible to bid on painting jobs" };
    }

    await db.paintingBid.upsert({
      where: { jobId_bidderId: { jobId: input.jobId, bidderId: session.user.id } },
      create: {
        jobId: input.jobId,
        bidderId: session.user.id,
        amount: input.amount,
        note: input.note?.trim() || null,
      },
      update: {
        amount: input.amount,
        note: input.note?.trim() || null,
        isValid: true,
      },
    });

    await db.jobLog.create({
      data: {
        jobId: input.jobId,
        userId: session.user.id,
        action: "UPDATED",
        field: "paintingBid",
        newValue: String(input.amount),
        description: `Provider bid $${input.amount.toFixed(2)} on painting job.`,
      },
    });

    revalidatePath("/available-jobs");
    revalidatePath(`/jobs/${input.jobId}`);
    return { success: true };
  } catch (error) {
    console.error("Error placing bid:", error);
    return { success: false, error: "Failed to place bid" };
  }
}
