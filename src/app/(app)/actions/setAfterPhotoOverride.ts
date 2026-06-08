"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Admin override for the after-photo consent gate. When the customer didn't
 * consent at booking but photos are needed (e.g. to document damage), an
 * admin can authorize uploads for a specific job. Toggling off clears the
 * override. Every change is recorded on the JobLog.
 */
export async function setAfterPhotoOverride(jobId: string, enabled: boolean) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };

  const role = (session.user as { role?: string }).role;
  const isAdmin = role === "OWNER" || role === "ADMIN";
  if (!isAdmin) return { success: false, error: "Not authorized" };

  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { id: true, afterPhotoOverrideAt: true },
  });
  if (!job) return { success: false, error: "Job not found" };

  await db.job.update({
    where: { id: jobId },
    data: enabled
      ? { afterPhotoOverrideAt: new Date(), afterPhotoOverrideBy: session.user.id }
      : { afterPhotoOverrideAt: null, afterPhotoOverrideBy: null },
  });

  await db.jobLog
    .create({
      data: {
        jobId,
        userId: session.user.id,
        action: "UPDATED",
        field: "afterPhotoOverride",
        description: enabled
          ? `${session.user.name} authorized after-photos despite no customer consent`
          : `${session.user.name} removed the after-photo override`,
      },
    })
    .catch((e) => console.error("after-photo override log", e));

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/my-jobs/${jobId}`);
  return { success: true, enabled };
}
