"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";

// ── Per-job chat: office (ADMIN) ↔ Pro (CLEANER) ↔ client (CLIENT) thread ──────
//
// Every action re-resolves the caller against the job from the SESSION. The
// sender's role and id are NEVER taken from client input — the client only ever
// supplies a jobId + message body. This is the sole authorization boundary for
// the thread, so it holds regardless of which page mounts the panel (defense in
// depth: the admin/pro/portal pages already gate access, but this re-checks).

// ── Types ────────────────────────────────────────────────────────────────────

export type JobChatRole = "CLEANER" | "CLIENT" | "ADMIN";

export interface JobChatMessageDTO {
  id: string;
  jobId: string;
  senderId: string | null;
  senderRole: JobChatRole;
  senderName: string;
  body: string;
  createdAt: string;
  /** True when this message was sent by the current viewer. */
  mine: boolean;
}

export interface JobChatPayload {
  jobId: string;
  /** Viewer's own role in this thread (session-derived). */
  viewerRole: JobChatRole;
  messages: JobChatMessageDTO[];
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Must match ADMIN_ROLES in src/lib/role-routing.ts.
function isAdminRole(role: string | undefined) {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "OPS_MANAGER" ||
    role === "FIELD_LEAD"
  );
}

type SessionUser = { id: string; name: string; email?: string; role?: string };

type Participant = {
  userId: string;
  name: string;
  role: JobChatRole;
};

const MAX_BODY_LENGTH = 4000;

/**
 * Resolve the current session against a job and decide the caller's role in the
 * job's chat thread. Fails closed: returns an error string if the caller is not
 * a participant (not the assigned Pro/lead, not the job's client, not an admin).
 * The returned `role`/`userId` are the ONLY trusted sender identity — callers
 * must never let the client choose these.
 */
async function resolveParticipant(
  jobId: string
): Promise<{ participant: Participant } | { error: string }> {
  if (!jobId || typeof jobId !== "string") return { error: "Invalid request" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { error: "Not authenticated" };
  const user = session.user as SessionUser;

  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      employeeId: true,
      clientId: true,
      cleaners: { select: { id: true } },
    },
  });
  if (!job) return { error: "Job not found" };

  // 1) Pro (enum CLEANER) — the job's employee lead or any assigned Pro.
  const isPro =
    (job.employeeId != null && job.employeeId === user.id) ||
    job.cleaners.some((c) => c.id === user.id);
  if (isPro) {
    return { participant: { userId: user.id, name: user.name, role: "CLEANER" } };
  }

  // 2) Client — the customer that owns this job. Job.clientId points at a
  //    Client record; the portal session is a User, matched by email. Guards
  //    against IDOR: a signed-in client can only reach a job that is theirs.
  if (job.clientId) {
    const email = user.email?.toLowerCase();
    if (email) {
      const client = await db.client.findFirst({
        where: { email },
        select: { id: true, name: true },
      });
      if (client && client.id === job.clientId) {
        return {
          participant: {
            userId: user.id,
            name: client.name ?? user.name,
            role: "CLIENT",
          },
        };
      }
    }
  }

  // 3) Admin — OWNER/ADMIN/OPS_MANAGER/FIELD_LEAD may view and post.
  if (isAdminRole(user.role)) {
    return { participant: { userId: user.id, name: user.name, role: "ADMIN" } };
  }

  // Fail closed — anyone else is denied.
  return { error: "Not authorized" };
}

function readFieldFor(role: JobChatRole): "readByCleanerAt" | "readByClientAt" | "readByAdminAt" {
  return role === "CLEANER"
    ? "readByCleanerAt"
    : role === "CLIENT"
      ? "readByClientAt"
      : "readByAdminAt";
}

function toDTO(
  m: {
    id: string;
    jobId: string;
    senderId: string | null;
    senderRole: JobChatRole;
    senderName: string;
    body: string;
    createdAt: Date;
  },
  viewerRole: JobChatRole,
  viewerId: string
): JobChatMessageDTO {
  return {
    id: m.id,
    jobId: m.jobId,
    senderId: m.senderId,
    senderRole: m.senderRole,
    senderName: m.senderName,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    // "Mine" = same role AND same user id, so one admin doesn't see another
    // admin's messages collapsed onto their own side.
    mine: m.senderRole === viewerRole && m.senderId === viewerId,
  };
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * List the chat thread for a job (read-only, no side effects). Authorized to
 * the assigned Pro, the job's client, or an admin.
 */
export async function listJobChatMessages(
  jobId: string
): Promise<ActionResult<JobChatPayload>> {
  const r = await resolveParticipant(jobId);
  if ("error" in r) return { success: false, error: r.error };
  const { userId, role } = r.participant;

  const messages = await db.jobChatMessage.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      jobId: true,
      senderId: true,
      senderRole: true,
      senderName: true,
      body: true,
      createdAt: true,
    },
  });

  return {
    success: true,
    data: {
      jobId,
      viewerRole: role,
      messages: messages.map((m) => toDTO(m as never, role, userId)),
    },
  };
}

/**
 * Mark every message from the OTHER parties as read for the viewer's own role.
 * The read column is chosen from the session-derived role, so each surface
 * (admin / Pro / client) only ever stamps its own read timestamp.
 */
export async function markJobChatRead(
  jobId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const r = await resolveParticipant(jobId);
  if ("error" in r) return { success: false, error: r.error };
  const { role } = r.participant;

  const readField = readFieldFor(role);
  await db.jobChatMessage.updateMany({
    where: {
      jobId,
      senderRole: { not: role },
      [readField]: null,
    },
    data: { [readField]: new Date() },
  });

  return { success: true };
}

/**
 * Post a message to a job's chat thread. The sender role + id are resolved from
 * the session against the job (Pro / client / admin) and are never accepted
 * from the client — only the jobId and body cross the boundary.
 */
export async function sendJobChatMessage(
  jobId: string,
  body: string
): Promise<ActionResult<JobChatMessageDTO>> {
  const r = await resolveParticipant(jobId);
  if ("error" in r) return { success: false, error: r.error };
  const { userId, name, role } = r.participant;

  // Validate the one piece of free-form client input.
  if (typeof body !== "string") {
    return { success: false, error: "Message cannot be empty" };
  }
  const trimmed = body.trim();
  if (!trimmed) return { success: false, error: "Message cannot be empty" };
  if (trimmed.length > MAX_BODY_LENGTH) {
    return {
      success: false,
      error: `Message is too long (max ${MAX_BODY_LENGTH} characters)`,
    };
  }

  const now = new Date();
  const message = await db.jobChatMessage.create({
    data: {
      jobId,
      senderId: userId,
      senderRole: role,
      senderName: name,
      body: trimmed,
      // The sender has, by definition, already seen their own message.
      readByCleanerAt: role === "CLEANER" ? now : null,
      readByClientAt: role === "CLIENT" ? now : null,
      readByAdminAt: role === "ADMIN" ? now : null,
    },
    select: {
      id: true,
      jobId: true,
      senderId: true,
      senderRole: true,
      senderName: true,
      body: true,
      createdAt: true,
    },
  });

  return { success: true, data: toDTO(message as never, role, userId) };
}
