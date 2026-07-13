"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { cloudinary } from "@/lib/cloudinary";
import { logAudit } from "@/lib/audit";
import type { UploadApiResponse } from "cloudinary";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PHOTOS_PER_JOB = 20;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

function streamUpload(
  buffer: Buffer,
  folder: string,
  publicId: string
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Upload failed"));
        } else {
          resolve(result);
        }
      }
    );
    stream.end(buffer);
  });
}

export async function uploadJobPhoto(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const jobId = formData.get("jobId") as string | null;
  const file = formData.get("file") as File | null;
  const captionRaw = formData.get("caption");
  const caption =
    typeof captionRaw === "string" && captionRaw.trim().length > 0
      ? captionRaw.trim()
      : null;

  if (!jobId) {
    return { success: false, error: "Missing job ID" };
  }

  if (!file || typeof file === "string") {
    return { success: false, error: "No file provided" };
  }

  if (file.size === 0) {
    return { success: false, error: "Empty file" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File exceeds 10MB limit" };
  }

  if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
    return {
      success: false,
      error: "Unsupported file type. Use JPG, PNG, HEIC, or WebP.",
    };
  }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return {
      success: false,
      error: "Cloudinary is not configured on the server",
    };
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

    // After-photo consent gate. Admins are the override authority and bypass
    // it; cleaners may only upload when the customer consented OR an admin set
    // an override on this job. Enforced here on the server, not just by hiding
    // the uploader in the UI.
    const consentOk = job.afterPhotoConsent || job.afterPhotoOverrideAt != null;
    if (!isAdmin && !consentOk) {
      return {
        success: false,
        error:
          "The customer didn't consent to after-photos for this job. Ask an admin to override if photos are required.",
      };
    }

    // Count AFTER photos only — customer INTAKE photos live in the same table
    // but must not consume the crew's after-photo budget (getJobPhotos + the
    // uploader UI also count AFTER only).
    const existingCount = await db.jobPhoto.count({
      where: { jobId, kind: "AFTER" },
    });
    if (existingCount >= MAX_PHOTOS_PER_JOB) {
      return {
        success: false,
        error: `Maximum of ${MAX_PHOTOS_PER_JOB} photos per job reached`,
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const folder = `fixaro/jobs/${jobId}`;
    const publicId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await streamUpload(buffer, folder, publicId);

    const photo = await db.jobPhoto.create({
      data: {
        jobId,
        employeeId: session.user.id,
        url: result.secure_url,
        caption,
      },
    });

    // SOP §8: "Audit job status changes and media uploads." After-photos are
    // evidence in a billing dispute, so who added one and when has to be
    // reconstructable — the JobPhoto row alone is deletable (deleteJobPhoto).
    logAudit({
      entityType: "Job",
      entityId: jobId,
      action: "JOB_PHOTO_UPLOADED",
      field: "photos",
      newValue: result.secure_url,
      reason: caption,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      description: `${session.user.name ?? "User"} uploaded an after-photo to job #${job.jobNumber}.`,
    }).catch((e) => console.error("audit (uploadJobPhoto)", e));

    revalidatePath(`/my-jobs/${jobId}`);

    return { success: true, photo };
  } catch (error) {
    console.error("Error uploading job photo:", error);
    return { success: false, error: "Failed to upload photo" };
  }
}
