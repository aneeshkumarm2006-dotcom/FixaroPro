"use server";

// Phase 2D — one-click quote → job conversion.
//
// Replaces the old "Convert to job" button, which was a bare
// `router.push("/jobs/new")`: ops retyped the client, address, service, intake
// answers and photos into a blank form, and nothing linked the two records.
//
// The created Job is built the SAME way submitBooking.ts builds one:
//   • jobType stores the catalog SERVICE VALUE ("DRYWALL_REPAIR"), never a label
//   • jobDate  = businessDateOnly(dateKey)          — midnight UTC of the
//     business-timezone calendar date, so it never renders a day early
//   • startTime = parseBusinessDateTime(dateKey, slot) — the instant the admin
//     actually picked in the business timezone, NOT new Date(string), which
//     parses in the SERVER's timezone and lands hours off on a UTC host
//   • price is tax-inclusive; the agreed quote is the PRE-tax base.

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getRuntimeConfig } from "@/lib/config/service-config";
import { findService } from "@/lib/config/types";
import { businessDateOnly, parseBusinessDateTime, DATE_KEY_RE, TIME_KEY_RE } from "@/lib/timezone";
import { calculateTax } from "@/lib/tax";
import { ensureClientReferralCode, generateUniqueReferralCode } from "@/lib/referral";
import { isTrustedIntakePhotoUrl } from "@/lib/cloudinary-url";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { notifyEligibleProviders } from "@/lib/provider-notify";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "OPS_MANAGER"]);

/** Sanity ceiling — a fat-fingered extra zero shouldn't create a $500k job. */
const MAX_QUOTED_PRICE = 100_000;

export interface ConvertQuoteInput {
  quoteId: string;
  /** Agreed price, PRE-tax. GST/QST are added on top, as everywhere else. */
  quotedPrice: number;
  /** "YYYY-MM-DD" in the business timezone. */
  date: string;
  /** "HH:mm", 24-hour, business timezone. */
  timeSlot: string;
  /**
   * Catalog service VALUE. Required only when the quote's own serviceType is
   * missing or is a legacy free-text label that no longer resolves.
   */
  serviceType?: string;
  /** Estimated on-site hours, for the job description. */
  hours?: number;
}

export interface ConvertQuoteResult {
  success: boolean;
  jobId?: string;
  jobNumber?: number;
  /** True when the quote was already converted — the existing job is returned. */
  alreadyConverted?: boolean;
  error?: string;
}

export async function convertQuote(
  input: ConvertQuoteInput
): Promise<ConvertQuoteResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.has(role)) {
      return { success: false, error: "Not authorized" };
    }

    // Conversion creates a billable Job. Bound it per actor so a stuck client
    // retry loop can't mint jobs; the message leaks neither limit nor window.
    const limited = rateLimit(session.user.id, {
      name: "convert-quote",
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return {
        success: false,
        error: "Too many requests. Please wait a moment and try again.",
      };
    }

    // ── Validate every field at the boundary, allow-list shapes ──────────────
    if (typeof input?.quoteId !== "string" || !/^[a-z0-9]{20,40}$/i.test(input.quoteId)) {
      return { success: false, error: "Quote request not found" };
    }
    const price = Number(input.quotedPrice);
    if (!Number.isFinite(price) || price <= 0 || price > MAX_QUOTED_PRICE) {
      return { success: false, error: "Enter a valid quoted price." };
    }
    const quotedPrice = Math.round(price * 100) / 100;

    if (!DATE_KEY_RE.test(input.date ?? "")) {
      return { success: false, error: "Choose a valid date." };
    }
    if (!TIME_KEY_RE.test(input.timeSlot ?? "")) {
      return { success: false, error: "Choose a valid start time." };
    }
    // These reject impossible calendar dates (2026-02-31) rather than rolling
    // them over silently, so a bad date can never become a scheduled visit.
    const jobDate = businessDateOnly(input.date);
    const startTime = parseBusinessDateTime(input.date, input.timeSlot);
    if (!jobDate || !startTime) {
      return { success: false, error: "Choose a valid date and time." };
    }

    const hours =
      Number.isFinite(input.hours) && (input.hours as number) > 0
        ? Math.min(Math.round(input.hours as number), 24)
        : null;

    const quote = await db.quoteRequest.findUnique({
      where: { id: input.quoteId },
    });
    if (!quote) return { success: false, error: "Quote request not found" };

    // Idempotent read path — a second click reports the existing job instead of
    // creating a duplicate one. The authoritative guard is the conditional
    // claim inside the transaction below; this is the friendly version.
    if (quote.convertedJobId || quote.status === "CONVERTED") {
      return {
        success: true,
        alreadyConverted: true,
        jobId: quote.convertedJobId ?? undefined,
      };
    }

    // jobType must be the catalog VALUE, and the service must still be live —
    // same server-authoritative rule submitBooking applies to a web booking.
    const cfg = await getRuntimeConfig();
    const requested = (input.serviceType ?? quote.serviceType ?? "").trim();
    const service = findService(cfg, requested);
    if (!service || !service.active) {
      return {
        success: false,
        error:
          "Pick a current service for this job — the quote's service is missing or retired.",
      };
    }

    const email = quote.email?.trim().toLowerCase();
    if (!email) return { success: false, error: "This quote has no email address." };
    const address = quote.address?.trim() || "";
    if (!address) {
      return { success: false, error: "This quote has no address — add one before converting." };
    }

    // Tax treatment matches the booking wizard: the agreed number is the
    // pre-tax base, `price` is the tax-inclusive total.
    const tax = calculateTax(quotedPrice);

    // Only Cloudinary URLs our own upload action produced are copied onto the
    // job, so a tampered quote row can't inject an arbitrary remote image.
    const intakeUrls = (quote.photoUrls ?? [])
      .filter((u): u is string => typeof u === "string")
      .map((u) => u.trim())
      .filter((u) => isTrustedIntakePhotoUrl(u))
      .slice(0, 20);

    // Upsert the client from the quote's contact details (mirrors submitBooking).
    const existingClient = await db.client.findFirst({ where: { email } });
    const client = existingClient
      ? await db.client.update({
          where: { id: existingClient.id },
          data: {
            name: quote.name.trim(),
            ...(quote.phone?.trim() ? { phone: quote.phone.trim() } : {}),
            address,
          },
        })
      : await db.client.create({
          data: {
            name: quote.name.trim(),
            email,
            phone: quote.phone?.trim() || null,
            address,
            referralCode: await generateUniqueReferralCode(),
          },
        });
    if (existingClient && !existingClient.referralCode) {
      await ensureClientReferralCode(client.id);
    }

    const isSmallPaintRepair = service.value === "SMALL_PAINT_REPAIR";
    const isAcInstallation = service.value === "AC_INSTALLATION";

    const notes = [
      quote.message?.trim() ? `Customer's request: ${quote.message.trim()}` : null,
      quote.notes?.trim() ? `Quote notes: ${quote.notes.trim()}` : null,
      `Converted from quote request ${quote.id} at an agreed $${quotedPrice.toFixed(2)} + tax.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    // One interactive transaction so a failure anywhere cannot leave the quote
    // flagged CONVERTED with no job behind it, or a job with no link back.
    const created = await db.$transaction(async (tx) => {
      // Conditional claim — if a concurrent request converted this quote a
      // microsecond earlier, count is 0 and we abort rather than double-book.
      const claimed = await tx.quoteRequest.updateMany({
        where: { id: quote.id, convertedJobId: null, status: { not: "CONVERTED" } },
        data: { status: "CONVERTED", convertedAt: new Date(), quotedPrice },
      });
      if (claimed.count === 0) return null;

      const job = await tx.job.create({
        data: {
          clientName: client.name,
          client: { connect: { id: client.id } },
          location: address,
          description: hours
            ? `${service.value} — ${hours}h (quoted)`
            : `${service.value} — quoted`,
          // Catalog VALUE, never the label.
          jobType: service.value,
          jobDate,
          startTime,
          status: "SCHEDULED",
          isFlexible: false,
          requiredCleaners: 1,
          price: tax.total,
          subtotalAmount: tax.subtotal,
          gstAmount: tax.gstAmount,
          qstAmount: tax.qstAmount,
          // The agreed quote IS the labour baseline — there is no hourly
          // recompute to fall back on, so both booked figures come from it.
          basePriceAmount: quotedPrice,
          bookedSubtotalAmount: tax.subtotal,
          // Phase 2C is a separate axis: converting a quote never implies Fixaro
          // is supplying materials. Ops set that explicitly on the job if agreed.
          customerRequestsMaterials: false,
          ...(isSmallPaintRepair && {
            paintRepairArea: quote.paintRepairArea?.trim() || null,
            paintRepairSurface: quote.paintRepairSurface || null,
          }),
          ...(isAcInstallation && {
            acType: quote.acType || null,
            acLocation: quote.acLocation?.trim() || null,
            acMountType: quote.acMountType || null,
            clientHasAcUnit: quote.clientHasAcUnit ?? null,
          }),
          bookingSource: "quote",
          notes,
        },
      });

      if (intakeUrls.length > 0) {
        await tx.jobPhoto.createMany({
          data: intakeUrls.map((url) => ({
            jobId: job.id,
            kind: "INTAKE" as const,
            url,
          })),
        });
      }

      await tx.quoteRequest.update({
        where: { id: quote.id },
        data: { convertedJobId: job.id },
      });

      await tx.jobLog.create({
        data: {
          jobId: job.id,
          userId: session.user.id,
          action: "CREATED",
          description: `Created from quote request ${quote.id} at an agreed $${quotedPrice.toFixed(2)} + tax.`,
        },
      });

      return job;
    });

    if (!created) {
      const fresh = await db.quoteRequest.findUnique({
        where: { id: quote.id },
        select: { convertedJobId: true },
      });
      return {
        success: true,
        alreadyConverted: true,
        jobId: fresh?.convertedJobId ?? undefined,
      };
    }

    await logAudit({
      entityType: "QuoteRequest",
      entityId: quote.id,
      action: "QUOTE_CONVERTED",
      field: "status",
      oldValue: quote.status,
      newValue: "CONVERTED",
      description: `Quote converted to job #${created.jobNumber} (${service.value}) at $${quotedPrice.toFixed(2)} + tax.`,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
    });

    // Same post-create hook a web booking fires, so the job is claimable by the
    // Pros an admin has approved for this service.
    notifyEligibleProviders(created.id).catch((err) =>
      console.error("eligible provider notification failed", err)
    );

    revalidatePath("/quotes");
    revalidatePath("/jobs");

    return { success: true, jobId: created.id, jobNumber: created.jobNumber };
  } catch (error) {
    // Detail to the server log only; the client gets a generic message.
    console.error("convertQuote failed", error);
    return { success: false, error: "Could not convert this quote." };
  }
}
