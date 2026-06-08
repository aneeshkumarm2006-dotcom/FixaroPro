import { NextRequest } from "next/server";
import { db } from "@/db";

// 1×1 transparent GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/** Open-tracking pixel for the recurring save-offer email. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await db.recurringCancellation
    .updateMany({
      // Only advance the funnel forward — don't clobber clicked/replied/etc.
      where: { id, openedAt: null },
      data: { openedAt: new Date(), offerStatus: "OPENED" },
    })
    .catch(() => {});

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Content-Length": String(PIXEL.length),
    },
  });
}
