# Fixaro Handyman — Implementation Tracker & Mindmap

> Living document. Tracks **what we're doing**, **what's decided**, and **what needs clarification**
> for converting the Cleano-based app into the **Fixaro Handyman** product.
> Source of truth: `Fixaro_Handyman_Software_Change_Requirements_AWER_Format_v4_2_Service_Update.pdf` (SOP **v4.2**).
> ⚠️ Slices 1–6 below were built against **v4.0**. See the **v4.2 Delta** section for what changed.

**Legend:** ✅ done · 🔨 in progress · ⬜ not started · ❓ needs clarification · 💡 decision made

---

## ✅ Stage 9 — QA, security & documentation (2026-07-14) — build is code-complete

The §12 Developer QA Checklist was run against the whole build (Stages 1–8 in code). Full report:
`_ai_context/Fixaro_v4.2_Stage9_QA_Report.md`.

- ✅ **Test infrastructure** — added **Vitest** and a **91-test** pure money-math suite under
  `site/test/` (`npm test`): tax, service-config pricing/materials, `computeChargeAmount` /
  `computeJobBilling` / deposits (incl. the idempotent-after-clock-out-overwrite property), policy
  (cancellation window, late-cap, `resolvePolicy`), and booking pricing (materials opt-in, AC = no
  materials, the **$119 painting trace**). `tsc --noEmit` clean.
- ✅ **§12 QA — all 10 areas.** Security **passes** the no-secrets bar on all 7 surfaces; Rag Wash
  removal **verified clean**; painting E2E, handyman portal, customer booking, regression and service
  additions all pass. Every finding was verified against the code before action.
- 🔧 **Fixed (verified):** a **CRITICAL** — `saveJob` had no role guard, so any EMPLOYEE/CLIENT could
  rewrite any job's `employeePay`/`price`/`status` by id; unauthenticated **product CRUD** (feeds
  expense accounting); alert **IDOR** + unauthenticated `migrateClients`; the **`issueRefund`
  hardcoded-`$20`** deposit cap (broke one-click refunds once the deposit was reconfigured); the
  **monthly-statement double-discount**; a temp debug route; and a central **AuditLog** sweep filling
  the payroll / provider-cash-out / role-change / card-charge / refund / deletion / deposit-adjust gaps.
- 📋 **Documented, not fixed** (report §4): **F1 (HIGH)** partial materials-deposit refund is clawed
  back on the card (needs a focused change to `computeChargeAmount`); **F2** single-job charge-modal
  preview ≠ amount charged (display); **F3** Stripe idempotency keys; F4–F9 lower items.
- ⏳ **Still needs a live environment:** the Stripe-sandbox walkthrough (report §5), a Cloudinary
  upload pass, and `prisma migrate deploy`.

---

## 🔺 v4.2 Delta (2026-07-10) — what changed vs the v4.0 build

Verified against code (not the old tracker). Slices 1–6 are ~85% aligned but were built to v4.0.

| # | v4.2 requirement | v4.0 code state | Action |
|---|---|---|---|
| Δ1 | **Painting = $119 flat materials/equipment charge** (client provides paint; not a deposit; no unused balance) | `PAINTING: { 799, "deposit" }` in 14 files | ✅ Converted to $119, captured **upfront** (D6); all copy fixed; Step2 shows flat-charge (not deposit) copy |
| Δ2 | **Small paint repair** — $79/hr, **$49** materials (paint not incl.), intake fields | absent everywhere (src + prisma) | ✅ Catalog + `$49 cost` + equipment + eligibility + **structured intake** (area, surface) + copy |
| Δ3 | **AC installation** — $79/hr, **no** auto materials, intake fields | absent everywhere | ✅ Catalog + no materials charge + equipment + eligibility + **structured intake** (type, location, mount, has-unit) + copy |
| Δ4 | Both new services in **Get-a-Quote** form | quote form has 4 hardcoded category buckets only | ✅ Added as explicit options |
| Δ5 | Painting quote range correct | `painting.ts` studio `baselineMax:945` double-counts surplus → shows ~$1,276 | ✅ Fixed → baseline 700–900 (=$945–$1,215) |
| Δ6 | Client always provides paint | `painting.ts` notes say *"work + paint included"* | ✅ All scope notes now say "labour only, you provide the paint" |

**Note:** §5 materials pricing for all ~40 other services was verified **line-by-line correct** vs v4.2.

**Verified:** `npx tsc --noEmit` and `next build` both pass clean. No `$799`/"paint included" strings remain in `src/`.

### Also closed out in this pass
- ✅ **`JobDetailView` $20 hardcode** — was a real bug, not just copy: line ~321 fed `refundCap`, so a
  painting job with $119 collected capped admin refunds at $20. Now derives from `materialsType`/
  `materialsAmount` (mirrors `depositCollected()` in `billing.ts`, which is server-only). 3 sites fixed.
- ✅ **Analytics deposit metrics (§9)** — `materialsRevenue`, `depositsOutstanding`, `depositsApplied`,
  `depositsRefunded` computed in `analytics/page.tsx`, rendered in a new "Materials, equipment & deposits"
  panel on the Payments tab.

### ⚠️ Migrations — 4 now pending, NOT applied (DB is remote/prod)
`20260618000000_job_materials` · `20260618001000_painting_workflow` · `20260618002000_provider_eligibility`
· **`20260710000000_service_intake_fields`** (new — 6 nullable columns on `Job`, safe/additive)

Then: `npx tsx prisma/seed-eligibility.ts`, and grant PAINTING / SMALL_PAINT_REPAIR / AC_INSTALLATION
eligibility per provider or those job + bid lists stay empty.

### 💡 Decision D6 — $119 capture timing
**Confirmed with client: capture $119 UPFRONT at booking** (same mechanism as the old $799).
On rejection → auto-refund $119. Internally the materials `type` stays `"deposit"` (the upfront-capture +
refund + credit plumbing), but **all customer/admin-facing wording drops "deposit"** → "materials/equipment
charge." Refund logic is data-driven off `job.materialsAmount`, so $799→$119 propagates automatically.

---

## 🔍 Full-codebase SOP v4.2 audit + gap-fix pass (2026-07-11)

Six parallel audit agents verified every SOP section against actual code; ~44/51 requirements were
fully DONE, 6 PARTIAL, 1 MISSING. All actionable gaps then fixed (5 parallel fix agents + follow-ups);
`tsc --noEmit` and `next build` pass clean after the combined diff (22 files changed, 2 added).

| Gap (SOP ref) | Fix |
|---|---|
| §10.2 manual clock correction — was MISSING | New `actions/adjustClockTimes.ts` (admin-only, required reason, validation, `CLOCK_TIME_ADJUSTED` audit + jobLog, payout `totalHours` delta for open periods) + "Clock correction" UI in AdminJobOpsPanel |
| §10.3/§9.4 Bulk Charge had no review step | bulk-charge now shows per-job expandable SOP §10 itemization via `computeJobBilling` + `chargeJob` math mirror; "No clock record" amber flag (excluded from select-all); charge button shows reviewed total |
| §9.8 residual Rag Wash | my-pay `db.ragWash` query + Rag Wash Credits UI removed; "Kit + rag washes" tile reworded; `weekly_ragwash` catalog entry + weekly-cron sender removed. Dormant on purpose: RagWash/WashPayout models, clockOut wash-credit award, dead `sendAdminWeeklyRagWashDashboard` in email.ts, redirecting routes |
| §9.6 calendar missing material status + D flags | `getJobsForDay` now carries materials fields + `needsDepositReview` (same logic as JobsView); EventCard/MonthView render `DEPOSIT_VISUAL` D badge + 📦 |
| §9.10 new services rendered as raw codes on calendar | shared `components/calendar/job-type-label.ts` (short-code map + SERVICE_CATALOG fallback), used by EventCard/MonthView/CalendarJobActions |
| §8.4 pre-claim job card thin | available-jobs card shows 📦/🧰 materials pill + required-equipment summary (server-resolved, admin overrides honoured) |
| §7 studio baseline coded 700–900 | `painting.ts` studio = flat $700 (→$945); all min===max range displays collapse to single price (Step2, portal, painting-bids, AdminJobOpsPanel) |
| §7 scope-note copy | bathroom/studio/apartment notes now all say 2 coats · labour only · you provide paint · primer extra |
| §10.5 deposit-adjust reason optional | `adjustMaterialsDeposit` reason now required server-side + required input in panel UI |
| §6.6 offer breakdown missing $119 collected | AdminJobOpsPanel painting section shows "Materials & equipment $X already collected at booking" |
| Stale copy | schema `REJECTED` comment ($799→$119), placeBid eligibility comment, painting-workflow "deposit"→"materials/equipment charge" in admin-visible logs |

**Deliberately deferred (product decisions):** hiring-checklist-seeded eligibility (§8.1/§9.1 — no
checklist→eligibility link exists; needs a defined onboarding model); dedicated photo uploader in
Small-paint-repair/AC booking intake (§4 — currently deferred to notes step; needs upload infra in
public flow). Also still pending: 4 prisma migrations + eligibility backfill (see above).

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
| D1 | Painting deposit | ~~$799 deposit when materials included~~ **SUPERSEDED by v4.2 → see D6**: $119 flat materials charge. |
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
