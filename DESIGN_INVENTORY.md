# Fixaro — Design Inventory

A complete catalog of every design element in the app, so each can be redesigned deliberately. Two layers:

- **Admin / staff app** → styled in [`src/app/globals.css`](src/app/globals.css) + React components in [`src/components/ui/`](src/components/ui/)
- **Customer / booking / portal** → scoped under `.cl-customer` in [`src/app/customer.css`](src/app/customer.css)

---

## 1. Design tokens

### Brand palette (`:root`, globals.css ~L567)
| Token | Value | Use |
|-------|-------|-----|
| `--primary` | `#1c1917` (charcoal) | primary text / dark surfaces |
| `--primary-deep` | `#0f0e0d` | sidebar background, deepest |
| `--accent` | `#e85d04` (orange) | primary accent / active state / CTAs |
| `--accent-hover` | `#c44c03` | accent hover |
| `--accent-light` | `#f48c06` | lighter accent, gradients |
| `--cream` | `#f5f2ec` | app page background |
| `--cream-deep` | `#ede9e1` | alt surface |
| `--ink` | `#1c1917` / `--ink-soft` `rgba(28,25,23,.65)` | headings / muted |
| gold | `#cba35a` | Admin badge, premium accents |

### Charcoal opacity ramp (for borders, muted text, fills)
`--primary-5` `.04` · `--primary-10` `.08` · `--primary-15` `.12` · `--primary-20` `.16` · `--primary-30` `.25` · `--primary-40` `.35` · `--primary-50` `.45` · `--primary-60` `.55` · `--primary-70` `.65` · `--primary-light` `#3a3530` · `--primary-hover` `#0f0e0d`

### Semantic / status colors
`--emerald-600/100/800` (success/paid) · `--amber-50/200/600/700/800` (warning) · `--blue-100/800` (scheduled) · `--error` `#dc2626`

### Shadows
`--shadow-soft` = `0 2px 16px rgba(28,25,23,.08), 0 0 0 1px rgba(28,25,23,.06)`

### Fonts
- `--font-dm-sans` (DM Sans) — primary sans / body
- `--font-serif` = Instrument Serif — display headings (`.display`, loader label)
- `--font-instrument-serif`, plus loaded: Gontserrat, TT Fors, Manrope, Inter, Poppins, Hikasami, Primeform, Paperlogy, Diagraph (most unused — candidates to prune)

> ⚠️ There are **3 `--color-primary` definitions** in globals.css (L317 `#e85d04`, L557 `#CDE2FF`, plus the ramp). Worth consolidating during redesign.

---

## 2. Typography utilities
| Class | Spec |
|-------|------|
| `.display` | Instrument Serif, weight 300, `clamp(34px,4.2vw,48px)`, tight tracking — page hero titles. `.display em` → orange italic |
| `.title-sm` | 20px / 500 — section titles |
| `.subtitle` | 15px, `--primary-70` — supporting copy |
| `.eyebrow` | 11px uppercase, tracking .12em, orange — kicker label |
| `.label` | 10px / 700 uppercase, `--primary-60` — field labels |
| `.app-title` | 1rem / 350 charcoal | `.app-title-small` 12px | `.app-subtitle` .56rem charcoal/70 |
| `.h2-subheader` / `.h2-subsubtitle` | sm/xs charcoal/80 |
| Layout stacks | `.stack-4 / 6 / 8 / 12 / 16 / 20 / 24 / 32` (vertical flex gap) · `.row` `.row-between` · `.grid-2` `.grid-3` |

---

## 3. React UI components (`src/components/ui/`)

| Component | Variants / sizes | Notes |
|-----------|------------------|-------|
| **Button** | `default · light · selected · primary · secondary · ghost · outline · destructive · recorder · cleano · simple · tdo · dentitek · none · pro` — sizes `sm/md/lg` | lots of legacy variants to trim |
| **Badge** | `default · secondary · success · warning · error · tdo · cleano · destructive · dentitek · pro` — sizes `xs/sm/md` | status pills |
| **Card** | `default · white · minimal · elevated · recorder · cleano_light(+ _bordered/_bordered_high/_lighter) · cleano_dark(+ _lighter) · error · ghost · warning · alert` | many `cleano_*` variants |
| **Input** | `default · minimal · badge · ghost · outline · search · compact · large · form` — sizes `sm/md/lg`, optional left icon, `border` flag | |
| **Select** | `default · minimal · ghost · outline` — `sm/md/lg` | native-style |
| **Textarea** | `default · minimal · ghost · outline · form` — `sm/md/lg` | |
| **Checkbox** | `default · minimal` | |
| **IconButton** | `ghost · outline` — `xs/sm/md/lg` | |
| **Modal** | title/children/footer | base overlay dialog |
| **NotificationModal** | confirm/alert dialog | |
| **Toast** + `useToast()` | success/error/info | transient notifications |
| **Dropdown** | trigger + menu | basic menu |
| **CustomDropdown** | `default · ghost` — `sm/md/lg` | styled select |
| **PremiumSelect** | `sm/md/lg` | richer select w/ search |
| **SearchableDropdown** | typeahead | |
| **SearchableTemplateSelector** | template picker | |
| **InitialsDropdown** | avatar-trigger menu | |
| **DatePicker** | `sm/md/lg` | calendar popover |
| **TimePicker** | `sm/md/lg` | |
| **ColorPicker** | swatch grid | |
| **Chart** | `CLineChart · CBarChart · CAreaChart · CPieChart` + `CLEANO_COLORS` palette | recharts wrappers |
| **RingChart** | size prop | circular progress |
| **FixaroLoader** ⭐ | `fill` variants `fill/ripple`, `fullscreen/fill/onDark`, size/label/messages | branded drop loader (`fxl-*` CSS) |

---

## 4. Atomic "small things"

### Avatars
| Element | Spec |
|---------|------|
| `.avatar` | 28×28, circle, 10.5px/700 white text, 2px white border |
| `.avatar-lg` | 44×44, 14px, no border |
| `.avstack` | overlapping avatar stack |
| `.asidebar-avatar` | 36×36 circle, **orange gradient** `135deg #f48c06→#e85d04`, white initials (sidebar footer) |
| `.cl-snav-avatar`, `.cl-mobile-avatar`, `.chat-avatar-wrap`, `.cl-psidebar-avatar`, `.cl-portal-topbar-avatar` | contextual avatars |
| **Color palette** (hashed from name) | `#e85d04 · #0284c7 · #7c3aed · #dc2626 · #d97706 · #059669 · #0891b2 · #be185d` (see `AVATAR_COLORS` + `avatarColor()`/`initials()` helpers, e.g. ClientDetailView) |

### Pills / badges / chips
| Element | Spec |
|---------|------|
| `.pill` + `.pill-dot` | inline-flex, 3×9px, 11px/600, radius 999px, 5px dot |
| `.cl-pill` | admin pill variant |
| `.logo-badge` | sidebar "Admin" tag — gold `rgba(203,163,90,.18)` / `#cba35a` |
| `.anav-count` / `.anav-count.alert` | sidebar nav badge — white-tint / **red `#ef4444`** alert |
| `.atab-count` | tab counter — `--primary-10` bg / `--primary-70` |
| `.chat-role-pill`, `.chat-row-badge` | chat role/unread |
| `.cl-jd-addon-chip`, `.cl-jd-track-pill`, `.cl-jobs2-datepill`, `.cl-rag-count-pill`, `.pju-pill` / `.pju-disp-pill` | feature chips |
| **Customer status badges** (`customer.css`) | `.cl-badge-scheduling` (slate) · `.cl-badge-scheduled` (blue) · `.cl-badge-inprogress` (amber) · `.cl-badge-completed` (emerald) · `.cl-badge-paid` (emerald-200) · `.cl-badge-cancelled` (gray) |

### Dots & status
`.dot` · `.live-dot` · `.pill-dot` · `.tline-dot` · `.chat-status-dot` · `.status-completed / .status-pending / .status-failed`

### Buttons (CSS class layer, separate from `<Button>`)
`.btn` `.btn-primary` `.btn-secondary` `.btn-ghost` `.btn-danger-ghost` `.btn-sm` `.btn-lg` `.btn-block` · `.icon-btn` · `.link` `.link-muted`

### Inputs (CSS layer)
`.input` · `.field` · `.aselect` · `.tswitch` (toggle switch) · `.pay-toggle`

---

## 5. Admin app CSS component classes (by area)

**Page chrome:** `.admin-font` `.admin-page-title` `.admin-eyebrow` `.cl-page-wrap` `.cl-page-head` `.cl-page-title(-icon)` `.cl-page-sub` `.cl-back-link` · `.admin-lightbox(-close)`

**Sidebar (admin):** `.asidebar-rail` `.asidebar-logo` (`.logo-mark` `.logo-word` `.logo-badge`) `.asidebar-section(-label)` `.anav-item`(`.active`) `.anav-count` `.asidebar-user(-meta)` `.asidebar-avatar` `.asidebar-signout`

**Tables / toolbars / filters / pagination:** `.atable` `.atable-wrap` `.atable-scroll` · `.atoolbar` `.atoolbar-search(-icon)` · `.atabs` `.atab` `.atab-count` · `.afilter-toggle` `.afilter-badge` `.afilter-panel(-actions)` · `.apager` `.apager-btn` `.apager-controls` · `.aselect` · `.sortable`

**Stat cards:** `.astat` `.astat-grid` `.astat-head` `.astat-icon` `.astat-value` `.astat-delta`

**Generic cards / banners / tabs:** `.dcard(-head)` `.jcard*` `.jdetail*` `.cl-section-card(-head)` · `.banner` `.banner-amber` · `.dtabs` `.dtab` `.tab-panel(-wide/-full)` · `.timeline` `.tline-item/-dot/-actor/-text/-ts`

**Modals / toasts:** `.cl-modal*` (`-overlay -head -title -close -section -foot -confirm -cancel -banner -method(s) -amount -balance*`) · `.cl-chat-toast*` · `.co-*` (compact order/refill sheet)

**Chat:** `.chat-shell` `.chat-list*` `.chat-thread*` `.chat-msg(-bubble/-author/-time)` `.chat-row*` `.chat-composer*` `.chat-role-pill` `.chat-status-dot` `.chat-avatar-wrap` `.chat-day-divider` `.chat-job-strip`

**Calendar:** `.cl-cal-shell` `.cl-cal-bar/-nav/-title/-today/-views` `.cl-cal-grid/-cell/-event` `.cl-cal-time-*` (day/week time grid) `.cl-cal-week-row` `.cl-cal-mode-toggle` · `.cl-agenda*` (list view) — plus React calendar in `src/components/calendar/` (`MonthView`, `WeekView`, `DayView`, `ListView`, `EventCard`, `event-styles.ts`)

**Dashboard (cleaner):** `.cl-dash-shell/-hero*/-greet/-stats/-today*/-perf*/-earn*/-quick*/-reminder/-alert/-activity-row/-upcoming-row/-countdown/-empty-hero`

**Jobs:** `.cl-job-card*` (`-top -head -id -client -date -meta -pay* -cta -warn -bottom`) · `.cl-jobs2-*` (alt list: `-card -client -datepill -pay -meta* -cta -toolbar -search -side`) · `.cl-jd-*` (job detail: hero, card, dl rows, addons, checklist, photos, payout banner, clock, track, team, time tiles, cancel)

**Inventory:** `.cl-inv-*` (hero, stats, tabs, list, row, meter bar/fill/thresh, replenish, section) · `.pju-*` (product/kit cards & pills) · `.cl-rag-*` / `.cl-rw-*` (rag wash: stats, table, jobs, payout list, meter)

**Clock / time tracking:** `.clk-*` (stage, face, hand, ticks, readout, num, pivot, status, sessions, meta tiles, job pill)

**Pay / finance:** `.cl-pay-*` (hero, tabs, tiles, withdraw) · `.cl-income-*` · `.cl-txn-*` (transaction rows) · `.finrow` `.profit-pct` `.cl-money-pos` `.pay-icon(s)`

**Settings / docs / training:** `.cl-settings-shell/-side/-tabs` · `.cl-doc-*` · `.cl-module*` `.cl-quiz*` `.cl-progress-*` `.cl-video-*` `.cl-mark-watched`

**Forms (CSS layer):** `.cl-form-row/-label/-input/-hint/-actions/-save` · `.cl-checkbox`

**Misc / motion:** `.fade-up` `.fade-up-2` `.equalizer-bar` `.date-hero` `.photo-grid/-cell` `.team-list/-row` `.cl-install-prompt` `.cl-drawer-backdrop/-close` `.cl-mobile-topbar`

**Loader (`fxl-*`):** `.fxl-loader` `.fxl-fullscreen` `.fxl-fill` `.fxl-drop(-wrap/-bg/-edge)` `.fxl-water` `.fxl-wave` `.fxl-gloss` `.fxl-label(-text)` `.fxl-ripple(-ring)` — keyframes `fxl-bob/fill/wave-x/pulse/ripple`, `on-dark` modifier, reduced-motion fallback

---

## 6. Customer / booking / portal (`customer.css`, scoped `.cl-customer`)

> Own token set (`--primary`, `--accent`, gold, slate/blue/amber/emerald/gray ramps). Redesign this **separately** from the admin app.

**Shell / nav:** `.cl-portal` `.cl-psidebar(-logo/-avatar/-user(-meta)/-signout)` `.cl-pnav` `.cl-pmain(-inner)` `.cl-portal-topbar(-avatar)` `.cl-portal-backdrop` `.cl-portal-drawer-close`

**Booking flow:** `.cl-book-shell/-aside(-logo)/-header/-body/-main` · `.cl-stepper(-btn/-controls/-label/-value)` · `.cl-vstep(s)(-dot/-label/-hint/-meta)` · `.cl-choice(-large/-hint)` · `.cl-summary(-row/-total*)` · `.cl-result-card` · `.cl-addon-row(-name/-price)`

**Auth split screen:** `.cl-split(-brand*/-form*)` (brand panel + form panel, quote, sub, foot)

**Primitives:** `.cl-btn(-primary/-secondary/-ghost/-amber/-danger-ghost/-sm/-lg/-block)` · `.cl-input(-wrap)` `.cl-select` `.cl-textarea` `.cl-field` `.cl-label` `.cl-check(-row)` · `.cl-badge*` (status, §4) · `.cl-banner(-amber/-error/-success)` · `.cl-card-soft` `.cl-tile(-head/-pad-sm/-pad-lg)` `.cl-stat-tile(-icon/-label/-value/-hint)` · `.cl-bcard*` (booking card) · `.cl-date-badge(-day/-mon)` · `.cl-dp*` (date picker) · `.cl-modal*` · `.cl-star-btn/-row` (ratings) · `.cl-spinner` · `.cl-display/-title(-md)/-subtitle/-eyebrow/-divider(-or)` · stacks `.cl-stack-4…32`, `.cl-grid-2/3`, `.cl-row(-between)`

---

## 7. Suggested redesign order
1. **Tokens first** (§1) — colors/fonts/shadows cascade everywhere. Consolidate the duplicate `--color-primary` defs and prune unused fonts.
2. **Atoms** (§4) — avatars, pills/badges, dots, buttons, inputs.
3. **React UI components** (§3) — trim legacy variants (`tdo/dentitek/recorder/cleano_*`) to a clean set.
4. **Feature areas** (§5) — sidebar, tables, cards, dashboard, jobs, calendar, chat.
5. **Customer layer** (§6) — separate pass, its own tokens.

*Generated from the current codebase — classes/components verified present in globals.css, customer.css, and src/components/ui/.*
