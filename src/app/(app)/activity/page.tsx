import { requireAdmin } from "@/lib/page-guards";
import { db } from "@/db";
import { targetLabel } from "@/lib/log-labels";
import ActivityLogClient, {
  type ActivityRow,
  type HealthCounts,
} from "./ActivityLogClient";

export const dynamic = "force-dynamic";

// How many recent entries to load into the client for in-memory
// filtering/searching/pagination. Health counts below are all-time and
// independent of this window.
const LIMIT = 200;

// Safely pull a string field out of an ActivityLog.metadata JSON blob. Used to
// surface a recipient/subject in the "who" column for EMAIL/SMS rows without
// trusting the shape of the stored JSON.
function metaString(meta: unknown, ...keys: string[]): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const obj = meta as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

export default async function ActivityPage() {
  // Admins only — same guard the /logs audit view uses (fail closed: redirects
  // non-admins to their home before any query runs).
  await requireAdmin();

  const [entries, totalCount, catStatusCounts] = await Promise.all([
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: LIMIT }),
    db.activityLog.count(),
    // All-time counts grouped by category + status, used for the health cards.
    db.activityLog.groupBy({ by: ["category", "status"], _count: true }),
  ]);

  // Resolve every referenced job to "Job #<n> — <client>" in a single query so
  // the timeline never shows an opaque database id.
  const jobIds = new Set<string>();
  for (const a of entries) {
    if (a.targetType === "job" && a.targetId) jobIds.add(a.targetId);
  }
  const jobRows = jobIds.size
    ? await db.job.findMany({
        where: { id: { in: [...jobIds] } },
        select: { id: true, jobNumber: true, clientName: true },
      })
    : [];
  const jobMap = new Map(
    jobRows.map((j) => [
      j.id,
      { jobNumber: j.jobNumber, clientName: j.clientName },
    ]),
  );

  const rows: ActivityRow[] = entries.map((a) => ({
    id: a.id,
    createdAt: a.createdAt.toISOString(),
    category: a.category,
    action: a.action,
    status: a.status,
    message: a.message ?? null,
    recipient: metaString(a.metadata, "recipient", "to", "phone"),
    subject: metaString(a.metadata, "subject"),
    actorLabel: a.actorLabel ?? a.actorId ?? null,
    targetType: a.targetType ?? null,
    targetId: a.targetId ?? null,
    targetLabel: targetLabel(a.targetType ?? null, a.targetId ?? null, jobMap),
    amount: a.amount ?? null,
    providerId: a.providerId ?? null,
    error: a.error ?? null,
    metadata: a.metadata ?? null,
  }));

  // All-time health summary. EMAIL-category rows feed the "Emails" cards;
  // everything else feeds the "Activity" cards, mirroring the /logs split.
  const tally = (isEmail: boolean, status: string) =>
    catStatusCounts
      .filter((c) => (c.category === "EMAIL") === isEmail && c.status === status)
      .reduce((n, c) => n + c._count, 0);

  const counts: HealthCounts = {
    emailsSent: tally(true, "SUCCESS"),
    emailsFailed: tally(true, "FAILED"),
    emailsPending: tally(true, "PENDING"),
    activityOk: tally(false, "SUCCESS"),
    activityFailed: tally(false, "FAILED"),
  };

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <ActivityLogClient
        rows={rows}
        counts={counts}
        totalCount={totalCount}
        windowLimit={LIMIT}
      />
    </div>
  );
}
