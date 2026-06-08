import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";

/**
 * Click-tracking redirect for the recurring save-offer CTA. Stamps the click
 * (advancing the funnel) then forwards the customer to the booking page with
 * the promo code pre-filled.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const row = await db.recurringCancellation
    .findUnique({
      where: { id },
      select: { offerCode: true, clickedAt: true, openedAt: true },
    })
    .catch(() => null);

  if (row && !row.clickedAt) {
    const now = new Date();
    await db.recurringCancellation
      .update({
        where: { id },
        data: {
          clickedAt: now,
          // A click implies an open even if the pixel was blocked.
          ...(row.openedAt ? {} : { openedAt: now }),
          offerStatus: "CLICKED",
        },
      })
      .catch(() => {});
  }

  const dest = row?.offerCode
    ? `${appUrl}/book?promo=${encodeURIComponent(row.offerCode)}`
    : `${appUrl}/book`;
  return NextResponse.redirect(dest);
}
