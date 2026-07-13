"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { JobPhotoDTO } from "./getJobPhotos.types";

export async function getJobPhotos(
  jobId: string
): Promise<
  | { success: true; photos: JobPhotoDTO[] }
  | { success: false; error: string }
> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      include: {
        cleaners: { select: { id: true } },
      },
    });

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    const role = (session.user as { role?: string }).role;
    const isAdmin = role === "OWNER" || role === "ADMIN";
    const isEmployee = job.employeeId === session.user.id;
    const isCleaner = job.cleaners.some((c) => c.id === session.user.id);

    if (!isAdmin && !isEmployee && !isCleaner) {
      return { success: false, error: "Not authorized for this job" };
    }

    // AFTER photos only — this powers the completion-photo gallery + uploader.
    // Customer INTAKE photos are shown read-only in a dedicated section.
    const photos = await db.jobPhoto.findMany({
      where: { jobId, kind: "AFTER" },
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });

    const dto: JobPhotoDTO[] = photos.map((p) => ({
      id: p.id,
      jobId: p.jobId,
      employeeId: p.employeeId,
      employeeName: p.employee?.name ?? "Team",
      kind: p.kind,
      url: p.url,
      caption: p.caption,
      createdAt: p.createdAt,
      canDelete: isAdmin || (p.employeeId != null && p.employeeId === session.user.id),
    }));

    return { success: true, photos: dto };
  } catch (error) {
    console.error("Error fetching job photos:", error);
    return { success: false, error: "Failed to load photos" };
  }
}
