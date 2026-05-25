import { db } from "@/db";
import {
  DEFAULT_RATING_MULTIPLIERS,
  type RatingMultiplierMap,
} from "./pay-multiplier";

export const RATING_MULTIPLIER_SETTING_KEY = "multipliers.ratings";

// Loads the admin-configured rating→multiplier map, falling back to defaults
// for any step that isn't set. Server-only (touches the DB).
export async function getRatingMultiplierMap(): Promise<RatingMultiplierMap> {
  const setting = await db.appSetting.findUnique({
    where: { key: RATING_MULTIPLIER_SETTING_KEY },
  });

  if (setting && setting.value && typeof setting.value === "object") {
    return {
      ...DEFAULT_RATING_MULTIPLIERS,
      ...(setting.value as RatingMultiplierMap),
    };
  }
  return DEFAULT_RATING_MULTIPLIERS;
}
