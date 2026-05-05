"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { ChecklistItemStatus } from "@prisma/client";

interface UpdateChecklistItemInput {
  itemId: string;
  status?: ChecklistItemStatus;
  notes?: string | null;
}

export async function updateChecklistItem(input: UpdateChecklistItemInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false as const, error: "Not authenticated" };
  }

  try {
    const item = await db.jobChecklistItem.findUnique({
      where: { id: input.itemId },
      include: {
        checklist: {
          include: {
            job: { include: { cleaners: { select: { id: true } } } },
          },
        },
      },
    });
    if (!item) return { success: false as const, error: "Item not found" };

    const role = (session.user as { role?: string }).role;
    const isAdmin = role === "OWNER" || role === "ADMIN";
    const isOwnChecklist = item.checklist.employeeId === session.user.id;
    const isJobLead = item.checklist.job.employeeId === session.user.id;
    const isCleaner = item.checklist.job.cleaners.some(
      (c) => c.id === session.user.id
    );

    if (!isAdmin && !isOwnChecklist && !isJobLead && !isCleaner) {
      return { success: false as const, error: "Not authorized" };
    }

    const data: {
      status?: ChecklistItemStatus;
      notes?: string | null;
      completedAt?: Date | null;
    } = {};
    if (input.status !== undefined) {
      data.status = input.status;
      data.completedAt = input.status === "COMPLETED" ? new Date() : null;
    }
    if (input.notes !== undefined) {
      data.notes = input.notes?.trim() ? input.notes.trim() : null;
    }

    await db.jobChecklistItem.update({
      where: { id: input.itemId },
      data,
    });

    revalidatePath(`/my-jobs/${item.checklist.jobId}`);
    return { success: true as const };
  } catch (error) {
    console.error("Error updating checklist item:", error);
    return { success: false as const, error: "Failed to update item" };
  }
}
