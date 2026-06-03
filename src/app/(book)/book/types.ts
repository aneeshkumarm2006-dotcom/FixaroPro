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
  date: "",
  isFlexible: true,
  timeSlot: "",
  name: "",
  phone: "",
  email: "",
  notes: "",
  referralCode: "",
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
