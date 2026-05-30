"use server";

import { db } from "@/db";
import { sendCustomerQuoteReceived, sendAdminQuoteRequest } from "@/lib/email";

export interface QuoteSubmissionInput {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  serviceType?: string;
  bedCount?: number;
  bathCount?: number;
  squareFootage?: number;
  preferredDate?: string;
  message?: string;
}

export async function submitQuote(input: QuoteSubmissionInput) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name) return { success: false, error: "Name is required" };
  if (!email || !email.includes("@")) {
    return { success: false, error: "Valid email is required" };
  }

  const quote = await db.quoteRequest.create({
    data: {
      name,
      email,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      serviceType: input.serviceType?.trim() || null,
      bedCount: input.bedCount ?? null,
      bathCount: input.bathCount ?? null,
      squareFootage: input.squareFootage ?? null,
      preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
      message: input.message?.trim() || null,
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
