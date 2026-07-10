// Service-specific equipment checklist (SOP §4/§8).
//
// What the customer sees ("equipment/products generally required for the
// selected job type") and what the handyman must bring per job. These are
// starting lists — admins refine the authoritative per-job kit via the existing
// Kit Templates (inventory) which drives the missing-equipment warning in
// My Jobs. A `*` entry is the generic default for any service not listed.

export const EQUIPMENT_BY_SERVICE: Record<string, string[]> = {
  "*": ["Cordless drill/driver", "Screwdriver set", "Tape measure", "Level", "Utility knife"],

  DRYWALL_REPAIR: ["Drywall saw", "Joint knife set", "Sanding block", "Mud pan", "Dust sheets"],
  DOOR_REPAIR: ["Chisel set", "Plane", "Cordless drill", "Hinge jig", "Screwdriver set"],
  CABINET_REPAIR: ["Cordless drill", "Clamps", "Wood glue", "Screwdriver set", "Level"],
  TOILET_REPAIR: ["Adjustable wrench", "Plunger", "Bucket", "Gloves", "Plumber's tape"],
  FAUCET_REPAIR: ["Basin wrench", "Adjustable wrench", "Plumber's tape", "Bucket", "Towels"],
  CAULKING_TOUCHUPS: ["Caulk gun", "Caulk smoothing tool", "Utility knife", "Painter's tape", "Rags"],
  WEATHERSTRIPPING: ["Utility knife", "Tape measure", "Scissors", "Cordless drill", "Cleaning cloth"],
  LOCK_REPLACEMENT: ["Cordless drill", "Screwdriver set", "Chisel", "Tape measure"],
  // SOP v4.2 — small paint repair: client provides the paint; these cover the
  // repair/prep work only.
  SMALL_PAINT_REPAIR: ["Putty knife", "Sandpaper", "Filler/spackle", "Painter's tape", "Drop cloths", "Brushes & mini roller"],

  TV_MOUNTING: ["Stud finder", "Cordless drill", "Level", "Socket set", "Cable ties"],
  CURTAIN_ROD: ["Cordless drill", "Level", "Stud finder", "Tape measure", "Anchors"],
  SHELF_INSTALLATION: ["Cordless drill", "Level", "Stud finder", "Anchors", "Tape measure"],
  FURNITURE_ASSEMBLY: ["Screwdriver set", "Cordless drill", "Allen keys", "Rubber mallet"],
  LIGHT_FIXTURE: ["Voltage tester", "Wire strippers", "Screwdriver set", "Wire nuts", "Step ladder"],
  FAUCET_INSTALLATION: ["Basin wrench", "Adjustable wrench", "Plumber's tape", "Bucket", "Silicone"],
  VANITY_INSTALLATION: ["Cordless drill", "Level", "Adjustable wrench", "Silicone", "Stud finder"],
  MIRROR_HANGING: ["Stud finder", "Level", "Cordless drill", "Anchors", "Tape measure"],
  BLINDS_INSTALLATION: ["Cordless drill", "Level", "Tape measure", "Anchors", "Screwdriver set"],
  PICTURE_HANGING: ["Hammer", "Level", "Tape measure", "Picture hooks", "Stud finder"],
  LOCK_INSTALLATION: ["Cordless drill", "Hole saw kit", "Chisel", "Screwdriver set", "Tape measure"],
  APPLIANCE_HOOKUP: ["Adjustable wrench", "Level", "Voltage tester", "Hand truck", "Plumber's tape"],
  // SOP v4.2 — AC installation: client provides the AC unit/accessories unless
  // an admin-approved extra; these are the install tools.
  AC_INSTALLATION: ["Cordless drill", "Level", "Stud finder", "Bracket hardware", "Tape measure", "Caulk gun", "Voltage tester"],

  PAINTING: ["Drop cloths", "Rollers & trays", "Brushes", "Painter's tape", "Sandpaper", "Ladder"],
  MOULDINGS: ["Mitre saw", "Brad nailer", "Caulk gun", "Level", "Tape measure"],
  DOOR_HARDWARE: ["Cordless drill", "Chisel", "Screwdriver set", "Tape measure"],
  CABINET_HARDWARE: ["Cordless drill", "Hardware jig", "Tape measure", "Screwdriver set"],
  WALL_PANELING: ["Mitre saw", "Brad nailer", "Level", "Construction adhesive", "Tape measure"],
  SMALL_CARPENTRY: ["Circular saw", "Cordless drill", "Clamps", "Level", "Tape measure"],
  SILICONE_SEALING: ["Caulk gun", "Smoothing tool", "Utility knife", "Cleaning solvent", "Rags"],
  ACCENT_WALL: ["Rollers & brushes", "Drop cloths", "Painter's tape", "Level", "Ladder"],
  GROUT_CLEANING: ["Grout brush", "Grout cleaner", "Bucket", "Gloves", "Microfibre cloths"],
  CARPET_UPHOLSTERY: ["Extraction machine", "Cleaning solution", "Brushes", "Towels"],
  SMALL_RENOVATION: ["Cordless drill", "Pry bar", "Hammer", "Level", "Dust sheets"],

  FENCE_REPAIR: ["Cordless drill", "Saw", "Post level", "Hammer", "Work gloves"],
  GATE_REPAIR: ["Cordless drill", "Adjustable wrench", "Level", "Hinges/hardware"],
  DECK_REPAIRS: ["Circular saw", "Cordless drill", "Pry bar", "Deck screws", "Level"],
  EXTERIOR_CAULKING: ["Caulk gun", "Exterior caulk", "Utility knife", "Ladder", "Rags"],
  SEASONAL_SETUP: ["Cordless drill", "Ladder", "Extension cords", "Hand tools"],
  WEATHERPROOFING: ["Caulk gun", "Weatherstrip", "Utility knife", "Tape measure", "Cleaning cloth"],
  OUTDOOR_FURNITURE: ["Screwdriver set", "Cordless drill", "Allen keys", "Rubber mallet"],
  GUTTER_CLEANING: ["Extension ladder", "Gutter scoop", "Bucket", "Gloves", "Hose"],
  DRYER_VENT: ["Vent brush kit", "Vacuum", "Screwdriver set", "Foil tape"],
  MINOR_EXTERIOR: ["Ladder", "Cordless drill", "Hand tools", "Sealant"],
};

/**
 * Seeded default checklist for a service. Synchronous and client-safe.
 *
 * These are DEFAULTS only. An admin may override any service's list — see
 * `getRequiredEquipmentFor` in equipment-server.ts, which reads the
 * ServiceEquipment table and falls back to this map. Use the server version
 * anywhere the admin's edits must be honoured (SOP §4/§8).
 */
export function getRequiredEquipment(serviceType?: string | null): string[] {
  if (!serviceType) return EQUIPMENT_BY_SERVICE["*"];
  return EQUIPMENT_BY_SERVICE[serviceType] ?? EQUIPMENT_BY_SERVICE["*"];
}
