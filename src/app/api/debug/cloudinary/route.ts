import { NextResponse } from "next/server";

// TEMP debug route. Returns boolean presence of Cloudinary env vars (no values).
// Delete after diagnosing the prod upload issue.
export async function GET() {
  return NextResponse.json({
    CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_URL: !!process.env.CLOUDINARY_URL,
    deployedAt: new Date().toISOString(),
  });
}
