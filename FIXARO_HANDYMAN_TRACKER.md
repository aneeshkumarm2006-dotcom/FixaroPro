# Fixaro Handyman — Implementation Tracker & Mindmap

> Living document. Tracks **what we're doing**, **what's decided**, and **what needs clarification**
> for converting the Cleano-based app into the **Fixaro Handyman** product.
> Source of truth: `Fixaro_Handyman_Software_Change_Requirements_AWER_Format_v2.docx` (SOP v4.0).

**Legend:** ✅ done · 🔨 in progress · ⬜ not started · ❓ needs clarification · 💡 decision made

---

## 🧠 Mindmap (high-level)

```
FIXARO HANDYMAN (re-skin + rework of Cleano)
│
├── 0. Foundations
│   ├── ✅ Remove all "Rag Wash" sections (admin + handyman/cleaner dashboards) — hidden per SOP §9 "delete or hide"
│   │      (nav removed, 4 routes redirect, crew dashboard + my-pay sections no longer render)
│   ├── 〜 Fixaro branding (largely already done in prior reskin)
│   ├── ✅ Status icon/emoticon set mapped to Fixaro statuses — src/lib/status-icons.tsx (Q3)
│   ├── ✅ Role-based access (money/eligibility/refunds = admin only) — enforced in all new actions
│   └── ✅ Audit log on every high-impact change (AuditLog + logAudit; viewer at /audit)
│
├── 1. Data model (Phase 1)
│   └── ⬜ Config tables: services, materials/equipment charges, deposits,
│           provider eligibility, equipment checklists, painting bids,
│           final offers, notifications, refunds, cancellation fees, audit metadata
│
├── 2. Customer Booking (public + logged-in, same engine)
│   ├── ✅ Service equipment checklist shown at booking (Step2, §4/Q1)
│   ├── ✅ All-or-nothing materials checkbox  → draft.customerRequestsMaterials (default OFF)
│   ├── ✅ Checked → add service materials/deposit (see §5 price table)
│   ├── ✅ Unchecked → "you provide everything" copy, no charge
│   ├── ⬜ Painting immediate quote range (baseline + 35%, labeled ESTIMATE)  [Slice 2]
│   ├── ✅ $799 painting deposit when materials included (server-authoritative deposit)
│   ├── ⬜ Final-price accept/reject flow  [Slice 2]
│   └── ⬜ Cancellation copy + $25 fee (<24h), deposit still refundable  [Slice 4]
│
├── 3. Materials/Equipment Pricing (§5) — ~45 services, CAD
│   └── ✅ Price table seeded (MATERIALS_PRICING map: deposit vs cost per service)
│
├── 4. Painting Workflow (§6/§7) — most complex  [Slice 2 ✅ code-complete]
│   ├── ✅ Intake: size/scope → immediate range (baseline + 35%)  (PAINTING_SCOPES, scope picker in Step2)
│   ├── ✅ $799 deposit (via Slice 1 materials checkbox)  · ⬜ unused-balance reconciliation [Slice 4]
│   ├── ✅ Notify Painting providers on submit (all field providers; eligibility filter pending Slice 3)
│   ├── ✅ Bidding → lowest valid bid auto-wins (PaintingBid model, provider bids page)
│   ├── ✅ Final = winning bid × 1.35 (closeBiddingAndSendOffer)
│   ├── ✅ Client accept/reject notification (email + portal panel)
│   ├── ✅ Accept → confirm · Reject → cancel + refund $799 (rejectPaintingAndRefund)
│   ├── ✅ Daily reminders until response (cron, idempotent via offerLastReminderAt)
│   ├── ✅ <24h no response → ops phone-follow-up alert (cron, followUpFlaggedAt)
│   ├── ⬜ No answer → cancel + refund  (ops-driven; reuse rejectPaintingAndRefund — admin UI pending)
│   ├── ✅ Admin provider override action (overridePaintingProvider, D3) · ⬜ admin UI pending
│   └── ⬜ Admin send-offer/override UI on jobs/[id]  (actions exist; cron auto-closes after 24h)
│
├── 5. Handyman Portal (§8)  [Slice 3 ✅ eligibility core]
│   ├── ✅ Eligible jobs (read-only eligibility, admin-controlled) — available-jobs filtered by eligibility
│   ├── ✅ Ineligible jobs FULLY hidden (server-side `jobType in eligibleTypes`, claim + bid gated)
│   ├── 〜 Job cards exist; ⬜ checklist + materials flag on card [later]
│   ├── ✅ Required equipment list per job (EquipmentPanel) + missing-equipment warning (existing kit check) [Q1]
│   ├── ✅ Locker visit link + buy-receipt reimbursement flow (requestEquipmentReimbursement) [Q1]
│   ├── 〜 Clock-in/out exists; ⬜ explicit $79/hr labour line [Slice 4]
│   ├── ✅ Pay & history views (existing)
│   └── ✅ Job completion (notes/photos/status — existing)
│
├── 6. Admin / Ops (§9)
│   ├── ✅ Per-provider service eligibility matrix — Services tab on employee detail
│   ├── ✅ Eligibility audit log — generic AuditLog + logAudit on every change
│   ├── ✅ "D" indicator for deposit-review bookings (jobs list)
│   ├── ✅ Charge review before card charge — AdminJobOpsPanel billing breakdown + deposit controls
│   ├── ✅ Painting bid monitoring + provider override — AdminJobOpsPanel (send offer, bids, override)
│   ├── ✅ Audit-log viewer page (/audit) + nav
│   ├── 〜 Field leads / jobs / assignments / calendar (existing)
│   └── ⬜ Analytics deposit metrics (materials revenue, outstanding/applied/refunded) [follow-up]
│
├── 7. Payments & Billing (§10)  [Slice 4 ✅ data layer]
│   ├── ✅ $79/hr labour (admin-configurable via AppSetting pricing.labourRate) — billing.ts
│   ├── ✅ Separated line items computed (computeJobBilling) · ⬜ admin charge-review UI [Slice 5]
│   ├── ✅ Deposit apply/refund/partial + audit (adjustMaterialsDeposit) · ⬜ UI [Slice 5]
│   ├── ✅ $25 cancellation fee (<24h) — wired into cancelJobByAdmin (idempotent, audit, notify)
│   ├── ✅ $799 painting rejection refund (Slice 2) · ✅ deposit credited at charge (chargeJob)
│   ├── ✅ Never charge unassigned bookings (guard in chargeJob)
│   └── ✅ issueRefund + cancel refund now respect real deposit (was hardcoded $20)
│
├── 8. Notifications & Icons (§11)
│   ├── ⬜ Eligible-job notif (eligible providers only)
│   ├── ⬜ Painting final-offer notif
│   ├── ⬜ Daily painting reminders
│   ├── ⬜ <24h alert to ops
│   └── ⬜ D indicators + original status icons mapped
│
└── 9. QA (§12)
    └── ⬜ Security · permissions · booking · painting · handyman · admin · payments(sandbox) · audit · regression
```

---

## 💡 Decisions Made

| # | Topic | Decision |
|---|-------|----------|
| D1 | Painting deposit | **Follow the doc as written**: $799 deposit in every painting scenario when materials are included. |
| D2 | 35% surplus | **Confirmed.** Applied to (a) immediate quote range (estimate) and (b) final = winning bid × 1.35 (authoritative). |
| D3 | Admin provider override — state model | **Proposed (awaiting final confirm):** provider swap and price are *independent*. Overriding the provider keeps the client's already-agreed price by default; client is re-notified **only** if an admin explicitly changes the final price. See state model below. |

### Painting booking state model (re: D3)
```
BIDDING → BID_ACCEPTED (auto, lowest bid) → OFFER_SENT → CLIENT_ACCEPTED / CLIENT_REJECTED

Admin override transitions:
  • price UNCHANGED → reassign provider only · log it · DO NOT re-notify · keep client acceptance
  • price CHANGED   → reset to OFFER_SENT · send NEW offer · restart reminders · require fresh acceptance
```
**Why:** prevents (a) silently spamming a client who already accepted, and (b) silently overcharging
a client who only approved the lower price.

---

## ❓ Needs Clarification (Appendix A + open questions)

| # | Question | Status |
|---|----------|--------|
| Q1 | Final **equipment checklist per service** + locker/equipment **reimbursement** workflow. | ✅ done — `src/lib/equipment.ts` EQUIPMENT_BY_SERVICE; customer booking display (Step2 §4); crew job-card EquipmentPanel + locker link + reimbursement action (§8). Lists are seeded defaults; admins refine kits via existing Kit Templates which drive the missing-equipment warning. |
| Q2 | Final **service catalog** + pricing type. | 〜 catalog + materials types implemented from §5 (Slices 1–2). |
| Q3 | **Original icons/emoticons** mapped to Fixaro statuses. | ✅ done — `src/lib/status-icons.tsx` (job/painting/deposit/warning visuals + emoji), used in AdminJobOpsPanel; excludes Rag Wash. |
| Q4 | Notification **channels** for final amounts. | ✅ done — all available channels: email + SMS (`smsPaintingOffer`) + in-app portal panel. |
| Q5 | Confirm D3 state model (provider swap vs price independent). | ✅ implemented (overridePaintingProvider). |

---

## 🔜 Next Steps
- [x] Codebase audit (Next.js 16 + Prisma + Stripe + better-auth + Resend; service catalog already handyman-ish, $79/hr already set).
- [x] **Slice 1 — Materials pricing + booking checkbox (§4/§5)** — code complete on branch `feat/handyman-conversion`.
- [ ] **APPLY MIGRATIONS** (NOT yet applied — DB is remote/prod; decide target env):
      `20260618000000_job_materials` (S1) + `20260618001000_painting_workflow` (S2) + `20260618002000_provider_eligibility` (S3).
- [x] **Slice 3 — Provider eligibility (§8)** — code-complete. Files: `prisma` (EmployeeServiceEligibility + AuditLog),
      `src/lib/eligibility.ts`, `src/lib/audit.ts`, action `setEmployeeServiceEligibility.ts`, Services tab on employee detail,
      server-side filtering in available-jobs + painting-bids + claimJob + painting provider notify.
      NOTE: painting + claimable jobs now require admin-approved eligibility — set it per provider or those lists are empty.
      Backfill: `npx tsx prisma/seed-eligibility.ts` grants each provider the services they've already worked.
- [x] **Slice 4 — Payments & billing (§10)** — data layer code-complete. Files: `policy.ts` ($25/24h + DEFAULT_LABOUR_RATE),
      `src/lib/billing.ts` (getLabourRate, computeJobBilling, hoursWorked, depositCollected), `chargeJob.ts` (unassigned guard +
      deposit credit), `cancelJobByAdmin.ts` ($25 late-cancel fee + real deposit refund), `adjustMaterialsDeposit.ts`,
      `prisma/seed-eligibility.ts`. Deferred to Slice 5: admin charge-review/billing-breakdown/deposit-control UI.
- [x] **Slice 5 — Admin ops (§9)** — code-complete. Files: `jobs/[id]/AdminJobOpsPanel.tsx` (charge review + billing breakdown
      + painting send-offer/override + deposit reconciliation), mounted via `jobs/[id]/page.tsx`; D-indicator in `JobsView.tsx`
      + `jobs/page.tsx`; `audit/page.tsx` viewer + Sidebar nav. No migration.
      KNOWN FOLLOW-UP: `JobDetailView.tsx` line ~321 still hardcodes deposit refund display at $20 (huge file; the new
      AdminJobOpsPanel + cancel flow handle real deposits correctly). Analytics deposit metrics not yet added.
- [x] **Slice 6 — Rag Wash removal (§9, "hide" option)** — code-complete. Sidebar nav item + Droplets import removed;
      `inventory/rag-wash`, `inventory/rag-wash/[employeeId]`, `wash-payouts`, `my-inventory/rag-wash` pages now redirect;
      CleanerDashboard wash card + my-pay Rag Wash Credits section no longer render (ragData not supplied).
      DORMANT (intentionally left, not surfaced): RagWash/WashPayout models, clockOut wash-credit award, weekly cron wash
      email. Full schema/logic removal is a separate future step (risk: clockOut/payout). No migration this slice.

## ✅ Slices 1–6 all code-complete on branch `feat/handyman-conversion`. Pending: apply migrations + eligibility backfill; resolve Q1–Q5; optional follow-ups (icons §11/Q3, analytics deposit metrics, JobDetailView $20 display, full Rag Wash schema removal).
- [x] **Slice 2 — Painting workflow (§6/§7)** — code-complete on branch `feat/handyman-conversion`.
- [ ] Slice 2 follow-ups: admin send-offer/override UI on jobs/[id]; gate provider notify on eligibility (after Slice 3).
- [ ] Slice 3 — Provider eligibility (§8). Slice 4 — Payments/$25 fee + materials/deposit reconciliation (§10). Slice 5 — Admin ops (§9). Slice 6 — Rag Wash removal.
- [ ] Resolve Q1–Q5.

## 🔧 Slice 2 — files changed (branch feat/handyman-conversion)
- `prisma/schema.prisma` + `migrations/20260618001000_painting_workflow/` — PaintingStatus enum, PaintingBid model, Job painting fields
- `src/lib/painting.ts` — §7 baselines, PAINTING_SCOPES, 35% surplus + quote-range helpers
- `src/lib/painting-workflow.ts` — notify providers, closeBiddingAndSendOffer (lowest-bid auto-accept), reminders, rejectPaintingAndRefund
- `src/lib/notifications/catalog.ts` — painting notification keys · `src/lib/email.ts` — painting offer/reminder/rejected emails
- `src/app/(book)/...` — painting scope picker (Step2), persist + notify on submit (submitBooking), page wiring
- actions: `placeBid.ts`, `sendPaintingOffer.ts`, `overridePaintingProvider.ts`, portal `respondPaintingOffer.ts`
- `src/app/api/cron/painting/route.ts` + `vercel.json` — daily cron (auto-close bidding, reminders, <24h flag)
- provider UI: `painting-bids/` page + client; client UI: portal `PaintingOfferActions.tsx`; `available-jobs` excludes PAINTING; Sidebar nav
- fix: `issueRefund.ts` deposit cap now respects materials deposit (was hardcoded $20)

## 🔧 Slice 1 — files changed (branch feat/handyman-conversion)
- `src/app/(book)/book/types.ts` — MATERIALS_PRICING map + getMaterialsPricing + draft.customerRequestsMaterials
- `src/lib/booking-pricing.ts` — materials added to price/tax breakdown
- `prisma/schema.prisma` + `migrations/20260618000000_job_materials/` — Job.customerRequestsMaterials, materialsAmount, materialsType, materialsAppliedAmount, materialsRefundedAt
- `src/app/(book)/actions/submitBooking.ts` — persist materials (primary + recurring) + correct prepaid email amount
- `src/app/api/stripe/charge-deposit/route.ts` — server-authoritative deposit (painting $799 etc.)
- `src/app/(book)/book/steps/Step2Property.tsx` — materials checkbox UI
- `src/app/(book)/book/steps/Step5Review.tsx` — materials line + dynamic deposit display
- `src/app/(book)/book/page.tsx` — pass flag to submit + sidebar materials

---
_Last updated: 2026-06-18_
