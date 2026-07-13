"use server";

// Public intake-photo upload (SOP v4.2 §4). Used by the Book Now flow and the
// Get-a-Quote form so customers can attach photos of the work (paint-repair
// area, AC location, etc.) before any job exists. Unauthenticated by design —
// this is a pre-booking/pre-lead touchpoint. Mirrors uploadResume.ts, but for
// images. The caller holds the returned secure URLs and persists them (JobPhoto
// rows on submit, or QuoteRequest.photoUrls) — and those persist paths only
// trust our own uploads (see isTrustedIntakePhotoUrl).
//
// NOTE (deferred to the §12 security pass): like uploadResume, this endpoint has
// no per-IP/session rate limit. Abuse (denial-of-wallet against Cloudinary) is
// best mitigated at the edge (WAF / edge rate limiting) or with a shared
// token-bucket store; both are cross-cutting and out of scope for this change.
// The Next.js default server-action body limit (~1MB) and the raster-only
// `allowed_formats` gate below bound the per-request blast radius in the interim.

import { cloudinary } from "@/lib/cloudinary";
import type { UploadApiResponse } from "cloudinary";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
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
        // Server-authoritative format gate — the client-supplied MIME (file.type)
        // is spoofable, so restrict to raster formats here. Notably excludes SVG,
        // which Cloudinary would otherwise accept and could carry inline script.
        allowed_formats: ["jpg", "jpeg", "png", "heic", "heif", "webp"],
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) reject(error || new Error("Upload failed"));
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export async function uploadIntakePhoto(
  formData: FormData
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const file = formData.get("file") as File | null;
  if (!file || typeof file === "string") {
    return { success: false, error: "No file provided" };
  }
  if (file.size === 0) return { success: false, error: "Empty file" };
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
    return { success: false, error: "Uploads are not configured on the server" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await streamUpload(buffer, "fixaro/intake", publicId);
    return { success: true, url: result.secure_url };
  } catch (error) {
    console.error("Error uploading intake photo:", error);
    return { success: false, error: "Failed to upload photo" };
  }
}
