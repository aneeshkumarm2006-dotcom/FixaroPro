"use server";

import { db } from "@/db";
import { checkServiceAreaInternal } from "@/lib/service-area";
import { getBlockedDates, getBlockedSlots } from "@/lib/blocked-dates";
import {
  computeBookingPrice,
  nextOccurrence,
  recurrenceCount,
  recurringDiscountPercent,
} from "@/lib/booking-pricing";
import {
  ensureClientReferralCode,
  generateUniqueReferralCode,
  NEW_CLIENT_DISCOUNT,
  REFERRER_CREDIT,
} from "@/lib/referral";
import {
  sendBookingConfirmation,
  sendAdminNewBookingNotification,
  sendCustomerBookingsPrepaid,
} from "@/lib/email";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import { AFTER_PHOTO_CONSENT_VERSION } from "@/lib/policy";
import { paintingQuoteRange } from "@/lib/painting";
import { notifyPaintingProviders } from "@/lib/painting-workflow";

type Frequency =
  | "ONE_TIME"
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "QUARTERLY";

interface SubmitBookingInput {
  // Step 1
  postalCode: string;
  // Step 2
  address: string;
  hours: number;
  serviceType: string;
  frequency: Frequency;
  addOns: { name: string; price: number }[];
  // SOP §4/§5 — all-or-nothing materials/equipment decision.
  customerRequestsMaterials?: boolean;
  // SOP §7 — painting scope drives the immediate quote range.
  paintingScope?: string;
  // Step 3
  date: string; // YYYY-MM-DD
  isFlexible: boolean;
  timeSlot: string; // "HH:mm" or "" if flexible
  // Step 4
  name: string;
  phone: string;
  email: string;
  notes: string;
  referralCode: string;
  // After-photo consent (checkbox at booking, unchecked by default).
  afterPhotoConsent?: boolean;
  promoCode?: string;
  promoDiscount?: number;
  // Optional
  leadId?: string;
  depositPaymentIntentId?: string;
  stripeCustomerId?: string;
  stripePaymentMethodId?: string;
}

function parseStartTime(date: string, timeSlot: string, isFlexible: boolean): Date {
  // Defaults to 9am for flexible bookings — admin sets the real time later.
  const slot = isFlexible || !timeSlot ? "09:00" : timeSlot;
  return new Date(`${date}T${slot}:00`);
}

export async function submitBooking(input: SubmitBookingInput) {
  try {
    // 1. Validate basics
    const email = input.email?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return { success: false, error: "Valid email is required" };
    }
    if (!input.name?.trim()) {
      return { success: false, error: "Name is required" };
    }
    if (!input.phone?.trim() || !isValidPhone(input.phone)) {
      return { success: false, error: "Valid phone number is required" };
    }
    if (!input.address?.trim()) {
      return { success: false, error: "Address is required" };
    }
    if (!input.date) {
      return { success: false, error: "Date is required" };
    }

    // Reject fully-closed days (admin-configured). Server-authoritative — the
    // date picker greys these out but a crafted request could bypass it.
    const blockedDates = await getBlockedDates();
    if (blockedDates.includes(input.date)) {
      return {
        success: false,
        error: "Sorry, we're closed on that date. Please choose another day.",
      };
    }
    // Reject a specific time slot the admin has closed (skipped for flexible
    // bookings, which don't pin a slot).
    if (!input.isFlexible && input.timeSlot) {
      const blockedSlots = await getBlockedSlots(input.date);
      if (blockedSlots.includes(input.timeSlot)) {
        return {
          success: false,
          error:
            "Sorry, that time is no longer available. Please choose another slot.",
        };
      }
    }

    // 2. Re-check service area (server-authoritative — client can be tampered)
    const areaCheck = await checkServiceAreaInternal(input.postalCode);
    if (!areaCheck.covered) {
      return {
        success: false,
        error: "Sorry, we don't service that postal code yet",
      };
    }

    // 3. Resolve referral code → referring client
    let referredByClientId: string | null = null;
    let referrerEligibleForCredit = false;
    if (input.referralCode?.trim()) {
      const referrer = await db.client.findUnique({
        where: { referralCode: input.referralCode.trim().toUpperCase() },
      });
      if (referrer) {
        referredByClientId = referrer.id;
        referrerEligibleForCredit = true;
      }
    }

    // 4. Upsert Client by email — auto-mint a referral code for new clients
    const existingClient = await db.client.findFirst({
      where: { email },
    });

    const isNewClient = !existingClient;
    const newReferralCode = isNewClient ? await generateUniqueReferralCode() : null;

    const client = existingClient
      ? await db.client.update({
          where: { id: existingClient.id },
          data: {
            name: input.name.trim(),
            phone: input.phone.trim(),
            address: input.address.trim(),
            serviceFrequency: input.frequency,
            ...(input.stripeCustomerId && { stripeCustomerId: input.stripeCustomerId }),
            ...(input.stripePaymentMethodId && { defaultPaymentMethodId: input.stripePaymentMethodId }),
          },
        })
      : await db.client.create({
          data: {
            name: input.name.trim(),
            email,
            phone: input.phone.trim(),
            address: input.address.trim(),
            serviceFrequency: input.frequency,
            referredByClientId,
            referralCode: newReferralCode,
            ...(input.stripeCustomerId && { stripeCustomerId: input.stripeCustomerId }),
            ...(input.stripePaymentMethodId && { defaultPaymentMethodId: input.stripePaymentMethodId }),
          },
        });

    // Backstop: make sure existing clients also have a code (for future shares).
    if (existingClient && !existingClient.referralCode) {
      await ensureClientReferralCode(client.id);
    }

    // Referral credit gating: only credit the referrer when a NEW client
    // makes their first booking, and there's no self-referral.
    if (
      !isNewClient ||
      !referrerEligibleForCredit ||
      referredByClientId === client.id
    ) {
      referrerEligibleForCredit = false;
    }

    // 5. Compute discount eligibility:
    //   - new client + valid referral code → first-booking discount
    //   - existing client + available credit → spend their balance (capped)
    let discountAmount = 0;
    let creditSpent = 0;

    if (isNewClient && referrerEligibleForCredit) {
      discountAmount = NEW_CLIENT_DISCOUNT;
    } else if (!isNewClient && client.referralCredit > 0) {
      // Spend up to 50% of subtotal in credit (sanity cap), to be tuned later.
      creditSpent = Math.min(client.referralCredit, 50);
      discountAmount = creditSpent;
    }

    // 5b. Server-authoritative pricing
    const pricing = await computeBookingPrice({
      hours: input.hours,
      serviceType: input.serviceType,
      addOns: input.addOns,
      travelFee: areaCheck.travelFee ?? 0,
      discountAmount,
      customerRequestsMaterials: input.customerRequestsMaterials === true,
    });

    // 5c. Idempotency guard — if the same client just created a job for the
    // same date + service within the last 60 seconds, treat this as a retry
    // and return that job instead of creating a duplicate.
    const startTime = parseStartTime(
      input.date,
      input.timeSlot,
      input.isFlexible
    );
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const recentDuplicate = await db.job.findFirst({
      where: {
        clientId: client.id,
        startTime,
        jobType: input.serviceType,
        createdAt: { gte: sixtySecondsAgo },
        parentJobId: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (recentDuplicate) {
      return {
        success: true,
        jobId: recentDuplicate.id,
        childJobIds: [],
        total: recentDuplicate.price ?? pricing.total,
        deduplicated: true as const,
      };
    }

    // 6. Create the primary Job

    // Painting jobs (SOP §6/§7): record the scope + immediate quote range and
    // open the bid workflow. Final price follows the bid + 35% surplus flow.
    const isPainting = input.serviceType === "PAINTING";
    const painting = isPainting ? paintingQuoteRange(input.paintingScope) : null;

    const primaryJob = await db.job.create({
      data: {
        clientName: client.name,
        client: { connect: { id: client.id } },
        location: input.address.trim(),
        description: `${input.serviceType} — ${input.hours}h`,
        jobType: input.serviceType,
        jobDate: startTime,
        startTime,
        status: input.isFlexible ? "CREATED" : "SCHEDULED",
        isFlexible: input.isFlexible,
        requiredCleaners: 1,
        price: pricing.total,
        subtotalAmount: pricing.subtotal,
        gstAmount: pricing.gstAmount,
        qstAmount: pricing.qstAmount,
        discountAmount: discountAmount > 0 ? discountAmount : null,
        appliedPromoCode: input.promoCode?.trim() || null,
        promoDiscountAmount: input.promoDiscount && input.promoDiscount > 0 ? input.promoDiscount : null,
        customerRequestsMaterials: input.customerRequestsMaterials === true,
        materialsAmount: pricing.materialsAmount > 0 ? pricing.materialsAmount : null,
        materialsType: pricing.materialsType,
        ...(isPainting && {
          paintingStatus: "BIDDING",
          paintingScope: input.paintingScope || null,
          quoteRangeMin: painting?.min ?? null,
          quoteRangeMax: painting?.max ?? null,
          paintingSurplusRate: 1.35,
        }),
        bookingSource: "web",
        notes: input.notes?.trim() || null,
        afterPhotoConsent: input.afterPhotoConsent === true,
        ...(input.afterPhotoConsent === true && {
          afterPhotoConsentAt: new Date(),
          afterPhotoConsentVersion: AFTER_PHOTO_CONSENT_VERSION,
        }),
        ...(input.depositPaymentIntentId && {
          depositPaymentIntentId: input.depositPaymentIntentId,
          depositPaid: true,
          depositPaidAt: new Date(),
        }),
        addOns: {
          create: input.addOns.map((a) => ({
            name: a.name,
            price: a.price,
          })),
        },
      },
    });

    // Spend the credit on this client (deduct from balance)
    if (creditSpent > 0) {
      await db.client.update({
        where: { id: client.id },
        data: {
          referralCredit: { decrement: creditSpent },
        },
      });
    }

    // Credit the referrer for sending a new paying client our way
    if (referrerEligibleForCredit && referredByClientId) {
      await db.client.update({
        where: { id: referredByClientId },
        data: {
          referralCredit: { increment: REFERRER_CREDIT },
        },
      });
    }

    // 6b. Increment promo code usage if applied
    if (input.promoCode?.trim() && input.promoDiscount && input.promoDiscount > 0) {
      await db.promoCode.updateMany({
        where: { code: input.promoCode.trim().toUpperCase(), isActive: true },
        data: { usesCount: { increment: 1 } },
      }).catch(() => {});
    }

    // 6c. Retention reactivation hook — if this client previously cancelled
    // their recurring service and there's an open save offer, mark it
    // reactivated. A booking that used the offer's own code is the strongest
    // signal, but any new booking counts as a win-back.
    {
      const openOffer = await db.recurringCancellation.findFirst({
        where: { clientId: client.id, reactivatedAt: null },
        orderBy: { cancelledAt: "desc" },
        select: { id: true },
      });
      if (openOffer) {
        await db.recurringCancellation
          .update({
            where: { id: openOffer.id },
            data: { reactivatedAt: new Date(), offerStatus: "REACTIVATED" },
          })
          .catch(() => {});
      }
    }

    // 7. Recurring jobs — copy the primary across future dates
    const recurrences = recurrenceCount(input.frequency);
    const childJobIds: string[] = [];
    if (recurrences > 0 && input.frequency !== "ONE_TIME") {
      // Compute discounted price for 2nd+ visits (first visit is full price)
      const discountPct = recurringDiscountPercent(input.frequency);
      const recurringDiscount = discountPct > 0
        ? Math.round((pricing.basePrice * discountPct / 100) * 100) / 100
        : 0;
      const childPricing = recurringDiscount > 0
        ? await computeBookingPrice({
            hours: input.hours,
            serviceType: input.serviceType,
            addOns: input.addOns,
            travelFee: pricing.travelFee,
            discountAmount: discountAmount + recurringDiscount,
            customerRequestsMaterials: input.customerRequestsMaterials === true,
          })
        : pricing;

      let cursor = startTime;
      for (let i = 0; i < recurrences; i++) {
        cursor = nextOccurrence(cursor, input.frequency);
        const child = await db.job.create({
          data: {
            clientName: client.name,
            client: { connect: { id: client.id } },
            location: input.address.trim(),
            description: `${input.serviceType} — ${input.hours}h`,
            jobType: input.serviceType,
            jobDate: cursor,
            startTime: cursor,
            status: input.isFlexible ? "CREATED" : "SCHEDULED",
            isFlexible: input.isFlexible,
            requiredCleaners: 1,
            price: childPricing.total,
            subtotalAmount: childPricing.subtotal,
            gstAmount: childPricing.gstAmount,
            qstAmount: childPricing.qstAmount,
            discountAmount: childPricing.discountAmount > 0 ? childPricing.discountAmount : null,
            customerRequestsMaterials: input.customerRequestsMaterials === true,
            materialsAmount: childPricing.materialsAmount > 0 ? childPricing.materialsAmount : null,
            materialsType: childPricing.materialsType,
            parentJob: { connect: { id: primaryJob.id } },
            bookingSource: "web",
            afterPhotoConsent: input.afterPhotoConsent === true,
            ...(input.afterPhotoConsent === true && {
              afterPhotoConsentAt: new Date(),
              afterPhotoConsentVersion: AFTER_PHOTO_CONSENT_VERSION,
            }),
            addOns: {
              create: input.addOns.map((a) => ({
                name: a.name,
                price: a.price,
              })),
            },
          },
        });
        childJobIds.push(child.id);
      }
    }

    // 8. Mark the lead as converted (if we tracked one)
    const lead = await db.lead.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });
    if (lead) {
      await db.lead.update({
        where: { id: lead.id },
        data: {
          status: "CONVERTED",
          convertedJobId: primaryJob.id,
          convertedAt: new Date(),
        },
      });
    }

    // 9. Send booking confirmation email
    const emailLog = await db.emailLog.create({
      data: {
        kind: "BOOKING_CONFIRMATION",
        recipient: email,
        subject: `Booking confirmed — ${input.date}`,
        status: "PENDING",
        jobId: primaryJob.id,
      },
    });
    await sendBookingConfirmation({
      to: email,
      clientName: client.name,
      jobId: primaryJob.id,
      jobNumber: primaryJob.jobNumber,
      startTime: startTime.toISOString(),
      isFlexible: input.isFlexible,
      address: input.address.trim(),
      serviceType: input.serviceType,
      subtotal: pricing.subtotal,
      gst: pricing.gstAmount,
      qst: pricing.qstAmount,
      total: pricing.total,
      depositPaid: !!input.depositPaymentIntentId,
      logId: emailLog.id,
      // ONE_TIME → cust.booking.receipt_ot; anything else (weekly/monthly/etc.)
      // → cust.booking.receipt_rec
      recurring: input.frequency !== "ONE_TIME",
    });

    // If a referral code was applied, fire the dedicated catalog row
    // `admin.booking.new_via_referral` in addition to the regular
    // `admin.booking.new`. The fire-and-forget notifier handles the gate.
    if (input.referralCode?.trim()) {
      sendAdminNewBookingNotification({
        jobId: primaryJob.id,
        jobNumber: primaryJob.jobNumber,
        clientName: client.name,
        clientEmail: email,
        clientPhone: input.phone ?? null,
        startTime: startTime.toISOString(),
        isFlexible: input.isFlexible,
        address: input.address.trim(),
        serviceType: input.serviceType,
        price: pricing.total,
        bookingSource: "web (referral)",
        viaReferral: true,
      }).catch((err) =>
        console.error("admin new-booking-via-referral notification failed", err)
      );
    }

    // Notify all admins of the new booking — gated by `admin.booking.new` EMAIL.
    sendAdminNewBookingNotification({
      jobId: primaryJob.id,
      jobNumber: primaryJob.jobNumber,
      clientName: client.name,
      clientEmail: email,
      clientPhone: input.phone ?? null,
      startTime: startTime.toISOString(),
      isFlexible: input.isFlexible,
      address: input.address.trim(),
      serviceType: input.serviceType,
      price: pricing.total,
      bookingSource: "web",
    }).catch((err) =>
      console.error("admin new-booking notification failed", err)
    );

    // Customer "Bookings pre-paid" email when a deposit was collected at
    // booking time — gated by `cust.fee.bookings_prepaid`.
    if (input.depositPaymentIntentId) {
      // Deposit collected upfront: a refundable materials deposit (e.g. painting
      // $799) when one applies, otherwise the $20 base booking deposit. Mirrors
      // the server-authoritative logic in /api/stripe/charge-deposit.
      const depositCollected =
        pricing.materialsType === "deposit" && pricing.materialsAmount > 0
          ? pricing.materialsAmount
          : 20;
      sendCustomerBookingsPrepaid({
        to: email,
        clientName: client.name,
        jobId: primaryJob.id,
        jobNumber: primaryJob.jobNumber,
        amount: depositCollected,
      }).catch((err) => console.error("customer prepaid email", err));
    }

    // 10. Log the booking activity on the primary job
    await db.jobLog.create({
      data: {
        jobId: primaryJob.id,
        action: "CREATED",
        description: `Booked via web by ${client.name}`,
      },
    });

    // 10b. Painting (SOP §6): notify all painting-eligible providers to bid.
    if (isPainting) {
      notifyPaintingProviders(primaryJob.id).catch((err) =>
        console.error("painting provider notification failed", err)
      );
    }

    return {
      success: true,
      jobId: primaryJob.id,
      childJobIds,
      total: pricing.total,
    };
  } catch (error) {
    console.error("Error submitting booking:", error);
    return { success: false, error: "Failed to submit booking. Please try again." };
  }
}
