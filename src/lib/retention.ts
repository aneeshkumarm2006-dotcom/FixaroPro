import { db } from "@/db";
import {
  RETENTION_SETTING_KEY,
  RETENTION_SETTING_CATEGORY,
  DEFAULT_SAVE_OFFER,
  type SaveOfferConfig,
} from "@/lib/retention-constants";

/**
 * Read the admin-editable save-offer config from AppSetting, falling back to
 * the defaults (and merging so a partial stored value still yields a complete
 * config).
 */
export async function getSaveOfferConfig(): Promise<SaveOfferConfig> {
  const row = await db.appSetting.findUnique({
    where: { key: RETENTION_SETTING_KEY },
  });
  if (!row || typeof row.value !== "object" || row.value === null) {
    return DEFAULT_SAVE_OFFER;
  }
  return { ...DEFAULT_SAVE_OFFER, ...(row.value as Partial<SaveOfferConfig>) };
}

/** Persist the save-offer config (admin RetentionTab). */
export async function setSaveOfferConfig(config: SaveOfferConfig): Promise<void> {
  await db.appSetting.upsert({
    where: { key: RETENTION_SETTING_KEY },
    create: {
      key: RETENTION_SETTING_KEY,
      category: RETENTION_SETTING_CATEGORY,
      value: config as unknown as object,
    },
    update: { value: config as unknown as object },
  });
}
