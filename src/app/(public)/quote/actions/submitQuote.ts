"use server";

import { db } from "@/db";
import { sendCustomerQuoteReceived, sendAdminQuoteRequest } from "@/lib/email";
import { isTrustedIntakePhotoUrl } from "@/lib/cloudinary-url";

export interface QuoteSubmissionInput {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  serviceType?: string;
  preferredDate?: string;
  message?: string;
  // Service-specific intake (SOP v4.2 §4).
  paintRepairArea?: string;
  paintRepairSurface?: string;
  acType?: string;
  acLocation?: string;
  acMountType?: string;
  clientHasAcUnit?: boolean;
  photoUrls?: string[];
}

export async function submitQuote(input: QuoteSubmissionInput) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name) return { success: false, error: "Name is required" };
  if (!email || !email.includes("@")) {
    return { success: false, error: "Valid email is required" };
  }

  const photoUrls = (input.photoUrls ?? [])
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter((u) => isTrustedIntakePhotoUrl(u))
    .slice(0, 20);

  const quote = await db.quoteRequest.create({
    data: {
      name,
      email,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      serviceType: input.serviceType?.trim() || null,
      preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
      message: input.message?.trim() || null,
      paintRepairArea: input.paintRepairArea?.trim() || null,
      paintRepairSurface: input.paintRepairSurface?.trim() || null,
      acType: input.acType?.trim() || null,
      acLocation: input.acLocation?.trim() || null,
      acMountType: input.acMountType?.trim() || null,
      clientHasAcUnit: input.clientHasAcUnit ?? null,
      photoUrls,
      source: "landing_page",
    },
  });

  sendCustomerQuoteReceived({
    to: email,
    clientName: name,
    quoteId: quote.id,
  }).catch((e) => console.error("customer quote receipt email", e));

  sendAdminQuoteRequest({
    quoteId: quote.id,
    name,
    email,
    phone: input.phone?.trim() ?? null,
    serviceType: input.serviceType?.trim() ?? null,
    message: input.message?.trim() ?? null,
  }).catch((e) => console.error("admin quote alert email", e));

  return { success: true, quoteId: quote.id };
}
