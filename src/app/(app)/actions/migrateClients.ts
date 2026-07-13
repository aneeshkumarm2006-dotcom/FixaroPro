"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * One-time migration: deduplicates existing clientName strings into Client
 * records and back-fills clientId on all Job rows. Safe to run multiple times
 * (skips names that already have a Client record).
 */
export async function migrateClients(): Promise<{
  created: number;
  updated: number;
}> {
  // Admin-only: this is a bulk write (creates Clients, updates every Job) and
  // was reachable unauthenticated as a POST server action.
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { created: 0, updated: 0 };
  }

  // Gather all distinct clientName values from Job rows that have no clientId
  const unmigrated = await db.job.findMany({
    where: { clientId: null },
    select: { clientName: true },
    distinct: ["clientName"],
  });

  if (unmigrated.length === 0) {
    return { created: 0, updated: 0 };
  }

  let created = 0;
  let updated = 0;

  await db.$transaction(async (tx) => {
    for (const { clientName } of unmigrated) {
      const trimmed = clientName.trim();
      if (!trimmed) continue;

      // Find existing Client by name or create a new one
      let client = await tx.client.findFirst({
        where: { name: trimmed },
      });

      if (!client) {
        client = await tx.client.create({
          data: { name: trimmed },
        });
        created++;
      }

      // Back-fill clientId on all matching Job rows
      const { count } = await tx.job.updateMany({
        where: { clientName: trimmed, clientId: null },
        data: { clientId: client.id },
      });

      updated += count;
    }
  });

  return { created, updated };
}
