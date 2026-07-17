"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { AnnouncementAudience } from "@prisma/client";

// Publish / pin / delete are restricted to the same management roles as the rest
// of the ops surface (mirrors setEmployeeServiceEligibility.ts). Reacting and
// acknowledging are open to any authenticated user.
const MANAGER_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

// Server-side allow-list. The client renders these three; anything else is a
// forged request and is rejected. Never trust the emoji off the wire.
const ALLOWED_EMOJI = new Set(["👍", "🎉", "❤️"]);
const ALLOWED_AUDIENCE = new Set<string>(["ALL", "PROVIDERS", "ADMINS"]);

const TITLE_MAX = 200;
const BODY_MAX = 5000;

type ActionResult = { success: true } | { success: false; error: string };

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string; email?: string; role?: string };
}

function isManager(role?: string) {
  return !!role && MANAGER_ROLES.includes(role);
}

// Admin: publish a new announcement to the team hub.
export async function createAnnouncement(input: {
  title: string;
  body: string;
  audience: string;
  pinned: boolean;
}): Promise<ActionResult> {
  try {
    const user = await getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!isManager(user.role)) return { success: false, error: "Not authorized" };

    // Validate at the boundary — reject by default, allow-list known-good shapes.
    const title = typeof input?.title === "string" ? input.title.trim() : "";
    const body = typeof input?.body === "string" ? input.body.trim() : "";
    const audience = typeof input?.audience === "string" ? input.audience : "";
    const pinned = input?.pinned === true;

    if (!title || !body) return { success: false, error: "Title and message are required" };
    if (title.length > TITLE_MAX) return { success: false, error: "Title is too long" };
    if (body.length > BODY_MAX) return { success: false, error: "Message is too long" };
    if (!ALLOWED_AUDIENCE.has(audience)) return { success: false, error: "Invalid audience" };

    const created = await db.announcement.create({
      data: {
        title,
        body,
        audience: audience as AnnouncementAudience,
        pinned,
        authorId: user.id,
        authorLabel: user.name || user.email || "Team",
      },
      select: { id: true },
    });

    await logAudit({
      entityType: "Announcement",
      entityId: created.id,
      action: "ANNOUNCEMENT_CREATED",
      actorId: user.id,
      actorEmail: user.email ?? null,
      description: `Published announcement "${title}" to ${audience}.`,
    });

    revalidatePath("/announcements");
    return { success: true };
  } catch (error) {
    console.error("createAnnouncement failed:", error);
    return { success: false, error: "Failed to publish announcement" };
  }
}

// Admin: pin / unpin an announcement.
export async function togglePin(input: { id: string }): Promise<ActionResult> {
  try {
    const user = await getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!isManager(user.role)) return { success: false, error: "Not authorized" };

    const id = typeof input?.id === "string" ? input.id : "";
    if (!id) return { success: false, error: "Missing announcement" };

    const existing = await db.announcement.findUnique({
      where: { id },
      select: { pinned: true },
    });
    if (!existing) return { success: false, error: "Announcement not found" };

    await db.announcement.update({
      where: { id },
      data: { pinned: !existing.pinned },
    });

    await logAudit({
      entityType: "Announcement",
      entityId: id,
      action: existing.pinned ? "ANNOUNCEMENT_UNPINNED" : "ANNOUNCEMENT_PINNED",
      actorId: user.id,
      actorEmail: user.email ?? null,
      description: `${existing.pinned ? "Unpinned" : "Pinned"} announcement ${id}.`,
    });

    revalidatePath("/announcements");
    return { success: true };
  } catch (error) {
    console.error("togglePin failed:", error);
    return { success: false, error: "Failed to update announcement" };
  }
}

// Admin: delete an announcement (cascades to its reactions and acks).
export async function deleteAnnouncement(input: { id: string }): Promise<ActionResult> {
  try {
    const user = await getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!isManager(user.role)) return { success: false, error: "Not authorized" };

    const id = typeof input?.id === "string" ? input.id : "";
    if (!id) return { success: false, error: "Missing announcement" };

    const existing = await db.announcement.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    // Fail closed / idempotent: nothing to delete is treated as done.
    if (!existing) return { success: true };

    await db.announcement.delete({ where: { id } });

    await logAudit({
      entityType: "Announcement",
      entityId: id,
      action: "ANNOUNCEMENT_DELETED",
      actorId: user.id,
      actorEmail: user.email ?? null,
      description: `Deleted announcement "${existing.title}".`,
    });

    revalidatePath("/announcements");
    return { success: true };
  } catch (error) {
    console.error("deleteAnnouncement failed:", error);
    return { success: false, error: "Failed to delete announcement" };
  }
}

// Any authed user: add or remove their own reaction. Toggling is idempotent —
// the unique (announcementId, userId, emoji) constraint guarantees at most one.
export async function toggleReaction(input: {
  id: string;
  emoji: string;
}): Promise<ActionResult> {
  try {
    const user = await getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const id = typeof input?.id === "string" ? input.id : "";
    const emoji = typeof input?.emoji === "string" ? input.emoji : "";
    if (!id) return { success: false, error: "Missing announcement" };
    if (!ALLOWED_EMOJI.has(emoji)) return { success: false, error: "Invalid reaction" };

    // Confirm the target exists before writing (fail closed on bad ids).
    const target = await db.announcement.findUnique({ where: { id }, select: { id: true } });
    if (!target) return { success: false, error: "Announcement not found" };

    const existing = await db.announcementReaction.findUnique({
      where: {
        announcementId_userId_emoji: {
          announcementId: id,
          userId: user.id,
          emoji,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await db.announcementReaction.delete({ where: { id: existing.id } });
    } else {
      await db.announcementReaction.create({
        data: { announcementId: id, userId: user.id, emoji },
      });
    }

    revalidatePath("/announcements");
    return { success: true };
  } catch (error) {
    console.error("toggleReaction failed:", error);
    return { success: false, error: "Failed to react" };
  }
}

// Any authed user: acknowledge (mark as read). Idempotent via the unique
// (announcementId, userId) constraint — re-acking is a no-op.
export async function acknowledgeAnnouncement(input: {
  id: string;
}): Promise<ActionResult> {
  try {
    const user = await getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const id = typeof input?.id === "string" ? input.id : "";
    if (!id) return { success: false, error: "Missing announcement" };

    const target = await db.announcement.findUnique({ where: { id }, select: { id: true } });
    if (!target) return { success: false, error: "Announcement not found" };

    await db.announcementAck.upsert({
      where: { announcementId_userId: { announcementId: id, userId: user.id } },
      create: { announcementId: id, userId: user.id },
      update: {},
    });

    revalidatePath("/announcements");
    return { success: true };
  } catch (error) {
    console.error("acknowledgeAnnouncement failed:", error);
    return { success: false, error: "Failed to acknowledge" };
  }
}
