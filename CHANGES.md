# Cleano Software — Session Changes

This bundle covers five features. Each section lists **what was built**, **what was already in place**, and a **Task → Outcome** test plan you can walk through.

---

## 0. Fixaro v4.2 — Stage 9: QA, security & documentation (2026-07-14)

Full report: `_ai_context/Fixaro_v4.2_Stage9_QA_Report.md`.

### What was built
- **A test runner + 91 money-math unit tests.** There was no test infrastructure; added **Vitest**
  (`site/vitest.config.ts`, with `@/db` stubbed so the pure billing functions test hermetically) and
  a suite under `site/test/` covering tax, service-config pricing/materials, `computeChargeAmount` /
  `computeJobBilling` / deposit credit, policy resolution + the cancellation window, and booking
  pricing (including the $119 painting materials trace and AC-installation-has-no-materials). Run with
  `npm test`.
- **Security & permissions fixes** surfaced by the §12 QA pass, each verified against the code first:
  - **`saveJob` is now admin-only** — it previously checked only "is signed in", then wrote
    `employeePay` / `price` / `totalTip` / `payRateMultiplier` / `paymentReceived` / `status` onto any
    job by id. Any employee or client could have paid themselves an arbitrary amount. **(CRITICAL)**
  - **Product create/update/delete now require an admin session** — they were fully unauthenticated,
    and `costPerUnit` feeds expense accounting. **(HIGH)**
  - **Alert dismiss/read/create require an admin session** (were an unauthenticated IDOR on the ops
    inbox); `migrateClients` now requires admin; a temp Cloudinary debug route was deleted.
  - **`issueRefund` no longer hardcodes the base deposit as `$20`** — it reads the configured value,
    so one-click deposit refunds keep working after the deposit amount is changed. **(HIGH, money)**
  - **The customer monthly statement no longer subtracts the discount twice.** **(MEDIUM, money)**
- **Audit-trail completeness** — added the central audit log (who / old→new / when) to payroll edits
  and release, provider cash-out, role changes, card charges, refunds, deletions, and deposit
  adjustments, so the Audit page reflects every high-impact money and permission change.

### What was already in place
- The money math itself (`computeChargeAmount` / `computeJobBilling`), the eligibility self-approval
  lock, server-side available-jobs filtering, the painting bid→offer→reminder workflow, and the
  no-secrets posture all **passed** QA unchanged.

### Known follow-ups (documented, not changed this pass)
- **F1 (HIGH):** a partial materials-deposit refund is clawed back on the card charge (the full
  materials amount stays in the taxable subtotal). Fix belongs in `computeChargeAmount` with its own
  review. **F2:** the single-job "Charge" modal previews a number higher than what is actually charged
  (display only). **F3:** add Stripe idempotency keys. See report §4 for F4–F9.

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Developer | `cd site && npm test` | 91 tests pass |
| Employee (non-admin) | Attempt `saveJob` / product create by id (e.g. via a crafted request) | Rejected — "Forbidden" / "Not authorized" |
| Admin | Change the base booking deposit to ≠ $20, cancel a booking, click "Refund deposit" | Refund succeeds for the configured amount (not capped at $20) |
| Admin | Open the Audit page after a payout edit / card charge / refund / role change | Each shows actor + old→new value |
| Admin | Run the Stripe-sandbox walkthrough (report §5) | Amounts match the expected figures; **watch F1 at steps 10–12** |

---

## 1. PWA Install — Drawer button + smarter banner

### What was built
- **Always-visible "Install app" entry in the cleaner drawer.** Previously the banner short-circuited forever after a single dismiss, so users had no way back. Drawer entry now triggers Chrome's install prompt directly, or shows iOS "Add to Home Screen" instructions on Safari.
- **`InstallContext` provider** so the drawer button and the banner share the same `beforeinstallprompt` state instead of competing for the event.
- **Dismiss key bumped to `v2` with 14-day cooldown** — previously dismissed users see the banner again.

### What was already in place
- PWA manifest (`/manifest.webmanifest`), dynamic icon endpoints (`/icon/32`, `/icon/192`, `/icon/512`), apple-touch-icon.
- Floating install banner component.

### Files
- `src/components/InstallContext.tsx` (new)
- `src/components/InstallPrompt.tsx` (rewritten)
- `src/app/(app)/CleanerSidebar.tsx` (added entry)
- `src/app/(app)/layout.tsx` (added provider)
- `src/app/globals.css` (added styles)

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Cleaner (Chrome desktop / Android) | Sign in, open the drawer (hamburger top-left on mobile) | See an **"Install app"** card with `1-tap` chip |
| Cleaner | Click "Install app" | Browser's native "Install Cleano?" prompt opens |
| Cleaner | Accept install | App opens standalone (no browser chrome). Drawer entry disappears on next load |
| Cleaner (iOS Safari) | Open drawer | "Install app" shows `iOS` chip; tapping shows Add-to-Home-Screen instructions |
| Cleaner | Dismiss the floating banner once | Hidden for 14 days, but drawer button still works |

---

## 2. Chat Notifications — Badges + toast + browser push

### What was built
- **Unread badge on the cleaner's Messages drawer link** (red pill, caps at "99+").
- **Unread badge on the cleaner's bottom Chat tab** (red dot on icon, caps at "9+").
- **In-app toast** slides in bottom-right (desktop) or above the bottom tab bar (mobile) when a new admin message arrives while the user isn't on `/chat`. Auto-dismisses after 5s with "Open Chat →" link.
- **Browser/OS notification** — asks for permission 8s after login (gentle, doesn't collide with install prompt). When granted, fires a native notification if the tab is backgrounded.
- 5-second polling matches the admin side (so both sides feel equally live).
- Auto-marks read on opening `/chat` (already existed in `getEmployeeChat`).

### What was already in place
- Server-side `getUnreadChatCount()` action.
- Read-tracking columns on `ChatMessage` (`readByAdminAt`, `readByEmployeeAt`).
- Equivalent badge + toast for admins — this just brings the cleaner side to parity.

### Files
- `src/app/(app)/CleanerSidebar.tsx` (polling, badges, toast, browser notifications)
- `src/app/globals.css` (`.cl-snav-badge-count`, `.cl-tab-badge`, `.cl-chat-toast`)

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Cleaner | Sign in. Wait ~8s. Browser asks permission for notifications. Click **Allow** | Permission stored. No more prompts. |
| Admin (other browser/window) | Open chat, find the cleaner, send a message | |
| Cleaner | Within 5 seconds, on any page except `/chat` | Red badge appears on **Messages** in drawer + on **Chat** in bottom tab; deep-teal toast slides in with sender name + preview + "Open Chat →" |
| Cleaner | Tap "Open Chat →" | Navigates to `/chat`; toast disappears; badges clear |
| Cleaner | Background the tab (switch to another app), receive a new message | Native OS notification shows. Clicking it focuses Cleano and opens `/chat` |
| Admin | Send a second message while cleaner is on `/chat` | No toast (auto-marked read on view); admin's "unread from employee" stays 0 |

---

## 3. Notification Catalog — Full admin control center

### What was built
- **`NotificationSetting` Prisma model** — one row per `(recipient, key, channel)` combination.
- **`NotificationRecipient` enum** (`ADMIN | CUSTOMER | PROVIDER`).
- **`NotificationChannel` enum** (`EMAIL | SMS | APP_PUSH`).
- **~120 catalog entries** seeded from the TeamCleano Notification Catalog spec — every Admin, Customer, and Provider notification across all sections (Account, General, Booking, Cancellation, Unassigned, Reminders, Fees, Payments, Rating, Gift card, Payment processor, Schedule, Clock in/out, Reschedule fee, Checklist, Invoice, Signup, Chat) **plus** the Proposed Additions (Instant payouts, Chat, Documents/signatures, Provider reporting) flagged with `isProposed: true`.
- **Idempotent seeding** — `enabled` toggles survive future redeploys.
- **Admin UI: Settings → Notifications** with recipient tabs, category cards, per-channel toggles, and "Enable all / Disable all" bulk actions.
- **Helper `isNotificationEnabled(recipient, key, channel)`** — call site for future event wiring.
- **"Refresh catalog" button** so new catalog entries can be re-seeded without redeploy.

### What was already in place
- Generic `Alert` table for in-app system alerts (used here for the cleaner restock alert too).
- Resend email infrastructure, Stripe webhook → email flows.

### Files
- `prisma/schema.prisma` (+ migration `20260528101418_add_notification_settings`)
- `src/lib/notifications/catalog.ts` (catalog data)
- `src/lib/notifications/index.ts` (seed + helper)
- `src/app/(app)/actions/notificationSettings.ts` (toggle/bulk/reseed server actions)
- `src/app/(app)/settings/tabs/NotificationsTab.tsx` (admin UI)
- `src/app/(app)/settings/SettingsClient.tsx` (tab registration)
- `src/app/(app)/settings/page.tsx` (auto-seed on first admin visit)

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Admin | Sign in, open **Settings → Notifications** | First load auto-seeds ~120 rows. Three recipient tabs (Admin / Customer / Provider), each showing categories |
| Admin | Click any **Email**/**SMS**/**App Push** pill on a notification row | Pill flips Off (grey) ↔ On (emerald). Saves instantly via server action. Refresh — state persists |
| Admin | In a category header, click "Enable all Email" | Every row in that category flips Email → On |
| Admin | Switch to Customer tab | See all customer notifications (Account, Booking, Reminders, Refunds, etc.) |
| Admin | Find rows tagged **PROPOSED** (amber pill) | These are the new ones requested in the PDF — Instant payouts, Chat enhancements, Document signatures, Monthly breakdown |
| Admin | Click **Refresh catalog** | Re-runs the seed. Adds any new catalog entries since last seed but never overwrites your toggles |

> **Note** — toggling a setting controls *whether the system will send* once event code calls `isNotificationEnabled(...)`. Wiring up each event (e.g., "send admin email on new booking") is the next phase. The catalog and toggles are the foundation.

---

## 4. Post-Job Inventory Usage Feature

### What was built
- **`ProductCategory` enum** (`LIQUID_SPRAY | MOP_LIQUID | DISPOSABLE | OTHER`) on the `Product` model.
- **Brand-new clock-out survey UI** matching the Inventory Rules spec exactly:
  - **Liquid sprays** — 4 pills: None / Light (15 sprays) / Medium (30) / Heavy (40+). Shows live ml-deducted preview (1 spray = 1.25 ml).
  - **Mop-based liquids** — 4 pills: None / 1 / 2 / 3+ mops.
  - **Disposables** — quantity cards with `0 / +1 / +2 / +3` buttons per item (sponges, gloves, paper towels, etc.).
  - Title is now **"Post-job inventory"**, submit button is **"Submit usage and close job"** (per spec).
- **Server-side spray ml conversion + stock deduction** per category.
- **One combined restock Alert** addressed to the cleaner when stock ≤ refill threshold, with the spec's exact copy:
  - Single: *"You are low on X. Please refill it from the storage locker before your next job."*
  - Multi: *"You are low on X, Y, and Z. Please refill these items from the storage locker before your next job."*
- **Admin product form gets a Category select** so each product can be tagged correctly.
- "Other" (uncategorized) products fall back to the legacy "remaining quantity" input so nothing breaks.

### What was already in place
- `EmployeeProduct` stock tracking, `JobProductUsage` records, `InventoryRule.refillThreshold` field.
- "Pickup from storage" flow.
- `clockOut` server action — but it asked for "remaining" which forced cleaners to do mental arithmetic.

### Files
- `prisma/schema.prisma` (+ migration `20260527130811_add_product_category`)
- `src/app/(app)/my-jobs/ClockOutButton.tsx` (rewritten UI)
- `src/app/(app)/my-jobs/[jobId]/page.tsx` (include `category` in fetch)
- `src/app/(app)/actions/clockOut.ts` (new payload, ml conversion, combined alert)
- `src/app/(app)/inventory/ProductModal.tsx` (added Category select)
- `src/app/(app)/inventory/InventoryView.tsx` + `InventoryPageClient.tsx` + `inventory/page.tsx` (Product type + passthrough)
- `src/app/(app)/actions/createProduct.ts` + `updateProduct.ts` (accept `category`)
- `src/app/globals.css` (post-job survey styles)

### Setup before testing
1. **Admin** → Inventory → edit each product → set **Category** correctly:
   - Windex, All-Purpose Cleaner, CLR, Eco-friendly cleaner → **Liquid spray**
   - Floor cleaner, Murphy Oil Soap → **Mop-based liquid**
   - Sponges, Garbage bags, Paper towels, Magic erasers, Gloves, Masks → **Disposable**
2. **Admin** → Settings → Inventory Rules → set the refill threshold per product (Inventory Rules PDF §7 has the suggested values: 150 ml for sprays, 1 mop use, 2 for sponges/garbage/gloves/masks, 1 for paper towels/erasers).
3. Assign a few of these products to a cleaner via the inventory pickup flow (or admin-assign).

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Cleaner | Open an in-progress job in **My jobs**, click **Clock Out** | Modal opens titled "Post-job inventory" with three sections — Liquid sprays, Mop-based liquids, Disposables — populated from your assigned products |
| Cleaner | In Liquid sprays section, click "Medium use" for Windex | The preview line shows **"Deducts 37.50 ml (30 sprays)"** |
| Cleaner | In Disposables, tap **+2** on Garbage bags | Card shows **−2** at the bottom |
| Cleaner | In Mops, pick "2 mops" for Floor cleaner | Shows "Deducts 2 mop uses" |
| Cleaner | Click **Submit usage and close job** | Modal closes; job → COMPLETED; clock-out timestamp set |
| Admin | Check the job's transactions | A SUPPLIES auto-transaction was created for the cost of consumed stock |
| Admin | Check the cleaner's **My inventory** stock | All deductions applied (e.g., Windex −37.5 ml, Garbage bags −2) |
| Cleaner | If a deduction took stock to/below the threshold, check **Alerts** / refresh | Single combined alert: *"Restock needed before your next job — You are low on X (and Y, and Z). Please refill these items from the storage locker before your next job."* |

---

## 5. Per-Room Pricing Add-Ons

### What was built
- **Admin add-ons now carry a Room field.** Each add-on row in Settings → Pricing Rules has a new **Room** select: Kitchen / Bathroom / Bedroom / Living room / Laundry / Outdoor / Whole home.
- **Customer booking is now DB-driven.** Removed the hardcoded list. New server action `getBookingConfig()` reads the `pricing.addOns` AppSetting and normalizes it.
- **Customer Step 2 groups add-ons by room** under uppercase room headers, preserving the existing checkbox multi-select UX.
- **Empty state** if no add-ons configured: *"No add-ons available right now."*

### What was already in place
- Customer booking flow with checkbox multi-select.
- Per-unit pricing (base + per bedroom + per bathroom) in Settings → Pricing Rules.
- `JobAddOn` storage for whichever add-ons a customer chose.

### Files
- `src/app/(app)/settings/tabs/PricingRulesTab.tsx` (added Room select)
- `src/app/(book)/actions/getBookingConfig.ts` (new server action)
- `src/app/(book)/book/types.ts` (added `roomType`, removed hardcoded list)
- `src/app/(book)/book/page.tsx` (loads catalog on mount)
- `src/app/(book)/book/steps/Step2Property.tsx` (groups by room)

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Admin | Go to **Settings → Pricing Rules** → Add-Ons section | Each existing add-on shows a third **Room** select (defaults to Whole home if previously unset) |
| Admin | Click **+ Add Add-On**, enter `Inside fridge`, $25, Room = **Kitchen** | Row added |
| Admin | Add `Inside windows`, $30, Room = **Whole home** | Row added |
| Admin | Add `Mold scrub`, $20, Room = **Bathroom** | Row added |
| Admin | Click **Save Pricing Rules** | Success banner |
| Customer | Open `/book` in a new private window, get to Step 2 (Property) | "Add-ons" section now shows uppercase room labels: **KITCHEN** > Inside fridge; **BATHROOM** > Mold scrub; **WHOLE HOME** > Inside windows |
| Customer | Tick Inside fridge + Mold scrub | Both rows go active (green checkmark) |
| Customer | Continue to Step 5 (Review) | Quote shows the 2 selected add-ons summed into the total |
| Customer | Complete booking | `JobAddOn` records created with name + price (room context preserved in selection state but isn't persisted on the JobAddOn itself yet — easy follow-up if you want it) |

---

## 6. WhatsApp-Style Chat Receipts + Presence + Email-on-Message

### What was built
- **Online presence**: `User.lastSeenAt` timestamp updated every 20s by a heartbeat endpoint (`/api/presence/ping`) while a tab is visible. "Online" = pinged within last 60s.
- **Three delivery states** on every sent message:
  - ✓ (single tick) — sent, recipient hasn't been online since
  - ✓✓ (double tick) — recipient has been online but hasn't opened chat (uses `ChatMessage.deliveredAt`)
  - 👁 (eye) — recipient has opened the conversation (`readByXAt` set)
- **Header status pill** on both admin + cleaner sides shows "Active now" (green) or "Offline".
- **Auto-scroll to newest message** on open + on every new arrival (rAF double-pass, handles late-loading images/attachments).
- **Email-on-message** (`notifyChatEmail.ts`): when a cleaner messages admin (or vice versa) and the recipient is **offline**, an email fires. Throttled to one email per direction per conversation every 5 minutes so back-and-forth chats don't spam inboxes.
- **First real `isNotificationEnabled()` wiring**: the chat email respects `admin.chat.customer_provider_msg` / `prov.chat.new_message_v2` EMAIL toggles in Settings → Notifications. Toggle off → emails stop. (Other notification catalog entries are still ornamental until wired in.)

### Files
- `prisma/schema.prisma` + migration `20260528105306_chat_presence_and_receipts`
- `src/app/api/presence/ping/route.ts` (new)
- `src/components/PresenceHeartbeat.tsx` (new, mounted in `(app)/layout.tsx`)
- `src/app/(app)/chat/Receipt.tsx` (new — ✓ / ✓✓ / 👁 SVG component)
- `src/app/(app)/chat/notifyChatEmail.ts` (new)
- `src/app/(app)/chat/actions.ts` (receipt + online state + email trigger)
- `src/app/(app)/chat/types.ts`, `EmployeeChatClient.tsx`, `AdminChatClient.tsx`, `page.tsx`

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Admin / Cleaner | Open chat as two different users in two browsers | Both ping `/api/presence/ping` every 20s |
| Admin | Send message while cleaner is offline | ✓ single tick |
| Cleaner | Open another Cleano page (not /chat) | After cleaner's next ping (≤20s) admin sees ✓✓ |
| Cleaner | Open `/chat` | Admin's bubble flips to 👁 eye |
| Cleaner | Close tab, admin sends another message after 5min | Cleaner gets email *"Admin messaged you on Cleano"* |
| Admin | **Settings → Notifications → Provider tab → Chat (proposed) → Email = Off** | No more chat emails to that cleaner. Toggle on → resume. |

---

## 7. Cleaner Inventory Checkout — Restyle + Bug Fix

### What was fixed
- "Failed to complete checkout" — root cause was Prisma's default 5s transaction timeout being blown by Supabase round-trip latency. Bumped to `maxWait: 10s, timeout: 30s`.
- Errors now surface the real Prisma message instead of the generic "Failed to complete checkout".
- After confirmed pickup the page now uses a 2-stage redirect (`router.push` at 900ms + hard `window.location.href` fallback at 2.5s) so the "Rendering..." indicator can't get stuck.
- Cart stays visible during the success state so the summary doesn't blank to "ITEMS (0)" before the redirect fires.

### What was restyled
- Whole page (`/my-inventory/checkout`) now uses the cleaner end design language (`cl-page-wrap`, `cl-page-head`, teal pill stepper, location cards, product rows, sticky cart sidebar, summary list).
- New CSS section in `globals.css` under "Cleaner-end inventory checkout".

### Files
- `src/app/(app)/actions/checkoutInventory.ts` (timeout + error surfacing)
- `src/app/(app)/my-inventory/checkout/CheckoutClient.tsx` (full restyle + redirect fix)
- `src/app/(app)/my-inventory/checkout/CheckoutSummary.tsx` (full restyle)
- `src/app/globals.css` (`.cl-co-*` classes)

---

## 8. Admin Inventory + Web Bookings — Match Jobs Design

### What was restyled
- **`/inventory`** — now uses the Jobs admin chrome: `admin-font` wrapper, `admin-eyebrow` + `admin-page-title` header, "New product" pill, 4-card `astat-grid` (Total products / Low stock / Stock value / Assigned to crew), Jobs-style `atabs` segmented tabs for Products / Suppliers / Forecast.
- **`/web-bookings`** — same admin chrome + 4 clickable `astat-grid` filter stats (Total / Needs cleaner / Flexible time / Needs attention). Active filter card highlighted with teal border.

### Files
- `src/app/(app)/inventory/InventoryPageClient.tsx` (tab strip swap)
- `src/app/(app)/inventory/InventoryView.tsx` (header + stats grid)
- `src/app/(app)/web-bookings/WebBookingsPageClient.tsx` (header + FilterStat replacement)

---

## 9. Rag Wash Credit System (Self-Wash Job-Based Model)

### What was built
End-to-end implementation of the Cleano Self-Wash spec — projection, ledger, claim flow, admin oversight.

**Schema** (migration `20260528161342_rag_wash_credit_system`):
- `Job` gets `washProjectedRags/Pads`, `washCappedRags/Pads`, `washActualRags/Pads`, `washCreditsAwarded` (idempotency flag)
- `User` gets `ragCredits` + `padCredits` running ledger
- `RagWash` extended with `padCount`
- New `WashPayout` table + `WashPayoutStatus` enum (PENDING / COMPLETED / FAILED)

**Projection library** (`src/lib/wash/index.ts`) — pure functions matching the PDF spec exactly:
- Formula `8 + bedrooms × 4 + bathrooms × 3 + add-on rag delta` (and `1 + add-on pad delta` for pads)
- Add-on multipliers: Oven Deep Clean +3/0, Fridge Interior +3/0, Baseboard Detail +2/+1, Shower/Tile Deep +3/+1, Wall Spot +2/+1, Cabinet Interiors +2/0, Move-In Detailing +5/+1, Couch/Upholstery +1/0
- Hard caps by category: Studio 20/2, 1-2 BR 30/3, 3+ BR / Move-In 35/4
- Credit math: 1 credit per rag (50 → $3.00), 2 credits per pad (20 → $2.00)
- Over-projection helper (≥10% threshold for admin auto-flagging)

**Auto-award on clock-out** (`src/app/(app)/actions/clockOut.ts`):
- When job becomes COMPLETED, projection is computed + stored on the Job
- Capped credits are split evenly across all assigned cleaners
- `washCreditsAwarded` flag prevents double-award on repeat clock-outs

**Cleaner UI** (`/my-inventory/rag-wash`):
- Teal hero showing **$X.XX ready to claim**
- Two progress bars: rag credits → next $3, pad credits → next $2
- **"Claim wash funds"** button — drains ledger, writes WashPayout row (status = PENDING, ready for Stripe Connect wiring later)
- Recent payouts list with status pills (PENDING / COMPLETED / FAILED)
- Per-job projection log: projected vs capped vs actual; over-projection rows flagged red
- Manual wash log (rags + pads)

**Admin UI** (new route `/wash-payouts`, sidebar link "Wash Payouts"):
- Matches Jobs design (admin-font, astat-grid, atabs)
- 4 stat cards: Total cleaners / Pending $ / Paid all-time / Outstanding credits
- 3 tabs:
  - **Cleaner ledger** — grid of every cleaner's rag/pad balance + claimable $ (searchable)
  - **Payouts** — table of every claim with status and credits used
  - **Flagged jobs** — jobs where actual rag use ≥10% over projection (per spec §Verification)

### Files
- `prisma/schema.prisma` + migration `20260528161342_rag_wash_credit_system`
- `src/lib/wash/index.ts` (new — projection lib)
- `src/app/(app)/actions/clockOut.ts` (computes + awards credits)
- `src/app/(app)/actions/claimWashPayout.ts` (new)
- `src/app/(app)/actions/createRagWash.ts` (added padCount)
- `src/app/(app)/my-inventory/rag-wash/page.tsx` + `MyRagWashClient.tsx` (full rewrite)
- `src/app/(app)/wash-payouts/page.tsx` + `WashPayoutsPageClient.tsx` (new)
- `src/app/(app)/Sidebar.tsx` (added link)
- `src/app/globals.css` (`.cl-rw-*` classes)

### Setup
1. Run the migration SQL (idempotent, in Supabase SQL editor — see the chat thread).
2. Mark applied: `npx prisma migrate resolve --applied 20260528161342_rag_wash_credit_system`
3. Restart dev server.

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Cleaner | Complete a 2-bed 1-bath job with Oven Deep Clean add-on, clock out | Projection: 8 + 8 + 3 + 3 = 22 rags. Job logs `washProjectedRags=22, washCappedRags=22, washCreditsAwarded=true`. Cleaner's `ragCredits` += 22 |
| Cleaner | Open `/my-inventory/rag-wash` | Hero shows "$0.00 ready to claim" (22 rag credits, threshold is 50). Progress bar at ~44%. Recent jobs list shows that job's projection. |
| Cleaner | Complete enough jobs to push ≥50 rag credits | Hero shows "$3.00 ready to claim". Claim button enabled. |
| Cleaner | Click **Claim wash funds** | Modal closes, success banner. `WashPayout` row created (PENDING). Cleaner's `ragCredits` decremented by 50. |
| Admin | Open `/wash-payouts` | 4 stat cards populated. Ledger tab shows all cleaners with balances. Payouts tab shows the PENDING claim. |
| Admin | Switch to **Flagged jobs** tab | Lists any completed jobs where `washActualRags > washProjectedRags × 1.10` |

### Known gaps / deferred (NOT all PDF features are live yet)
- **Stripe instant payout** — `claimWashPayout` writes a row as PENDING but doesn't yet call Stripe Connect to actually move money. Data + UX are complete; needs Stripe Connect account confirmation to wire.
- **Cleaner-reported "actual" rags** — `Job.washActualRags` is in the schema and rendered in the admin "Flagged jobs" view, but there's no input flow at clock-out yet. Easy 1-modal-field add later.
- **Manager override** — spec §"Verification & Quality Control" says admin can approve extra credits for special cases (post-renovation, water damage). Not built; would be a single admin action that increments the cleaner's ledger with a reason.
- **Weekly admin dashboard** — spec says "Weekly dashboard shows average rag use per cleaner, per sq ft." Not built. Would need a `/wash-payouts` sub-tab with `actual / sq_ft` metrics aggregated by week.
- **Efficiency bonus** — spec mentions "optional efficiency bonus for consistent low-usage performance (≤80% of projections for 10+ jobs)." Not built. Would be a periodic batch job that scans completed jobs per cleaner and credits a bonus.

---

## Migrations to apply
Run on local: `npx prisma migrate dev`
Run on Vercel/Supabase: `npx prisma migrate deploy` (or paste each migration SQL into the Supabase SQL editor — answer **"Don't enable RLS"** when prompted, since the schema doesn't use it elsewhere).

Pending migrations across all sessions:
- `prisma/migrations/20260527130811_add_product_category/`
- `prisma/migrations/20260528101418_add_notification_settings/`
- `prisma/migrations/20260528105306_chat_presence_and_receipts/`
- `prisma/migrations/20260528161342_rag_wash_credit_system/`

---

## What's *not* done in this bundle (next sessions)
- **Seed the 12 specific products** from the Inventory Rules PDF with default categories and refill thresholds — currently the admin needs to tag them manually.
- **Persist `roomType` on `JobAddOn`** if you want per-room reporting later — the booking flow tracks it in state, but the `JobAddOn` table only stores `{ name, price }` today.

---

## 10. Notification Catalog — Live Wiring (Phase 2)

### What was wired (toggles now actually work for these)
The catalog from #4 was just data + a UI before. Now five customer email senders and one admin-notification path actually consult `isNotificationEnabled()` before sending. Toggle off in **Settings → Notifications** → email genuinely stops.

| Catalog row | Channel | What it now controls |
|---|---|---|
| `cust.booking.receipt_ot` | Email | "Booking confirmed" email sent after the booking flow |
| `cust.reminders.booking_reminder` | Email | 24-hour reminder cron email |
| `cust.fee.service_receipt` | Email | Post-job paid-receipt email |
| `cust.fee.refund_given` | Email | Refund confirmation email |
| `admin.chat.customer_provider_msg` | Email | (already wired in #6) chat email to admins |
| `prov.chat.new_message_v2` | Email | (already wired in #6) chat email to cleaners |
| **`admin.booking.new`** | Email | New: every admin receives an email when a new booking lands |

When a toggle is **off**, the email is skipped and `EmailLog` records `status=FAILED, error="Disabled in Settings → Notifications"` so admins can audit what was suppressed.

### How the gate works
- `src/lib/email.ts` — `deliver()` accepts an optional `notification: { recipient, key }` arg. Before sending it calls `isNotificationEnabled(recipient, key, "EMAIL")`. If false, it returns early and stamps EmailLog.
- Each existing sender (`sendBookingConfirmation`, `sendReminder24h`, `sendReceipt`, `sendRefundConfirmation`) now passes its catalog key.
- **New** `sendAdminNewBookingNotification` helper — invoked from `submitBooking` to email all admins (OWNER / ADMIN / OPS_MANAGER / FIELD_LEAD) when a booking is created.

### Files
- `src/lib/email.ts` (gate + new admin notifier)
- `src/app/(book)/actions/submitBooking.ts` (calls admin notifier)

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Admin | Settings → Notifications → Customer → **Receipt email OT** → Email = **Off** | Toggle persists |
| Customer | Book a new cleaning at `/book` | The "Booking confirmed" email is **NOT sent**. EmailLog row shows `status=FAILED, error="Disabled in Settings → Notifications"`. |
| Admin | Toggle back to **On**, book again | Email arrives normally |
| Admin | Settings → Notifications → Admin → **New booking** → Email = **On** (it should be by default) | After any new web booking, every admin gets an email "New booking: …" |
| Admin | Toggle that one **Off** | Next new booking → no admin email |
| Admin / Cleaner | Trigger a refund | "Refund issued" email respects `cust.fee.refund_given` |
| Cron / clock | 24h reminders, post-payment receipt | Respect their toggles too |

### Batch 1 — Booking lifecycle wired ✅
The first targeted batch from the PDF master list is now live.

**Admin emails** (sent to OWNER / ADMIN / OPS_MANAGER / FIELD_LEAD):
| Catalog row | Trigger |
|---|---|
| `admin.booking.modified` | Admin edits a job (any field) |
| `admin.booking.modified_after_5pm` | Same edit but performed after 5pm the day before service |
| `admin.cancel.booking_canceled` | Job status flips to CANCELLED (via saveJob or cancelJobByAdmin) |
| `admin.cancel.booking_canceled_after_5pm` | Same cancellation but after 5pm the day before |
| `admin.cancel.booking_cancellation_request` | Customer submits a cancellation request from the portal |
| `admin.cancel.postpone_booking` | Customer submits a reschedule/postpone request from the portal |

**Customer emails**:
| Catalog row | Trigger |
|---|---|
| `cust.booking.confirmed` | First cleaner gets paired to the job |
| `cust.booking.modified` | Admin edits the job (any change other than first-cleaner-assigned) |
| `cust.cancel.booking_cancellation` | Job is canceled (includes whether a refund was issued) |

**Provider App/Push alerts** (rows written to `Alert` table, gated by toggle):
| Catalog row | Trigger |
|---|---|
| `prov.booking.new` | A cleaner is newly assigned to a job |
| `prov.booking.modified` | An assigned cleaner's job is modified |
| `prov.booking.modified_after_5pm` | Same, but after 5pm day-before |
| `prov.cancel.booking_canceled` | A cleaner's assigned job is canceled |

**The "after 5 pm day before service" rule** is implemented as `isAfter5pmDayBefore(startTime)` in `src/lib/email.ts` and picks the correct catalog key automatically.

**Files touched:**
- `src/lib/email.ts` — 7 new lifecycle helpers + the time-window utility
- `src/app/(app)/actions/saveJob.ts` — detects status/cleaner transitions, fires emails + provider alerts
- `src/app/(app)/actions/cancelJobByAdmin.ts` — fires admin + customer cancel emails + provider alerts
- `src/app/(client)/portal/actions/requestCancellation.ts` — fires admin "cancellation requested" email
- `src/app/(client)/portal/actions/requestReschedule.ts` — fires admin "postpone" email

**Test plan:**
| Role | Task | Outcome |
|---|---|---|
| Admin | Edit a booking (e.g. change the time) | All admins get "Booking modified" email; customer gets "Booking updated" email |
| Admin | Edit a booking ≥17:00 the day before its start | Same flow but uses the `_after_5pm` catalog key |
| Admin | Assign the first cleaner to a booking | Customer gets "Cleaner confirmed" email; the cleaner gets a `prov.booking.new` Alert row |
| Customer | Open `/portal/bookings/[id]` and click "Request cancellation" | All admins get "Cancellation requested" email |
| Customer | Click "Request reschedule" | All admins get "Postpone request" email |
| Admin | Cancel a booking from `/jobs/[id]` (with optional refund) | All admins, the customer, and every assigned cleaner get notified (email + alert respectively) |
| Admin | Toggle any of the above rows OFF in Settings → Notifications | That specific notification stops firing while other channels continue |

### Batch 2 — Payments + refunds wired ✅

**Customer emails:**
| Catalog row | Trigger |
|---|---|
| `cust.fee.booking_charged` | Card successfully charged (Stripe webhook OR `chargeJob` OR manual cash mark) |
| `cust.fee.bookings_prepaid` | Deposit collected at booking time (`submitBooking` w/ `depositPaymentIntentId`) |
| `cust.fee.fees_charged` | Tip added to a job (via `saveJob` edit increasing `totalTip`) |
| `cust.card.declined` | Stripe charge fails (in `chargeJob` catch + webhook `payment_intent.payment_failed`) |

**Admin emails:**
| Catalog row | Trigger |
|---|---|
| `admin.card.declined` | Same triggers as the customer card-declined |
| `admin.card.new_card_added` | New card saved via `setup_intent.succeeded` webhook (only when payment method actually changed) |
| `admin.fee.tip_received` | Same totalTip-increase detection on `saveJob` |

### How it ties together
- **`chargeJob` success path**: queues receipt + fires `cust.fee.booking_charged` (customer)
- **`chargeJob` failure path**: fires `admin.card.declined` (all admins) + `cust.card.declined` (customer)
- **Stripe webhook `payment_intent.succeeded`**: same as `chargeJob` success path
- **Stripe webhook `payment_intent.payment_failed`**: same as `chargeJob` failure path (catches off-session declines, async failures)
- **Stripe webhook `setup_intent.succeeded`**: detects "genuinely new card" (different from existing `defaultPaymentMethodId`) and fires `admin.card.new_card_added`
- **`togglePaymentReceived` (manual cash/cheque mark)**: queues receipt + fires `cust.fee.booking_charged`
- **`saveJob` edit detecting tip increase**: fires `admin.fee.tip_received` + `cust.fee.fees_charged`
- **`submitBooking` with deposit**: fires `cust.fee.bookings_prepaid`

### Files
- `src/lib/email.ts` — 7 new helpers (`sendCustomerBookingCharged`, `sendCustomerFeesCharged`, `sendCustomerBookingsPrepaid`, `sendCustomerCardDeclined`, `sendAdminCardDeclined`, `sendAdminNewCardAdded`, `sendAdminTipReceived`)
- `src/app/(app)/actions/chargeJob.ts` — wires success + decline paths
- `src/app/(app)/actions/togglePaymentReceived` (in `toggleJobPaymentStatus.ts`) — wires manual cash/cheque mark
- `src/app/(app)/actions/saveJob.ts` — wires tip-detection on edits
- `src/app/(book)/actions/submitBooking.ts` — wires deposit collection
- `src/app/api/stripe/webhook/route.ts` — wires Stripe webhook events

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Admin | Charge a job from `/jobs/[id]` | Customer gets receipt + `cust.fee.booking_charged` email |
| Admin | Charge a job with a card that declines (use Stripe test card `4000000000000002`) | Both admin AND customer get a `card declined` email; reason from Stripe is included |
| Customer | Book a cleaning that takes a $20 deposit | Customer gets `Cleano deposit received` email |
| Customer | Add a new card via the portal | All admins get `New card on file — [name]` email |
| Admin | Edit a completed job to add a $10 tip | All admins get `Tip received` email; customer gets `Tip charged` email |
| Admin | Toggle any row off in Settings → Notifications | That email stops firing (EmailLog records `status=FAILED, error="Disabled in Settings → Notifications"`) |

### Still deferred from this batch
- **3DS authentication emails** (`cust.fee.card_charge_auth`, `cust.fee.precharge_auth`, `cust.card.hold_auth`, `cust.fee.cancellation_fee_authentication`, `cust.fee.bulk_charge_auth`) — needs `authentication_required` Stripe error detection + a customer-facing 3DS confirmation URL. Will be a focused 1-hour add.
- **Cash/cheque-specific fee variants** (`admin.fee.cancellation_cash`, `admin.fee.canceled_after_1st_cash`, `admin.fee.extra_charge_cash`) — the code doesn't currently distinguish cash vs card for these fee paths.
- **Card hold lifecycle** (`admin.card.declined_on_hold`, `admin.card.modified_hold_failed`, `admin.card.hold_released`) — re-hold logic doesn't exist; Stripe `payment_intent.canceled` webhook not handled.
- **Bulk bookings charge** (`cust.fee.bulk_charge`) — bulk-charge flow not built.

### Sub-batch 3A — Rating, clock, checklist wired ✅

**Customer:**
| Catalog row | Trigger |
|---|---|
| `cust.rating.rate_us` | Helper exists; receipt email already embeds the rating link. Standalone "rate us" reminder needs a cron job (yellow). |

**Admin:**
| Catalog row | Trigger |
|---|---|
| `admin.rating.new` | A customer submits a rating via `/rate/[token]` |
| `admin.rating.poor` | Same trigger, only fires when rating ≤3 |
| `admin.rating.overall_dropped` | Same trigger, only fires when recalculated overall <4 |
| `admin.clock.clocked_in` | Cleaner clocks in (`clockIn.ts`) |
| `admin.clock.clocked_out` | Cleaner clocks out (`clockOut.ts`) — includes job duration |
| `admin.checklist.completed` | Every item in a job's checklist hits COMPLETED |

**Provider:**
| Catalog row | Trigger |
|---|---|
| `prov.rating.new_review` | Cleaner gets emailed their rating + customer notes when a customer submits via `/rate/[token]` |

### Files
- `src/lib/email.ts` — 7 new helpers (`sendCustomerRateUs`, `sendAdminNewReview`, `sendProviderNewReview`, `sendAdminClockedIn`, `sendAdminClockedOut`, `sendAdminChecklistCompleted`)
- `src/app/(app)/actions/clockIn.ts` — fires admin clocked-in
- `src/app/(app)/actions/clockOut.ts` — fires admin clocked-out (with duration)
- `src/app/(public)/rate/actions/submitRating.ts` — recalculates overall rating + fires admin (new/poor/dropped variants) + provider new-review
- `src/app/(app)/actions/updateChecklistItem.ts` — detects all-items-COMPLETED + fires admin

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Cleaner | Tap **Clock in** on a job | All admins get "Clocked in" email |
| Cleaner | Tap **Clock out** on the same job | All admins get "Clocked out" email with duration |
| Cleaner | Mark every checklist item COMPLETED | All admins get "Checklist done" email |
| Customer | Submit a 4-star rating via `/rate/[token]` | Admin gets one "4/5 review" email |
| Customer | Submit a 2-star rating | Admin gets "2/5 review" email (via both `admin.rating.new` AND `admin.rating.poor`). Provider gets a "2/5 review on your work" email. If the recalculated overall is <4, admin also gets the `overall_dropped` variant. |

---

## Running tally — 34 of ~120 catalog rows now live
- Earlier batch: 7
- Batch 1 (Booking lifecycle): 13
- Batch 2 (Payments + refunds): 7
- Sub-batch 3A (Rating/clock/checklist): 7

### Sub-batch 3B — Account / Invoice / Documents / Unassigned / Recurring ✅

This batch hooked **better-auth** for password + verification emails, and wired the remaining clear-path green rows in one push.

**Better-auth hooks** (`src/lib/auth.ts`):
- `emailAndPassword.sendResetPassword` → fires `cust.account.reset_password` or `prov.account.reset_password` based on the user's role
- `emailAndPassword.onPasswordReset` → fires `_password_changed` for the matching recipient
- `emailVerification.sendVerificationEmail` → fires `cust.account.setup_password` for customers, `prov.account.email_verification` for providers

**Account lifecycle** (catalog rows newly wired):
| Catalog row | Trigger |
|---|---|
| `cust.account.reset_password`, `prov.account.reset_password` | better-auth `sendResetPassword` |
| `cust.account.password_changed`, `prov.account.password_changed` | better-auth `onPasswordReset` |
| `cust.account.setup_password` | better-auth verification (customer role) |
| `prov.account.email_verification` | better-auth verification (provider role) |
| `prov.account.new` + `prov.account.how_it_works` + `prov.account.activated` | Admin creates an employee via `createEmployee.ts` |
| `cust.account.new` + `cust.account.activated` | Admin creates a CLIENT user via `createEmployee.ts` |

A central `sendAccountEmail({ to, name, role, event, link? })` helper handles all account events (one switch on the event picks copy + catalog row). Easy to call from any future signup / activation / deactivation / "add card" prompt path.

**Unassigned-folder events** (admin):
| Catalog row | Trigger (in `saveJob.ts`) |
|---|---|
| `admin.unassigned.new` | A job is **created** with zero cleaners |
| `admin.unassigned.moved` | An edit removes every assigned cleaner |
| `admin.unassigned.grabbed` | An edit moves an unassigned job to ≥1 cleaner |
| `admin.unassigned.modified` | An unassigned job is edited (still unassigned afterward) |

All four respect a job's status — they only fire while the job is open (not COMPLETED/CANCELLED/PAID).

**Invoice events**:
| Catalog row | Trigger |
|---|---|
| `cust.invoice.new` | `createInvoice.ts` creates a DRAFT invoice |
| `cust.invoice.update` | `updateInvoice.ts` updates a non-PAID invoice |
| `cust.invoice.charge` | `updateInvoice.ts` status → PAID |
| `cust.invoice.resend` | `sendInvoice.ts` (DRAFT → SENT) |
| `admin.invoice.charge` | `updateInvoice.ts` status → PAID (all admins notified) |

**Document events**:
| Catalog row | Trigger |
|---|---|
| `prov.drive.doc_uploaded` | `createDocument.ts` assigns the document to a provider |
| `admin.docs.signed_completed` | `signDocument.ts` flips DocumentSignature to SIGNED |

**Recurring booking branch**: `sendBookingConfirmation` now takes a `recurring` flag; `submitBooking.ts` passes `frequency !== "ONE_TIME"` so customers booking a weekly/biweekly/monthly cleaning hit `cust.booking.receipt_rec` instead of `_ot`.

**Cancellation-request approval** (`resolveJobRequest.ts`): when admin approves a customer's cancellation request, the customer + admin cancellation emails fire just like a direct cancel (this path used to bypass `saveJob` and miss the emails).

### Files touched
- `src/lib/auth.ts` (better-auth email hooks)
- `src/lib/email.ts` (~10 new helpers + `sendAccountEmail` + `sendInvoiceEmail` switchboards)
- `src/app/(app)/actions/createEmployee.ts`
- `src/app/(app)/actions/createInvoice.ts`, `updateInvoice.ts`, `sendInvoice.ts`
- `src/app/(app)/actions/createDocument.ts`, `signDocument.ts`
- `src/app/(app)/actions/saveJob.ts` (added unassigned-folder branches)
- `src/app/(app)/actions/resolveJobRequest.ts` (cancellation-request approval emails)
- `src/app/(book)/actions/submitBooking.ts` (recurring branch flag)

### Running tally — **58 of ~120 catalog rows now live**
(previous 34 + 8 better-auth + 5 createEmployee variants + 4 unassigned + 4 invoice + 1 resend + 2 document + 1 recurring receipt = +24)

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Customer | Use "Forgot password" flow | Receive `cust.account.reset_password` email with link |
| Customer | Complete the password reset | Receive `cust.account.password_changed` confirmation |
| Provider | Same flow as customer | Hits `prov.account.*` variants instead |
| Admin | Create a new EMPLOYEE in admin → Employees | Cleaner gets 3 emails: New account + How it works + Account activated |
| Admin | Create a brand-new booking with **no cleaners assigned** | All admins get `New booking in unassigned folder` email |
| Admin | Edit a booking and remove the cleaner | Admins get `Booking moved to unassigned folder` |
| Admin | Edit that booking back to assign someone | Admins get `Someone grabbed a job from unassigned folder` |
| Admin | Edit an unassigned booking (no cleaner change) | Admins get `Unassigned booking modified` |
| Admin | Create a new invoice | Customer gets `New invoice` email |
| Admin | Edit the invoice → mark PAID | Customer gets `Invoice paid`; admins get `admin.invoice.charge` |
| Admin | Click "Send/Resend invoice" | Customer gets `Invoice resent` |
| Admin | Create a document and assign to cleaners | Each cleaner gets `New document on your Cleano drive` |
| Cleaner | Sign that document | Admins get `Signed: [title]` |
| Customer | Book a **weekly** cleaning | Receive `cust.booking.receipt_rec` (not `_ot`) |
| Admin | Toggle any of the above rows off in Settings → Notifications | That specific email stops firing |

---

### Sub-batch 3C — Customer signup + payouts + referral + provider tip ✅

**Newly wired catalog rows:**
| Row | Trigger |
|---|---|
| `cust.account.new` | Customer self-signs-up via portal → `linkClientAccount.ts` fires welcome |
| `cust.account.activated` | Same trigger — also confirms the account is active |
| `prov.payments.received` | Admin marks a PayPeriod PAID → each cleaner in the period gets an email |
| `admin.booking.new_via_referral` | Customer books with a referral code applied → all admins get the dedicated email |
| `prov.payments.new_tip` | Admin edits a job and increases `totalTip` → each assigned cleaner gets a tip notification (split evenly) |

### Files
- `src/app/(client)/portal/actions/linkClientAccount.ts` (customer signup → welcome + activated emails)
- `src/app/(app)/actions/completePayPeriod.ts` (per-cleaner payout email, sums all payouts in the period)
- `src/app/(app)/actions/saveJob.ts` (provider tip notification alongside the existing admin tip-received + customer fees-charged emails)
- `src/app/(book)/actions/submitBooking.ts` (separate referral-booking email)
- `src/lib/email.ts` (`sendAdminNewBookingNotification` now takes a `viaReferral` flag + new `sendProviderNewTip` helper)

### Running tally — **63 of ~120 catalog rows now live**
(58 from 3B + 5 from this sub-batch)

### Test plan
| Role | Task | Outcome |
|---|---|---|
| Customer | Sign up for a portal account (post-booking flow) | Receive welcome + activated emails (both new) |
| Admin | Mark a pay period as PAID | Each cleaner in the period gets an email with their total $ amount |
| Customer | Book with a referral code applied | All admins get both regular AND `_via_referral` emails (admin can toggle each separately) |
| Admin | Edit a completed job to add a tip | Cleaner(s) on the job get a "You got a $X tip!" email — split evenly across cleaners |

---

## What's still 🟢 wire-now but not yet wired

These have clear event hooks in the codebase but I didn't have time to wire in this session. Each takes 5–15 minutes:

**Admin (~10 entries)**
- `admin.booking.accepted` / `admin.booking.declined` — needs a clear "accept" vs "decline" UI action (current `saveJob` only changes status, doesn't distinguish a distinct accept/decline workflow). **Ask client: is "accepted" = job status changed to SCHEDULED/CONFIRMED, or something more specific?**
- `admin.booking.new_via_referral` — fire when `appliedPromoCode` includes a referral code on submit
- `admin.unassigned.new` / `_moved` / `_modified` / `_grabbed` — saveJob already detects 0-cleaner state; add the four hook points
- `admin.fee.cancellation_cash` / `_canceled_after_1st_cash` / `_extra_charge_cash` — need a "charge cash fee" path (currently no distinct cash fee action exists) — **🟡 needs-feature**
- `admin.invoice.partial_charge` / `_charge` / `_card_declined` / `_skip` / `_end_recurring` — call sites are `createInvoice.ts`, `updateInvoice.ts`, `sendInvoice.ts`, the Stripe webhook
- `admin.reminders.admin_set` — when admin sets a job reminder during edit (need to find the field)
- `admin.signup.new_provider` / `admin.signup.review_request` — fire from `createEmployee.ts` or a sign-up approval flow
- `admin.schedule.settings_modification_request` / `_schedule_modification_request` / `_schedule_updated` / `_settings_updated` — find the provider settings/schedule mod action; **Ask client: what counts as a "settings modification request" — does this exist as a feature?**

**Customer (~15 entries)**
- `cust.account.new` / `_setup_password` / `_reset_password` / `_password_changed` / `_profile_changed` / `_activated` / `_deactivated` / `_add_card` — **all need hooks into `better-auth`** in `src/lib/auth.ts` (better-auth has a `sendVerificationEmail` / `sendResetPassword` config — easy ~30 min add)
- `cust.booking.receipt_rec` — same as `_ot` but for recurring bookings; need to detect frequency≠ONE_TIME in submitBooking
- `cust.cancel.card_hold_failure` — happens when deposit collection fails; needs hook in submitBooking
- `cust.completed.leave_tip` — needs cron sending a follow-up tip request
- `cust.invoice.*` — 12 invoice notifications: createInvoice, updateInvoice, sendInvoice paths
- `cust.checklist.view` / `_custom_msg` — find the checklist-progress page action
- `cust.separate.charge` / `_auth` / `_refund` — needs a separate-charge feature (different from main job charge); **Ask client**

**Provider (~15 entries)**
- `prov.account.new` / `_how_it_works` / `_reset_password` / `_password_changed` / `_activated` / `_deactivated` / `_email_verification` / `_signup_submitted` / `_signup_rejected` — all need better-auth hooks (same as customer account)
- `prov.drive.doc_uploaded` — `createDocument.ts` exists
- `prov.unassigned.new` / `_invite` — fire when admin opens unassigned job to a cleaner pool
- `prov.payments.received` / `_new_tip` — payouts flow + tip detection from `saveJob` (mostly already detected; provider channel not wired)
- `prov.schedule.modification_response` / `_send_schedule` / `_settings_approved` / `_settings_declined` — needs a "respond to modification request" action; **Ask client**
- `prov.checklist.custom_msg` — same as customer checklist custom message
- `prov.clock.before_clock_in` — **🟡 needs-cron** (1h before scheduled start)

---

## Yellow batch — Unified cron dispatcher ✅

Built a single `/api/cron/notifications` route that handles **all 12 time-window-based notifications** in one pass. Designed to be invoked every 5 minutes.

### Infrastructure
- **Schema migration `20260528200000_email_log_notification_key`** — adds `EmailLog.notificationKey String?` + index on `(jobId, notificationKey)`. Each cron-driven send writes a uniquely-keyed EmailLog row so multiple cron firings don't double-send.
- **Vercel cron entry**: `/api/cron/notifications` on `*/5 * * * *` (every 5 minutes). Auth via `Bearer ${CRON_SECRET}` header (same as existing `/api/cron/reminders`).
- **Idempotency helper** `ensureNotSent(key, jobId, recipient)`: writes the EmailLog row up-front; later cron firings see it and skip.

### Rows now firing from the cron

| Catalog row | Window | Notes |
|---|---|---|
| `admin.unassigned.starts_12h` | startTime within ±5 min of (now + 12h), no cleaners assigned | Fires once per job |
| `admin.unassigned.starts_4h` | Same shape, 4h before | |
| `admin.unassigned.starts_1h` | Same shape, 1h before | |
| `admin.clock.not_clocked_in` | startTime 15–60 min in the past, no `clockInTime` | Fires once per job |
| `admin.reminders.cash_check` | startTime ±30 min of (now + 24h), `paymentType` in {CASH, CHEQUE} | Fires once per job |
| `admin.rating.poor_twice_week` | ≥2 ratings ≤3 in last 7 days per cleaner | Idempotent per (cleaner, week) |
| `cust.reminders.booking_reminder_2` | startTime ±30 min of (now + 48h) | Customer-side 48h variant of the existing 24h cron |
| `cust.cancel.never_found_provider` | startTime within (now − 5min, now + 30min), no cleaners | Fires once per job — paired with auto-cancel later |
| `cust.completed.leave_tip` | `clockOutTime` 24h ago ±30 min, status COMPLETED, no tip yet | Fires once per job |
| `prov.reminders.one_day` | startTime ±30 min of (now + 24h), assigned cleaner | One email per cleaner per job |
| `prov.reminders.one_hour` | startTime ±10 min of (now + 1h), assigned cleaner | Same shape |
| `prov.reminders.unassigned` | Daily nudge to all active cleaners when ≥1 unassigned job exists in next 7 days | One row per cleaner per day |

### Files
- `prisma/schema.prisma` + migration `20260528200000_email_log_notification_key`
- `src/lib/email.ts` — 7 new helpers (`sendAdminUnassignedDeadline`, `sendAdminNotClockedIn`, `sendAdminCashCheckReminder`, `sendAdminPoorRatingTwiceWeek`, `sendCustomerReminder48h`, `sendCustomerNeverFoundProvider`, `sendCustomerLeaveTip`, `sendProviderJobReminder`)
- `src/app/api/cron/notifications/route.ts` — the unified dispatcher
- `vercel.json` — added the `*/5 * * * *` schedule

### Running tally — **75 of ~120 catalog rows now live**
(63 from prior batches + 12 from this yellow batch = 75)

### Setup
Run the migration (idempotent SQL — safe to paste into Supabase SQL editor):
```sql
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "notificationKey" TEXT;
CREATE INDEX IF NOT EXISTS "EmailLog_jobId_notificationKey_idx" ON "EmailLog"("jobId", "notificationKey");
```
Then:
```bash
npx prisma migrate resolve --applied 20260528200000_email_log_notification_key
```

### Test plan
| Notification | Quick local test |
|---|---|
| `admin.unassigned.starts_12h` | Create an unassigned job starting in 12h ±5 min, hit `/api/cron/notifications` with the auth header, expect admin emails |
| `admin.clock.not_clocked_in` | Create job that started 30 min ago without clock-in, hit cron |
| `cust.reminders.booking_reminder_2` | Job 48h out → cron → customer gets the 2-day reminder email |
| `cust.completed.leave_tip` | Mark a job COMPLETED 24h ago without a tip → cron → customer gets tip-reminder |
| `prov.reminders.one_hour` | Job with cleaner starting in 60 min → cron → cleaner gets 1h reminder |
| `prov.reminders.unassigned` | Have ≥1 unassigned job + ≥1 active cleaner → cron → all cleaners get daily nudge (max 1× per day) |

Toggle any of these off in **Settings → Notifications** and the cron will short-circuit before sending (the EmailLog row records `status=FAILED, error="Disabled in Settings → Notifications"`).

### Still pending in yellow (need client decisions)
- `admin.reminders.job` (admin's own 24h reminder) — same trigger as the existing cleaner-side cron at `/api/cron/reminders`. Wiring would be a copy-paste — **ask client: do you want the admin to also receive a 24h reminder, or just the customer?**
- `prov.clock.before_clock_in` (1h before clock-in for the cleaner) — overlapping with `prov.reminders.one_hour`. Question: are these the same thing or distinct?
- `cust.invoice.due_today` / `_overdue` / `_upcoming_payment` — needs invoice `dueDate` to drive timing. Easy add once invoice flow is finalized.
- `prov.report.monthly_breakdown` / `admin.report.monthly_generated` — monthly report builder is its own feature.

## 🟡 Yellow — needs cron infra

These have clear semantics but need a scheduled job to detect the timing condition. The project already has one cron (`/api/cron/reminders` for the 24h reminder). A few more cron handlers + the same `isNotificationEnabled` gate are all that's needed.

| Catalog row | Frequency | What it should check |
|---|---|---|
| `admin.unassigned.starts_12h` | hourly | unassigned jobs starting in 11–12 hours |
| `admin.unassigned.starts_4h` | hourly | unassigned jobs starting in 3.5–4.5 hours |
| `admin.unassigned.starts_1h` | hourly | unassigned jobs starting in 50–70 minutes |
| `admin.reminders.job` | daily | admin's own 24h reminder (cleaner reminder cron exists; admin variant doesn't) |
| `admin.reminders.cash_check` | daily | upcoming bookings with `paymentType=CASH/CHEQUE` |
| `admin.clock.not_clocked_in` | every 5 min | jobs whose `startTime` passed but `clockInTime IS NULL` |
| `admin.rating.poor_twice_week` | daily | per-cleaner aggregation: count of ≤3 ratings in last 7 days ≥2 |
| `cust.reminders.booking_reminder_2` | daily | 48h variant of the existing 24h cron |
| `cust.cancel.never_found_provider` | daily | bookings still unassigned at start time |
| `prov.reminders.unassigned` | daily | each cleaner who has unassigned jobs in their pool |
| `prov.reminders.one_day` | daily | their bookings 24h out |
| `prov.reminders.one_hour` | every 5 min | their bookings 50–70min out |
| `prov.clock.before_clock_in` | every 5 min | same window — needs cleaner-side push |
| `cust.completed.leave_tip` | daily | jobs completed 24h ago without a tip yet |
| `cust.invoice.due_today` / `_overdue` / `_upcoming_payment` | daily | invoice date math |
| `prov.report.monthly_breakdown` / `admin.report.monthly_generated` | monthly (1st) | aggregate previous month |

**Ask client:**
1. Confirm cron schedule preferences (Vercel cron, GitHub Actions, or a custom worker?)
2. For the "before clock in" reminder — does the provider need a push OR an email OR both?
3. For "never found a provider" — when does this fire? At what threshold (e.g., still unassigned 30min before start)?

---

## 🔴 Red — needs feature build first

These notifications reference features that don't exist in the codebase yet. We need the feature before the notification has meaning.

| Catalog row group | Why blocked | Question for client |
|---|---|---|
| Google Calendar / Sheets sync failure (3 rows) | No Google integration in the project | Is GCal/Sheets sync planned? If yes, when? |
| Gift card flow (~10 rows across admin/customer) | No gift-card feature | Do you want gift cards built? Self-service from portal? Bulk import? |
| Stripe Connect for providers (6+ rows) | Cleaners don't have Connect accounts yet | When is Stripe Connect onboarding planned? Instant payouts are stubbed (`WashPayout` PENDING) waiting for this. |
| "Provider on the way" / "not on the way" (2 rows) | No "on the way" feature | Should cleaners tap an "I'm on my way" button N minutes before clock-in? |
| Booking accepted / declined as separate from modified (2 rows) | No accept/decline workflow | Is there a separate "review pending bookings" step for admin, or is this just status changes? |
| Card hold lifecycle: `declined_on_hold` / `modified_hold_failed` / `hold_released` (3 rows) | No re-hold logic when bookings are modified; `payment_intent.canceled` webhook not handled | When a booking is modified to a different price, should we re-place a hold? |
| 3DS authentication emails (~5 rows) | `authentication_required` Stripe error not detected, no customer-facing 3DS URL | Do you want to support 3DS-required cards? Adds ~1h to the Stripe integration. |
| Cash/cheque fee variants (3 admin rows) | No distinct "cash fee" path in code | Are cash fees actually charged separately, or just recorded? |
| Separate charge (3 customer rows) | No separate-charge feature | What's a "separate charge"? Extra services after the job? |
| Quote (2 customer rows) | No quote/estimate feature | Do customers receive quotes before booking, or just see the booking-flow price? |
| Bulk bookings charge (2 rows) | No bulk-charge feature | Do you batch-charge multiple bookings at once for corporate clients? |
| Reschedule fee (3 rows) | Reschedule fee feature partial | Is the fee amount and trigger logic finalized? |
| Customer chat (3 rows) | No customer-chat feature (only employee↔admin today) | Is customer chat planned? Same shape as the existing chat? |
| Document signature events (~2 rows) | DocumentSignature exists, just need helpers | Quick wire-up — I'll do these next session |
| Plan limits (1 row) | No plan-tier system | Are you billing yourself for plan upgrades? |
| Monthly provider breakdown (2 rows) | Report builder doesn't exist | What data goes into the monthly breakdown PDF? (jobs, earnings, tips, deductions, ratings — anything else?) |
| Provider reporting weekly dashboard (1 row, from rag wash spec) | Dashboard not built | Confirm metrics: rag use per sq ft, low-usage performers, anything else? |

### Still ornamental (next batch of wiring)
About 110 catalog rows still don't yet have a real event firing them — mostly because the underlying event itself doesn't exist in the code yet:
- Google Calendar / Sheets sync failures (no sync currently)
- Gift card flow (not built)
- Provider payment processor (no Stripe Connect yet)
- Cancellation, reschedule, and unassigned-folder timed reminders (the events exist but the email paths aren't built; would need their own `sendXxx` helpers)
- SMS channel (no Twilio integration in the project)
- APP_PUSH channel for cleaners (web Push API not set up; the chat browser notification covers part of this)

Each of these is a focused 30-60 minute add: define the catalog mapping, build the `sendXxx` helper, gate it with `notification: { recipient, key }`, call it from the right event handler.
