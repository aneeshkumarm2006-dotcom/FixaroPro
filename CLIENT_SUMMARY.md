# Cleano: Work Summary for Client Review

This document summarises the work completed for **Notifications**, **Rag Wash credits**, and **Inventory rules**, along with items that still need your confirmation before we can finish them.

---

## 0. Fixaro v4.2 — Quality, security & testing pass (14 Jul 2026)

This is the final stage of the Fixaro Handyman build. We put the whole system through the quality-
assurance checklist in your requirements document (Section 12) and added automated tests so the money
calculations stay correct as the software changes.

**What we did**

- **Added automated tests for the money math.** The pricing, hourly-billing, deposit and painting
  calculations now have 91 automated checks that run in seconds. This locks in the correct numbers
  (labour at $79/hour, the 3-hour package, the 2-hour minimum, the $119 painting charge, the 35%
  painting surplus, the $25 cancellation fee) so a future change can't quietly break them.
- **Reviewed every part of the system against the QA checklist** — security, permissions, customer
  booking, the painting workflow, the handyman portal, the admin dashboard, payments, audit logs, and
  the two new services (Small paint repair and AC installation). Most areas passed as built.
- **Fixed the important issues we found.** The most significant: an internal screen for editing a
  booking wasn't restricted to administrators, which in theory could have let a non-admin change pay or
  payment figures — this is now locked to admins only. We also fixed a deposit-refund limit that was
  frozen at $20 (so refunds now follow whatever deposit amount you've set), a customer statement that
  subtracted a discount twice, and we made sure every high-impact change (payouts, refunds, charges,
  role changes) is recorded in the audit log with who did it and what changed.
- **Confirmed no passwords, card numbers, or secret keys** are exposed anywhere in the app, its
  responses, its logs, or its exports.

**What still needs a live environment (not something we can do from the code alone)**

- A **test run of real card payments** in Stripe's sandbox, following the step-by-step script we
  prepared, to confirm each charge and refund amount on screen.
- A short list of **improvements we've documented for a follow-up** — the most important is a
  refinement to how a *partially used* materials deposit is refunded, so the customer is billed only
  for the materials actually used. Details are in the technical QA report.

---

## 1. Notifications

### What is done

We built a central **Notification Catalog** so every email, app push, or SMS in the system is governed by a single switch you can toggle from the admin panel. Around **75 of the 120 catalog entries** are now wired end to end. The categories below are live in production code.

**Booking lifecycle**
- New booking confirmation (customer)
- New booking alert (admin), with a flag for referral bookings
- Booking modified (admin and customer)
- Booking canceled (admin, customer, and assigned cleaners)
- Cancellation request raised (admin)
- Reschedule request raised (admin)
- Customer "request resolved" email when admin approves or denies a cancel or reschedule request, with the admin note included
- After 5pm same day rules wired for the late cancellation variants

**Payments**
- Booking charged (customer)
- Card declined (customer and admin)
- New card added (admin)
- Fees charged (customer)
- Prepaid bookings confirmation (customer)
- Tip received (admin, customer thank you, provider)
- Refund issued (customer)

**Account lifecycle**
- Password reset email (both customer and provider variants)
- Password changed confirmation
- Email verification
- Signup welcome (customer and provider variants)
- Admin signup review when a new provider applies

**Invoices**
- Invoice sent
- Invoice paid
- Invoice overdue
- Invoice voided

**Documents and compliance**
- Provider document uploaded
- Admin signature request
- Document signed confirmation

**Unassigned bookings folder**
- New unassigned booking (admin)
- Booking moved to unassigned (admin)
- Cleaner grabbed an unassigned booking (admin)
- Unassigned booking modified (admin)

**Recurring bookings**
- Recurring booking confirmation (customer), reusing the booking confirmation template with a recurring flag

**Ratings, clock in/out, checklist**
- Rate us email (customer)
- New review notification (admin)
- New review for provider
- Clocked in (admin)
- Clocked out (admin)
- Checklist completed (admin)

**Cron driven reminders** (run automatically every 5 minutes, plus a 9am daily job)
- Unassigned booking deadline approaching (admin)
- Cleaner not clocked in (admin)
- Cash or cheque collection reminder (admin)
- Poor rating twice a week (admin)
- 48 hour customer reminder
- Customer never found provider (admin)
- "Leave a tip" prompt (customer)
- Provider job reminder

**Reliability features added under the hood**
- A **catalog defaults fallback** so emails do not silently disappear when the database row for a switch is missing. The system uses the catalog default and still respects any explicit override you set in admin.
- An **EmailLog notificationKey** column so cron driven reminders are idempotent. Even if a cron job runs twice, the same reminder will not be sent twice.
- Time aware helpers like `isAfter5pmDayBefore` so the late cancellation rules behave correctly.

### What needs your clarification (about 22 questions)

The remaining catalog rows (around 45 entries) cover features where the business rule is not yet clear, or where the integration is not yet in place. Please confirm the intent so we can wire each one.

1. **Google Calendar sync**: should customers and cleaners receive `.ics` attachments, or do you want a real two way sync with Google Calendar?
2. **Gift cards**: do you want a gift card purchase flow? If yes, what is the redemption flow?
3. **Stripe Connect for cleaners**: are cleaner payouts supposed to flow through Stripe Connect (instant payouts) or stay on the current manual ledger?
4. **"On the way" notification**: should the cleaner press a button in the mobile app to notify the customer they are on the way, or should this be GPS triggered?
5. **Accept and decline workflow for cleaners**: when a cleaner is assigned, should they have a chance to accept or decline the job before it is locked in?
6. **Card hold lifecycle**: do you want pre authorisation holds at booking time, captured on completion, with notifications for hold placed, hold released, and capture failed?
7. **3DS authentication**: should we send the customer an email if their card requires 3DS challenge and the booking is on hold until they complete it?
8. **Cash or cheque fee**: is there a surcharge for cash or cheque payment that we should mention in the booking confirmation?
9. **Separate charge per cleaner**: in multi cleaner jobs, do you want one combined charge or one charge per cleaner?
10. **Quotes**: do you want a "request a quote" flow that is separate from a confirmed booking, with its own email lifecycle?
11. **Bulk charge**: is there a workflow where the admin charges a list of past bookings in one batch?
12. **Reschedule fee**: should the customer pay a fee if they reschedule, and should the email mention it?
13. **Customer to cleaner chat**: should customers be able to chat directly with the cleaner once a booking is confirmed, with email fallback?
14. **Subscription plan limits**: do plans cap monthly bookings? If yes, what is the email when a customer hits the cap?
15. **Monthly statement**: do you want an automatic monthly breakdown of bookings and payments sent to each customer?
16. **No show fee**: what is the policy and the notification?
17. **Cleaner late penalty**: if a cleaner is over X minutes late, what happens and who gets notified?
18. **Re assignment flow**: if a cleaner cancels last minute, do we auto suggest replacements or just notify the admin?
19. **Customer rating thresholds**: which star rating triggers a "we want to make it right" follow up to the customer?
20. **Provider performance reports**: do you want a weekly report email to each cleaner with their hours, jobs, and ratings?
21. **Marketing emails**: are promotional emails in scope, or only transactional?
22. **SMS channel**: the catalog supports SMS as a channel. Which notifications should also send by SMS, and using which provider (Twilio, MessageBird, other)?

---

## 2. Rag Wash credit system

### What is done

We built a complete projection and credit system for rags used per job.

- **Projection logic**: for each job we compute `Base 8 plus bedrooms times 4 plus bathrooms times 3 plus addons`. Add ons follow your multiplier rules.
- **Caps**: the projection is capped per category so a single job cannot drain the stock.
- **Add on multipliers**: oven, fridge, inside cabinets, windows, and other add ons each contribute the agreed extra count.
- **Credit ledger**: `User.ragCredits` and `User.padCredits` track every cleaner's running balance. Each completed job posts the awarded credits.
- **Auto allocation on completion**: when a job is marked complete, the projected count is allocated automatically. We removed the older "manual refill" flow per your earlier request.
- **Claim flow**: cleaners see their current balance in the mobile app and can claim a payout.
- **Admin oversight**: the admin sees a list of payout requests, can approve or reject, and can see which jobs contributed to the balance.
- **Flagged jobs**: any job where projected versus capped versus actual diverges by more than the threshold is flagged for review in the admin UI.

### What is not done and needs clarification

1. **Stripe instant payout**: the payout row is currently created in **PENDING** state, but we have not connected it to a real Stripe transfer. We need confirmation that Stripe Connect Express is the chosen rail, plus the cleaner onboarding flow.
2. **Cleaner reported actuals**: today we use the projected (or capped) count as the credited count. Do you want the cleaner to input the actual rags and pads used at checkout, with admin review when there is a delta?
3. **Manager override**: should managers be able to override the cap for special cases (very large home, post construction) without flagging the job?
4. **Weekly dashboard**: do you want a weekly summary email of total rags used, payouts issued, and flagged jobs?
5. **Efficiency bonus**: if a cleaner consistently uses fewer rags than projected, do you want to issue a bonus credit?

---

## 3. Inventory rules

### What is done

- **Product category** field added to every product (cleaning, paper, dispenser refill, equipment, other) so the inventory page can filter and group by category.
- **Post job inventory survey**: when a cleaner closes out a job, they enter spray bottles used, mop heads used, and disposable items used. The numbers post directly to the inventory ledger.
- **Spray conversion**: spray usage is recorded at **1.25 ml per spray**, matching the value you provided.
- **Capped credits**: the credit applied for each item is capped per category so a single job cannot create an unrealistic credit.
- **Combined restock notification**: when stock crosses the per product threshold, a single combined "restock needed" email is sent to admin instead of one email per item.
- **Inventory UX improvements**: filter by category, search by name, paginated list, "back to inventory" link fixed to its own row.
- **Transaction reliability**: the inventory checkout transaction now uses `maxWait: 10s, timeout: 30s` so it does not fail under load.

### What is not done and needs clarification

1. **Auto seed product list**: should we pre seed the 12 products from your inventory document, or do you want to enter them manually from the admin panel?
2. **Refill threshold defaults**: each product needs a default "notify at" count. What are the defaults you want for each of the 12 products?
3. **Supplier integration**: do you want the restock notification to also raise a purchase order with a specific supplier, or only email admin?
4. **Cleaner specific kit allocation**: should each cleaner be issued their own kit count and replenished individually, or is inventory shared across the team?
5. **Damaged or lost item flow**: when a cleaner reports a damaged item, should it deduct from inventory and create an admin alert?

---

## Where to test

A short test plan for the 75 wired notifications was shared earlier. Each one can be triggered from the admin panel or by running the matching cron path locally with the `CRON_SECRET` bearer token.

If you can answer the 22 plus 5 plus 5 clarification points above, we can finish the remaining 45 notification rows, complete the Stripe payout side of Rag Wash, and seed your real inventory rules.
