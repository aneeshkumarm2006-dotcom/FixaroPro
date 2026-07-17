import { requireStaff } from "@/lib/page-guards";
import { db } from "@/db";
import { Roles, AnnouncementAudience } from "@prisma/client";
import AnnouncementsClient, { type AnnouncementDTO } from "./AnnouncementsClient";

export const metadata = {
  title: "Announcements · Fixaro",
};

// Publish / pin / delete are gated to these roles (matches actions.ts). Everyone
// else on the team can still view, react and acknowledge.
const MANAGER_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

export default async function AnnouncementsPage() {
  const session = await requireStaff();
  const userId = session.user.id;
  const role = (session.user as { role?: string }).role;
  const canManage = !!role && MANAGER_ROLES.includes(role);

  // Authorization at the query boundary: non-managers never receive ADMINS-only
  // posts. Fail closed — the filter is applied server-side, not in the client.
  const audienceWhere = canManage
    ? {}
    : { audience: { in: [AnnouncementAudience.ALL, AnnouncementAudience.PROVIDERS] } };

  const [rows, staffCount, adminCount] = await Promise.all([
    db.announcement.findMany({
      where: audienceWhere,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: {
        reactions: { select: { emoji: true, userId: true } },
        acks: { select: { userId: true } },
      },
    }),
    // Denominator for "X / Y read": internal staff (everyone but CLIENT).
    db.user.count({ where: { role: { not: Roles.CLIENT } } }),
    db.user.count({ where: { role: { in: [Roles.OWNER, Roles.ADMIN, Roles.OPS_MANAGER] } } }),
  ]);

  const announcements: AnnouncementDTO[] = rows.map((a) => {
    const reactions: Record<string, number> = {};
    const youReacted: string[] = [];
    for (const r of a.reactions) {
      reactions[r.emoji] = (reactions[r.emoji] || 0) + 1;
      if (r.userId === userId) youReacted.push(r.emoji);
    }
    const youAcked = a.acks.some((ack) => ack.userId === userId);
    const total = a.audience === "ADMINS" ? adminCount : staffCount;
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      authorLabel: a.authorLabel,
      audience: a.audience,
      pinned: a.pinned,
      createdAt: a.createdAt.toISOString(),
      reactions,
      youReacted,
      acked: a.acks.length,
      total: Math.max(total, a.acks.length),
      youAcked,
    };
  });

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <AnnouncementsClient
        announcements={announcements}
        canManage={canManage}
      />
    </div>
  );
}
