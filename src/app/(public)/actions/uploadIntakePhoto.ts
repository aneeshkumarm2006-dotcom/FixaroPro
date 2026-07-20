"use server";

// Public intake-photo upload (SOP v4.2 §4). Used by the Book Now flow and the
// Get-a-Quote form so customers can attach photos of the work (paint-repair
// area, AC location, etc.) before any job exists. Unauthenticated by design —
// this is a pre-booking/pre-lead touchpoint. Mirrors uploadResume.ts, but for
// images. The caller holds the returned secure URLs and persists them (JobPhoto
// rows on submit, or QuoteRequest.photoUrls) — and those persist paths only
// trust our own uploads (see isTrustedIntakePhotoUrl).
//
// RATE LIMITING (was deferred to the §12 security pass, now partially closed):
// this endpoint now applies a per-IP in-process budget to blunt denial-of-wallet
// abuse against Cloudinary. That limiter is per-instance memory only, so it does
// NOT survive across serverless instances — edge rate limiting (WAF/CDN) or a
// shared token-bucket store remains the real fix. The Next.js default server-
// action body limit (~1MB) and the raster-only `allowed_formats` gate below
// still bound the per-request blast radius.

import { headers } from "next/headers";
import { cloudinary } from "@/lib/cloudinary";
import type { UploadApiResponse } from "cloudinary";
import {
  rateLimit,
  clientIpFromHeaders,
  RATE_LIMITS,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit";

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

  // Per-IP budget, consumed only once the request would actually reach
  // Cloudinary — so a customer whose file failed the size/type gate doesn't burn
  // budget they'd need for the corrected re-upload. Server action → IP comes
  // from `headers()`. NOTE: in-process only, see @/lib/rate-limit.
  const limited = rateLimit(`ip:${clientIpFromHeaders(await headers())}`, {
    name: "intake-photo-upload",
    ...RATE_LIMITS.upload,
  });
  if (!limited.ok) {
    return { success: false, error: RATE_LIMIT_MESSAGE };
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
