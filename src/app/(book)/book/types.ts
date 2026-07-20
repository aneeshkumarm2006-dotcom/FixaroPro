import { computeHourlyPrice as computeHourlyPriceShared } from "@/lib/config/types";

export type Frequency =
  | "ONE_TIME"
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "QUARTERLY";

export type RoomType =
  | "KITCHEN"
  | "BATHROOM"
  | "BEDROOM"
  | "LIVING_ROOM"
  | "LAUNDRY"
  | "OUTDOOR"
  | "WHOLE_HOME";

export type ServicePricingType = "hourly" | "fixed" | "quote";

export interface ServiceItem {
  value: string;
  label: string;
  category: string;
  pricing: ServicePricingType;
  priceNote?: string;
}

export interface AddOnSelection {
  id?: string;
  name: string;
  price: number;
  roomType?: RoomType;
  selected: boolean;
}

export interface BookingDraft {
  // Step 1
  postalCode: string;
  postalCovered: boolean | null;
  zoneName: string | null;
  travelFee: number;
  // Step 2
  address: string;
  serviceType: string;
  hours: number;
  frequency: Frequency;
  addOns: AddOnSelection[];
  // All-or-nothing materials/equipment decision (SOP §4). Default false:
  // customer must actively confirm they want Fixaro to provide everything.
  customerRequestsMaterials: boolean;
  // Painting scope (SOP §7) — drives the immediate quote range. Empty unless
  // the selected service is PAINTING.
  paintingScope: string;
  // Service-specific intake (SOP v4.2 §4). Only set for their own service type.
  // Small paint repair — the client always supplies the paint, so we never ask
  // for paint colour or any procurement detail.
  paintRepairArea: string;
  paintRepairSurface: string;
  // AC installation — client supplies the unit/accessories unless admin-approved.
  acType: string;
  acLocation: string;
  acMountType: string;
  clientHasAcUnit: boolean | null;
  // TV mounting (SOP v4.2 §4) — screen size band + wall/surface type. These two
  // fields are what makes the "60\"+ or brick/concrete → custom quote" rule
  // detectable at all; without them the priceNote was purely advisory.
  tvSize: string;
  tvWallType: string;
  // Step 3
  date: string;
  isFlexible: boolean;
  timeSlot: string;
  // Step 4
  name: string;
  phone: string;
  email: string;
  notes: string;
  // Intake photos (SOP v4.2 §4) — Cloudinary secure URLs. Persisted as INTAKE
  // JobPhoto rows on the created job. Especially relevant for Small paint repair
  // and AC installation.
  photoUrls: string[];
  referralCode: string;
  // After-photo consent (opt-in checkbox, unchecked by default).
  afterPhotoConsent: boolean;
  promoCode?: string;
  promoDiscount?: number;
  promoApplied?: boolean;
  // Step 5 — Stripe
  stripeCustomerId?: string;
  stripeCardReady?: boolean;
}

export const EMPTY_DRAFT: BookingDraft = {
  postalCode: "",
  postalCovered: null,
  zoneName: null,
  travelFee: 0,
  address: "",
  serviceType: "",
  hours: 2,
  frequency: "ONE_TIME",
  addOns: [],
  customerRequestsMaterials: false,
  paintingScope: "",
  paintRepairArea: "",
  paintRepairSurface: "",
  acType: "",
  acLocation: "",
  acMountType: "",
  clientHasAcUnit: null,
  tvSize: "",
  tvWallType: "",
  date: "",
  isFlexible: true,
  timeSlot: "",
  name: "",
  phone: "",
  email: "",
  notes: "",
  photoUrls: [],
  referralCode: "",
  afterPhotoConsent: false,
};

// ── Service catalog ────────────────────────────────────────────────────────
//
// SEED DEFAULTS ONLY (SOP §3, stage 8). The live catalog is the
// ServiceCatalogItem table: these rows seed it, and are the fallback while it is
// empty. Feature code must resolve services through getRuntimeConfig() (server)
// or useRuntimeConfig() (client) — see src/lib/config/ — never by importing
// SERVICE_CATALOG or MATERIALS_PRICING directly, or an admin's edit will not be
// honoured. Adding a service HERE moves the default; adding one in the admin
// Service Catalog editor moves a running environment.

export const SERVICE_CATEGORIES = [
  "Repairs",
  "Installation & Assembly",
  "Home Improvement",
  "Outdoor & Seasonal",
] as const;

export const SERVICE_CATALOG: ServiceItem[] = [
  // Repairs
  { value: "DRYWALL_REPAIR", label: "Drywall repair", category: "Repairs", pricing: "hourly" },
  { value: "DOOR_REPAIR", label: "Door repair", category: "Repairs", pricing: "hourly" },
  { value: "CABINET_REPAIR", label: "Cabinet repair", category: "Repairs", pricing: "hourly" },
  { value: "FAUCET_REPAIR", label: "Faucet repair", category: "Repairs", pricing: "hourly" },
  { value: "TOILET_REPAIR", label: "Toilet repair", category: "Repairs", pricing: "hourly" },
  { value: "CAULKING_TOUCHUPS", label: "Caulking touch-ups", category: "Repairs", pricing: "hourly" },
  { value: "WEATHERSTRIPPING", label: "Weatherstripping", category: "Repairs", pricing: "hourly" },
  { value: "LOCK_REPLACEMENT", label: "Lock replacement", category: "Repairs", pricing: "hourly" },
  // SOP v4.2 §4/§5: small paint repair — $79/hr labour, client provides paint,
  // optional $49 materials/equipment when Fixaro-provided is requested.
  { value: "SMALL_PAINT_REPAIR", label: "Small paint repair", category: "Repairs", pricing: "hourly", priceNote: "$79/hr — you provide the paint" },

  // Installation & Assembly
  // Hourly by default, but the TV_QUOTE_* rule below diverts oversized screens
  // and masonry walls to the quote path before any card is captured.
  { value: "TV_MOUNTING", label: "TV mounting", category: "Installation & Assembly", pricing: "hourly", priceNote: "Large TVs (60\"+) or brick/concrete walls: custom quote" },
  { value: "CURTAIN_ROD", label: "Curtain rod installation", category: "Installation & Assembly", pricing: "hourly" },
  { value: "SHELF_INSTALLATION", label: "Shelf installation", category: "Installation & Assembly", pricing: "hourly" },
  { value: "FURNITURE_ASSEMBLY", label: "Furniture assembly", category: "Installation & Assembly", pricing: "hourly" },
  { value: "LIGHT_FIXTURE", label: "Light fixture installation", category: "Installation & Assembly", pricing: "hourly" },
  { value: "FAUCET_INSTALLATION", label: "Faucet installation", category: "Installation & Assembly", pricing: "hourly" },
  { value: "VANITY_INSTALLATION", label: "Vanity installation", category: "Installation & Assembly", pricing: "hourly" },
  { value: "MIRROR_HANGING", label: "Mirror hanging", category: "Installation & Assembly", pricing: "hourly" },
  { value: "BLINDS_INSTALLATION", label: "Blinds installation", category: "Installation & Assembly", pricing: "hourly" },
  { value: "PICTURE_HANGING", label: "Picture hanging", category: "Installation & Assembly", pricing: "hourly" },
  { value: "LOCK_INSTALLATION", label: "Lock installation", category: "Installation & Assembly", pricing: "hourly" },
  { value: "APPLIANCE_HOOKUP", label: "Appliance hookup", category: "Installation & Assembly", pricing: "hourly" },
  // SOP v4.2 §4/§5: AC installation — $79/hr labour, NO automatic materials
  // charge. Any parts/brackets/accessories are client-provided or an admin-
  // approved extra.
  { value: "AC_INSTALLATION", label: "AC installation", category: "Installation & Assembly", pricing: "hourly", priceNote: "$79/hr labour" },

  // Home Improvement
  { value: "PAINTING", label: "Painting", category: "Home Improvement", pricing: "quote", priceNote: "Custom quote" },
  { value: "MOULDINGS", label: "Installation of mouldings", category: "Home Improvement", pricing: "quote", priceNote: "Custom quote" },
  { value: "DOOR_HARDWARE", label: "Door hardware", category: "Home Improvement", pricing: "hourly" },
  { value: "CABINET_HARDWARE", label: "Cabinet hardware replacement", category: "Home Improvement", pricing: "hourly" },
  { value: "WALL_PANELING", label: "Wall paneling", category: "Home Improvement", pricing: "hourly" },
  { value: "SMALL_CARPENTRY", label: "Small carpentry", category: "Home Improvement", pricing: "hourly" },
  // D0.1: the $209/room fixed labour price and the $69 materials cost BOTH
  // apply, so "— silicone included" was a contradiction that would have
  // double-charged whenever the customer checked the Fixaro-materials box (SOP
  // §5 lists a $69 materials charge for this service). When the box is
  // unchecked, the customer supplies the silicone.
  { value: "SILICONE_SEALING", label: "Silicone Sealing", category: "Home Improvement", pricing: "fixed", priceNote: "$209 per room" },
  { value: "ACCENT_WALL", label: "Accent wall projects", category: "Home Improvement", pricing: "hourly" },
  { value: "GROUT_CLEANING", label: "Bathroom grout cleaning", category: "Home Improvement", pricing: "hourly" },
  { value: "CARPET_UPHOLSTERY", label: "Carpet & Upholstery Cleaning", category: "Home Improvement", pricing: "hourly" },
  { value: "SMALL_RENOVATION", label: "Small renovation tasks", category: "Home Improvement", pricing: "hourly" },

  // Outdoor & Seasonal
  { value: "FENCE_REPAIR", label: "Fence repair", category: "Outdoor & Seasonal", pricing: "hourly" },
  { value: "GATE_REPAIR", label: "Gate repair", category: "Outdoor & Seasonal", pricing: "hourly" },
  { value: "DECK_REPAIRS", label: "Deck repairs", category: "Outdoor & Seasonal", pricing: "hourly" },
  { value: "EXTERIOR_CAULKING", label: "Exterior caulking", category: "Outdoor & Seasonal", pricing: "hourly" },
  { value: "SEASONAL_SETUP", label: "Seasonal setup", category: "Outdoor & Seasonal", pricing: "hourly" },
  // Gap 2 (SOP: "Request a Quote until price approved"). Scope varies far too
  // much to charge a card up front, so weatherproofing is quote-routed. The
  // $59–$90 band stays as the internal baseline (WEATHERPROOFING_FIXED_PRICE)
  // that ops quote against — it is no longer an instant-checkout price.
  { value: "WEATHERPROOFING", label: "Weatherproofing", category: "Outdoor & Seasonal", pricing: "quote", priceNote: "Request a quote — typically $59–$90" },
  { value: "OUTDOOR_FURNITURE", label: "Outdoor furniture assembly", category: "Outdoor & Seasonal", pricing: "hourly" },
  { value: "GUTTER_CLEANING", label: "Gutter cleaning", category: "Outdoor & Seasonal", pricing: "hourly" },
  { value: "DRYER_VENT", label: "Dryer vent cleaning", category: "Outdoor & Seasonal", pricing: "hourly" },
  { value: "MINOR_EXTERIOR", label: "Minor exterior fixes", category: "Outdoor & Seasonal", pricing: "hourly" },
];

// ── Materials / equipment pricing (SOP §5) ─────────────────────────────────
// Amounts apply ONLY when the customer checks the all-or-nothing
// "Fixaro provides all materials and equipment" checkbox. CAD.
//
//   "deposit" → refundable deposit. Captured upfront at booking. Refundable
//               before the job, or applied to the final bill; admins may apply /
//               refund / partially refund the unused balance. Flags the booking
//               with the "D" deposit-review indicator (SOP §9).
//
//   "charge"  → FLAT materials/equipment line item. Captured upfront, but it is
//               NOT a deposit: no unused-balance tracking, no partial refunds,
//               no "D" indicator. Used for painting's $119 (SOP §5/§6/§7 are
//               explicit: "Track the $119 as a flat materials/equipment line
//               item, not a deposit"). Refunded in full only if the client
//               rejects the final painting amount before job confirmation.
//
//   "cost"    → flat materials/equipment line item billed on the final invoice;
//               nothing is captured upfront.
export type { MaterialsType } from "@/lib/config/types";

// Pure predicates on the materials TYPE — they read a string, not the catalog,
// so they are the same before and after Stage 8. Re-exported from the config
// module so there is exactly one implementation of "is this captured upfront",
// which the billing, refund and Stripe paths all agree on.
export { isUpfrontMaterials, isRefundableDeposit } from "@/lib/config/types";

export interface MaterialsPricing {
  amount: number;
  type: import("@/lib/config/types").MaterialsType;
}

export const MATERIALS_PRICING: Record<string, MaterialsPricing> = {
  // Repairs
  DRYWALL_REPAIR: { amount: 199, type: "deposit" },
  DOOR_REPAIR: { amount: 99, type: "cost" },
  CABINET_REPAIR: { amount: 99, type: "cost" },
  TOILET_REPAIR: { amount: 99, type: "cost" },
  FAUCET_REPAIR: { amount: 99, type: "cost" },
  WEATHERSTRIPPING: { amount: 249, type: "deposit" },
  CAULKING_TOUCHUPS: { amount: 75, type: "cost" },
  LOCK_REPLACEMENT: { amount: 49, type: "cost" },
  // SOP v4.2 §5: small paint repair materials $49 (paint NOT included; client
  // provides paint). Labour is billed separately at $79/hr.
  SMALL_PAINT_REPAIR: { amount: 49, type: "cost" },
  // AC installation has NO automatic materials/equipment charge (v4.2 §5), so it
  // is intentionally absent from this map — getMaterialsPricing() returns null.

  // Installation & Assembly
  TV_MOUNTING: { amount: 49, type: "cost" },
  CURTAIN_ROD: { amount: 49, type: "cost" },
  SHELF_INSTALLATION: { amount: 49, type: "cost" },
  FURNITURE_ASSEMBLY: { amount: 49, type: "cost" },
  LIGHT_FIXTURE: { amount: 49, type: "cost" },
  FAUCET_INSTALLATION: { amount: 49, type: "cost" },
  VANITY_INSTALLATION: { amount: 49, type: "cost" },
  MIRROR_HANGING: { amount: 49, type: "cost" },
  BLINDS_INSTALLATION: { amount: 49, type: "cost" },
  PICTURE_HANGING: { amount: 49, type: "cost" },
  LOCK_INSTALLATION: { amount: 49, type: "cost" },
  APPLIANCE_HOOKUP: { amount: 49, type: "cost" },

  // Home Improvement
  // SOP §5/§6 (v4.2): painting is a FLAT $119 materials/equipment charge — NOT a
  // deposit, no unused-balance tracking. Client always provides the paint.
  // Captured upfront at booking (client decision D6); refunded in full only if
  // the client rejects the final painting amount before job confirmation.
  PAINTING: { amount: 119, type: "charge" },
  MOULDINGS: { amount: 49, type: "cost" },
  DOOR_HARDWARE: { amount: 99, type: "deposit" },
  CABINET_HARDWARE: { amount: 99, type: "cost" },
  WALL_PANELING: { amount: 49, type: "cost" },
  SMALL_CARPENTRY: { amount: 149, type: "cost" },
  SILICONE_SEALING: { amount: 69, type: "cost" },
  ACCENT_WALL: { amount: 200, type: "cost" },
  GROUT_CLEANING: { amount: 19, type: "cost" },
  CARPET_UPHOLSTERY: { amount: 79, type: "cost" },
  SMALL_RENOVATION: { amount: 99, type: "deposit" },

  // Outdoor & Seasonal
  FENCE_REPAIR: { amount: 59, type: "cost" },
  GATE_REPAIR: { amount: 59, type: "cost" },
  DECK_REPAIRS: { amount: 149, type: "deposit" },
  EXTERIOR_CAULKING: { amount: 75, type: "cost" },
  SEASONAL_SETUP: { amount: 59, type: "cost" },
  WEATHERPROOFING: { amount: 89, type: "cost" },
  OUTDOOR_FURNITURE: { amount: 49, type: "cost" },
  GUTTER_CLEANING: { amount: 59, type: "cost" },
  DRYER_VENT: { amount: 19, type: "cost" },
  MINOR_EXTERIOR: { amount: 59, type: "cost" },
};

// ── Customer-supplied parts (Phase 2C) ─────────────────────────────────────
//
// The INVERSE of MATERIALS_PRICING / `customerRequestsMaterials`. Those describe
// consumables and equipment FIXARO can supply for a surcharge. This map is about
// the major replacement ITEM itself — the lock, the faucet, the toilet, the door
// hardware, the panels, the fixture being installed. Fixaro never sources those:
// the customer buys the item and has it on site before the Pro arrives.
//
// A job can carry BOTH concepts at once: "Fixaro provides the materials &
// equipment" (caulk, shims, anchors, tools — surcharge) AND "you must supply the
// replacement lock" (no surcharge, we simply cannot start without it).
//
// SEED DEFAULT ONLY. At runtime read `customerPartFor(cfg, serviceType)` from
// the admin-editable config (ServiceCatalogItem.requiresCustomerPart /
// .customerPartNote), never this constant — same rule as MATERIALS_PRICING.
//
// The value is the noun phrase dropped into "you'll need to have __ on site",
// so it must read naturally after "have".
export const CUSTOMER_PART_DEFAULTS: Record<string, string> = {
  // Repairs — the replacement item, not the consumables.
  LOCK_REPLACEMENT: "the replacement lock",
  FAUCET_REPAIR: "the replacement faucet or cartridge",
  TOILET_REPAIR: "the replacement toilet part (fill valve, flapper, seat) or the new toilet",
  DOOR_REPAIR: "the replacement door or door hardware",

  // Installation & Assembly — we install the item you bought.
  LOCK_INSTALLATION: "the new lock set",
  FAUCET_INSTALLATION: "the new faucet",
  VANITY_INSTALLATION: "the new vanity",
  LIGHT_FIXTURE: "the light fixture",
  BLINDS_INSTALLATION: "the blinds",
  MIRROR_HANGING: "the mirror and its mounting hardware",
  TV_MOUNTING: "the TV wall mount / bracket",
  CURTAIN_ROD: "the curtain rod and brackets",
  SHELF_INSTALLATION: "the shelves and their brackets",
  FURNITURE_ASSEMBLY: "the flat-pack furniture, unopened and complete",
  APPLIANCE_HOOKUP: "the appliance",

  // Home Improvement / Outdoor.
  DOOR_HARDWARE: "the new door hardware (handles, hinges, closer)",
  CABINET_HARDWARE: "the replacement cabinet handles and knobs",
  WALL_PANELING: "the wall panels",
  OUTDOOR_FURNITURE: "the outdoor furniture, unopened and complete",

  // AC_INSTALLATION is deliberately ABSENT: its own intake question
  // (`clientHasAcUnit`) already asks whether the customer has the unit, and
  // adding it here would ask the same thing twice in different words.
};

// ── Service-specific intake options (SOP v4.2 §4) ──────────────────────────
// Deliberately excludes any paint-colour / procurement field: Fixaro never
// supplies or picks up paint, so that data is not collected.
export const PAINT_REPAIR_SURFACES = [
  "Drywall",
  "Plaster",
  "Wood / trim",
  "Concrete / masonry",
  "Other",
] as const;

export const AC_TYPES = [
  "Window unit",
  "Wall-mounted / mini-split",
  "Portable",
  "Through-the-wall",
  "Other",
] as const;

export const AC_MOUNT_TYPES = [
  "Window mount",
  "Wall bracket",
  "Floor / freestanding",
  "Not sure",
] as const;

// ── TV mounting intake + quote rule (Gap 3) ────────────────────────────────
// The catalog note already promised "Large TVs (60\"+) or brick/concrete walls:
// custom quote", but nothing captured the size or the wall, so the condition
// could never fire and those jobs went straight to card capture at $79/hr.

/** Screen-size bands. `maxInches` is the top of the band, so the >60" rule is a
 *  plain numeric comparison rather than string matching on the label. */
export const TV_SIZE_CHOICES = [
  { value: 'Up to 42"', maxInches: 42 },
  { value: '43"–55"', maxInches: 55 },
  { value: '56"–60"', maxInches: 60 },
  { value: 'Over 60"', maxInches: 999 },
] as const;

export const TV_WALL_TYPES = [
  "Drywall",
  "Wood stud / plaster",
  "Brick",
  "Concrete",
  "Other / not sure",
] as const;

/** Size above which the job must be quoted rather than instantly booked. */
export const TV_QUOTE_SIZE_THRESHOLD_INCHES = 60;

/** Wall types that force the quote path. "Other / not sure" is included
 *  deliberately: if we cannot rule out masonry we quote rather than commit to an
 *  hourly price and take a deposit — ambiguity resolves toward the quote. */
export const TV_QUOTE_WALL_TYPES: readonly string[] = [
  "Brick",
  "Concrete",
  "Other / not sure",
];

/** Top of the selected size band, or null when nothing is selected yet. */
export function tvSizeMaxInches(tvSize: string): number | null {
  const band = TV_SIZE_CHOICES.find((c) => c.value === tvSize);
  return band ? band.maxInches : null;
}

/** True once both TV fields are answered. Booking cannot advance without them —
 *  an unanswered intake is exactly the case the rule exists to catch. */
export function isTvIntakeComplete(draft: Pick<BookingDraft, "tvSize" | "tvWallType">): boolean {
  return !!(draft.tvSize && draft.tvWallType);
}

/**
 * Gap 3 rule. Quote when the screen is over 60" OR the wall is brick/concrete
 * (or unidentified). Returns false while the intake is incomplete — the wizard
 * blocks on `isTvIntakeComplete` instead, so an unanswered form can never be
 * read as "safe to charge".
 */
export function tvMountingNeedsQuote(
  draft: Pick<BookingDraft, "tvSize" | "tvWallType">
): boolean {
  const maxInches = tvSizeMaxInches(draft.tvSize);
  if (maxInches !== null && maxInches > TV_QUOTE_SIZE_THRESHOLD_INCHES) return true;
  return TV_QUOTE_WALL_TYPES.includes(draft.tvWallType);
}

// ── Quote routing (Gap 1 / Gap 2) ──────────────────────────────────────────

/**
 * Quote-priced services that nonetheless complete inside the booking wizard
 * because they have their own approval workflow.
 *
 * PAINTING only. Painting shows an immediate quote range from the scope picker,
 * takes the flat $119 materials/equipment charge, is created with
 * paintingStatus=BIDDING and fans out to painting-approved providers
 * (submitBooking → notifyPaintingProviders). Diverting it to /quote would
 * silently delete that bid/offer flow, so it is exempt.
 */
export const BID_FLOW_SERVICES: readonly string[] = ["PAINTING"];

/**
 * Services that must reach Request-a-Quote even if a stale ServiceCatalogItem
 * row still says "fixed" or "hourly".
 *
 * The live catalog is admin-editable in the DB and this file only seeds it, so a
 * pricing change here does not reach an already-seeded environment. This list is
 * the fail-closed floor: these services never take a card, whatever the row
 * says. Remove an entry only once the DB row is authoritative.
 */
export const QUOTE_ONLY_SERVICES: readonly string[] = [
  "MOULDINGS",
  "WEATHERPROOFING",
];

/**
 * Single source of truth for "this booking must go to /quote, not to checkout".
 *
 * `pricingModel` is the LIVE catalog value (from the runtime config), so admin
 * edits are honoured; the constants above only ever add services to the quote
 * path, never remove one from it.
 */
export function requiresCustomQuote(
  draft: Pick<BookingDraft, "serviceType" | "tvSize" | "tvWallType">,
  pricingModel: ServicePricingType | undefined
): boolean {
  const service = draft.serviceType;
  if (!service) return false;
  if (BID_FLOW_SERVICES.includes(service)) return false;
  if (pricingModel === "quote") return true;
  if (QUOTE_ONLY_SERVICES.includes(service)) return true;
  if (service === "TV_MOUNTING") return tvMountingNeedsQuote(draft);
  return false;
}

/** Human-readable reason, shown to the customer and carried into the quote. */
export function quoteReason(
  draft: Pick<BookingDraft, "serviceType" | "tvSize" | "tvWallType">
): string {
  if (draft.serviceType === "TV_MOUNTING") {
    const maxInches = tvSizeMaxInches(draft.tvSize);
    const oversized =
      maxInches !== null && maxInches > TV_QUOTE_SIZE_THRESHOLD_INCHES;
    if (oversized && TV_QUOTE_WALL_TYPES.includes(draft.tvWallType)) {
      return `TVs over ${TV_QUOTE_SIZE_THRESHOLD_INCHES}" and brick/concrete walls both need a custom quote.`;
    }
    if (oversized) {
      return `TVs over ${TV_QUOTE_SIZE_THRESHOLD_INCHES}" need a custom quote — larger screens need heavier mounts and a second pair of hands.`;
    }
    return "Brick, concrete and unidentified walls need a custom quote — masonry anchoring is priced per job.";
  }
  if (draft.serviceType === "WEATHERPROOFING") {
    return "Weatherproofing is quoted per property. We confirm the price with you before any work is scheduled.";
  }
  return "This service is priced per job, so we quote it before booking.";
}

/**
 * Structured intake summary for the fields that have no column of their own.
 *
 * TV size / wall type are new and Job has no column for them; submitBooking is
 * owned elsewhere, so rather than inventing a schema field we fold them into the
 * existing free-text notes the job already carries.
 */
export function serviceIntakeSummary(draft: BookingDraft): string {
  if (draft.serviceType !== "TV_MOUNTING") return "";
  const parts: string[] = [];
  if (draft.tvSize) parts.push(`TV size: ${draft.tvSize}`);
  if (draft.tvWallType) parts.push(`Wall type: ${draft.tvWallType}`);
  return parts.length > 0 ? `TV mounting — ${parts.join(", ")}.` : "";
}

/** Notes actually submitted with the booking: customer notes + intake summary. */
export function composeBookingNotes(draft: BookingDraft): string {
  const summary = serviceIntakeSummary(draft);
  const notes = draft.notes.trim();
  if (!summary) return notes;
  return notes ? `${notes}\n\n${summary}` : summary;
}

/**
 * Prefilled Request-a-Quote link for a booking that cannot be checked out.
 *
 * Only fields the customer typed into this wizard are carried across, and the
 * quote form re-validates every one of them (the service value must exist in the
 * live catalog) — the query string is a convenience, never a trust boundary.
 */
export function quoteRedirectHref(draft: BookingDraft): string {
  const params = new URLSearchParams();
  if (draft.serviceType) params.set("service", draft.serviceType);
  if (draft.address.trim()) params.set("address", draft.address.trim());
  if (draft.name.trim()) params.set("name", draft.name.trim());
  if (draft.email.trim()) params.set("email", draft.email.trim());
  if (draft.phone.trim()) params.set("phone", draft.phone.trim());

  const message = [draft.notes.trim(), serviceIntakeSummary(draft)]
    .filter(Boolean)
    .join("\n\n");
  if (message) params.set("message", message);

  return `/quote?${params.toString()}`;
}

/**
 * Materials/equipment pricing for a service from the SEED DEFAULTS, or null.
 *
 * @deprecated Reads the TS constants, not the admin-editable catalog. Use
 * `materialsFor(cfg, serviceType)` from src/lib/config/types.ts against a
 * RuntimeConfig instead. Retained only so the seeder has one accessor.
 */
export function getMaterialsPricing(serviceType?: string): MaterialsPricing | null {
  if (!serviceType) return null;
  return MATERIALS_PRICING[serviceType] ?? null;
}

// ── Default pricing knobs (seed values for the policy registry) ────────────
// Live values come from AppSetting via src/lib/config/policy-registry.ts.

export const HOURLY_RATE = 79;
export const THREE_HOUR_PACKAGE = 209;
export const MIN_HOURS = 2;

/** Silicone sealing: fixed price PER ROOM (the booking UI reuses the hours field
 *  as a room count). Seeds ServiceCatalogItem.fixedPrice + fixedPricePerUnit. */
export const SILICONE_PRICE_PER_ROOM = 209;
/** Weatherproofing: flat fixed price — the midpoint of the $59–$90 range shown
 *  to the customer. Seeds ServiceCatalogItem.fixedPrice. */
export const WEATHERPROOFING_FIXED_PRICE = 74.5;

/**
 * Hour → labour price, at the SEED rate + package. The single implementation
 * lives in src/lib/config/types.ts and is shared with the billing layer, so a
 * job clocked to exactly 3h gets the same package price the customer was quoted
 * (D0.7). Callers that have a RuntimeConfig should pass the configured rate.
 */
export function computeHourlyPrice(
  hours: number,
  rate: number = HOURLY_RATE,
  threeHourPackagePrice: number = THREE_HOUR_PACKAGE
): number {
  return computeHourlyPriceShared(hours, rate, threeHourPackagePrice);
}

/** Hour options offered in the booking UI. Prices are re-derived at render time
 *  from the configured rate — these are the labels/steps, not the money. */
export const HOUR_CHOICES: { hours: number; label: string; badge?: string }[] = [
  { hours: 2, label: "2 hours" },
  { hours: 3, label: "3 hours", badge: "Best value" },
  { hours: 4, label: "4 hours" },
  { hours: 5, label: "5 hours" },
  { hours: 6, label: "6 hours" },
];

/**
 * @deprecated Prices baked in at module load from the SEED rate, so an admin's
 * rate change never reached them. Use HOUR_CHOICES + the configured rate.
 */
export const HOUR_OPTIONS = HOUR_CHOICES.map((c) => ({
  ...c,
  price: computeHourlyPrice(c.hours),
}));

/** @deprecated Seed labels only — use `activeServices(cfg)`. */
export const SERVICE_TYPES = SERVICE_CATALOG.map((s) => ({
  value: s.value,
  label: s.label,
}));

export const FREQUENCIES: { value: Frequency; label: string; hint?: string }[] =
  [
    { value: "ONE_TIME", label: "One-time", hint: "Just this visit" },
    { value: "WEEKLY", label: "Weekly", hint: "Auto-books the next 4 weekly visits" },
    { value: "BIWEEKLY", label: "Every 2 weeks", hint: "Auto-books the next 4 visits" },
    { value: "MONTHLY", label: "Monthly", hint: "Auto-books the next 3 monthly visits" },
    { value: "QUARTERLY", label: "Quarterly", hint: "Auto-books the next 2 quarterly visits" },
  ];

// Time slots aligned with 9 AM – 7 PM operating hours
export const TIME_SLOTS: string[] = ["09:00", "11:00", "13:00", "15:00", "17:00"];
