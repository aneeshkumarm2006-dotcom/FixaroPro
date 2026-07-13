/**
 * Seed the config layer from the TypeScript defaults (SOP §3, stage 8).
 *
 * Populates ServiceCatalogItem, PaintingBaseline and the policy AppSetting rows
 * from src/app/(book)/book/types.ts, src/lib/painting.ts and
 * src/lib/config/policy-registry.ts — which remain the seed defaults.
 *
 * Run once per environment:  npx tsx prisma/seed-service-config.ts
 *
 * IDEMPOTENT and ADDITIVE — it only creates rows that don't exist, so re-running
 * never clobbers an admin's repricing, or a service they deliberately retired.
 *
 * You usually don't need to run this by hand: the first admin page load seeds it
 * (ensureServiceConfigSeeded, called from the app layout). This exists for
 * headless environments — CI, a fresh staging DB, a deploy step — where no admin
 * has visited yet, and for provisioning an environment before its first login.
 */
import { PrismaClient } from "@prisma/client";
import { SERVICE_CATALOG, MATERIALS_PRICING, SILICONE_PRICE_PER_ROOM, WEATHERPROOFING_FIXED_PRICE } from "../src/app/(book)/book/types";
import { PAINTING_SCOPES } from "../src/lib/painting";
import { POLICY_SETTINGS } from "../src/lib/config/policy-registry";

const db = new PrismaClient();

const PRICING_TO_DB = { hourly: "HOURLY", fixed: "FIXED", quote: "QUOTE" } as const;
const MATERIALS_TO_DB = { deposit: "DEPOSIT", cost: "COST", charge: "CHARGE" } as const;

const FIXED_PRICE_DEFAULTS: Record<string, { fixedPrice: number; perUnit: boolean }> = {
  SILICONE_SEALING: { fixedPrice: SILICONE_PRICE_PER_ROOM, perUnit: true },
  WEATHERPROOFING: { fixedPrice: WEATHERPROOFING_FIXED_PRICE, perUnit: false },
};

const MATERIALS_NOTE_DEFAULTS: Record<string, string> = {
  PAINTING: "paint not included",
  SMALL_PAINT_REPAIR: "paint not included",
};

async function main() {
  let services = 0;
  for (const [i, s] of SERVICE_CATALOG.entries()) {
    const materials = MATERIALS_PRICING[s.value] ?? null;
    const fixed = FIXED_PRICE_DEFAULTS[s.value] ?? null;
    const res = await db.serviceCatalogItem.createMany({
      data: [
        {
          value: s.value,
          label: s.label,
          category: s.category,
          pricing: PRICING_TO_DB[s.pricing],
          priceNote: s.priceNote ?? null,
          active: true,
          sortOrder: i,
          fixedPrice: fixed?.fixedPrice ?? null,
          fixedPricePerUnit: fixed?.perUnit ?? false,
          materialsAmount: materials?.amount ?? null,
          materialsType: materials ? MATERIALS_TO_DB[materials.type] : null,
          materialsNote: MATERIALS_NOTE_DEFAULTS[s.value] ?? null,
        },
      ],
      skipDuplicates: true,
    });
    services += res.count;
  }

  let painting = 0;
  for (const [i, p] of PAINTING_SCOPES.entries()) {
    const res = await db.paintingBaseline.createMany({
      data: [
        {
          key: p.key,
          label: p.label,
          baselineMin: p.baselineMin,
          baselineMax: p.baselineMax,
          note: p.note ?? null,
          active: true,
          sortOrder: i,
        },
      ],
      skipDuplicates: true,
    });
    painting += res.count;
  }

  const policy = await db.appSetting.createMany({
    data: POLICY_SETTINGS.map((d) => ({
      key: d.key,
      category: d.category,
      value: d.default,
    })),
    skipDuplicates: true,
  });

  console.log(
    `Config seeded — ${services} service(s), ${painting} painting baseline(s), ${policy.count} policy value(s) created. Existing rows untouched.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
