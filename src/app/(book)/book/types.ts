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
  // Step 3
  date: string;
  isFlexible: boolean;
  timeSlot: string;
  // Step 4
  name: string;
  phone: string;
  email: string;
  notes: string;
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
  date: "",
  isFlexible: true,
  timeSlot: "",
  name: "",
  phone: "",
  email: "",
  notes: "",
  referralCode: "",
  afterPhotoConsent: false,
};

// ── Service catalog ────────────────────────────────────────────────────────

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
  { value: "SILICONE_SEALING", label: "Silicone Sealing", category: "Home Improvement", pricing: "fixed", priceNote: "$209 per room — silicone included" },
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
  { value: "WEATHERPROOFING", label: "Weatherproofing", category: "Outdoor & Seasonal", pricing: "fixed", priceNote: "Fixed price $59–$90" },
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
export type MaterialsType = "deposit" | "cost" | "charge";

/** Types whose amount is captured on the customer's card at booking time. */
export function isUpfrontMaterials(type: string | null | undefined): boolean {
  return type === "deposit" || type === "charge";
}

/** Only true deposits get the "D" review indicator and apply/refund controls. */
export function isRefundableDeposit(type: string | null | undefined): boolean {
  return type === "deposit";
}

export interface MaterialsPricing {
  amount: number;
  type: MaterialsType;
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

// Returns the materials/equipment pricing for a service, or null if none configured.
export function getMaterialsPricing(serviceType?: string): MaterialsPricing | null {
  if (!serviceType) return null;
  return MATERIALS_PRICING[serviceType] ?? null;
}

// Hourly rate & package pricing
export const HOURLY_RATE = 79;
export const THREE_HOUR_PACKAGE = 209;
export const MIN_HOURS = 2;

export function computeHourlyPrice(hours: number): number {
  if (hours === 3) return THREE_HOUR_PACKAGE;
  return hours * HOURLY_RATE;
}

// Hour options shown in booking UI
export const HOUR_OPTIONS = [
  { hours: 2, label: "2 hours", price: computeHourlyPrice(2) },
  { hours: 3, label: "3 hours", price: computeHourlyPrice(3), badge: "Best value" },
  { hours: 4, label: "4 hours", price: computeHourlyPrice(4) },
  { hours: 5, label: "5 hours", price: computeHourlyPrice(5) },
  { hours: 6, label: "6 hours", price: computeHourlyPrice(6) },
];

// Keep SERVICE_TYPES as alias for backward compat with any admin UI
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
