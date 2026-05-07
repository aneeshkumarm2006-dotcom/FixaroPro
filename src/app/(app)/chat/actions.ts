"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import type {
  AdminChatPayload,
  AdminConversationSummary,
  ChatMessageDTO,
  EmployeeChatPayload,
} from "./types";

type SessionUser = { id: string; name: string; role?: string };
type AppRole = "OWNER" | "ADMIN" | "EMPLOYEE";

type RequireUserResult =
  | { error: string }
  | { user: SessionUser; role: AppRole };

async function requireUser(): Promise<RequireUserResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated" };
  const user = session.user as SessionUser;
  return {
    user,
    role: (user.role as AppRole | undefined) ?? "EMPLOYEE",
  };
}

function isAdminRole(role: string | undefined) {
  return role === "OWNER" || role === "ADMIN";
}

type RawMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: "EMPLOYEE" | "ADMIN";
  body: string;
  createdAt: Date;
  readByAdminAt: Date | null;
  readByEmployeeAt: Date | null;
  sender: { name: string };
};

function toMessageDTO(m: RawMessage): ChatMessageDTO {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    senderName: m.sender.name,
    senderRole: m.senderRole,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    readByAdminAt: m.readByAdminAt ? m.readByAdminAt.toISOString() : null,
    readByEmployeeAt: m.readByEmployeeAt ? m.readByEmployeeAt.toISOString() : null,
  };
}

async function findOrCreateConversationForEmployee(employeeId: string) {
  const existing = await db.chatConversation.findUnique({
    where: { employeeId },
  });
  if (existing) return existing;
  return db.chatConversation.create({ data: { employeeId } });
}

export async function getEmployeeChat(): Promise<
  { success: true; data: EmployeeChatPayload } | { success: false; error: string }
> {
  const auth = await requireUser();
  if ("error" in auth) return { success: false, error: auth.error };

  const conversation = await findOrCreateConversationForEmployee(auth.user.id);

  const messages = await db.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { name: true } } },
  });

  // Mark all admin-sent messages as read by this employee.
  const now = new Date();
  await db.chatMessage.updateMany({
    where: {
      conversationId: conversation.id,
      senderRole: "ADMIN",
      readByEmployeeAt: null,
    },
    data: { readByEmployeeAt: now },
  });

  return {
    success: true,
    data: {
      conversationId: conversation.id,
      messages: messages.map(toMessageDTO),
    },
  };
}

export async function getAdminChatList(): Promise<
  { success: true; data: AdminConversationSummary[] } | { success: false; error: string }
> {
  const a = await requireUser();
  if ("error" in a) return { success: false, error: a.error };
  if (!isAdminRole(a.role)) return { success: false, error: "Not authorized" };

  // Make sure every employee has a conversation row so the list isn't empty
  // before the first message is sent. Idempotent.
  const employees = await db.user.findMany({
    where: { role: "EMPLOYEE" },
    select: { id: true, name: true, image: true },
  });

  const existing = await db.chatConversation.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) } },
    select: { employeeId: true },
  });
  const existingIds = new Set(existing.map((e) => e.employeeId));
  const missing = employees.filter((e) => !existingIds.has(e.id));
  if (missing.length > 0) {
    await db.chatConversation.createMany({
      data: missing.map((e) => ({ employeeId: e.id })),
      skipDuplicates: true,
    });
  }

  const conversations = await db.chatConversation.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) } },
    include: {
      employee: { select: { id: true, name: true, image: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          body: true,
          createdAt: true,
          senderRole: true,
        },
      },
    },
  });

  // Unread count per conversation: employee-sent messages not yet read by admin.
  const unreadCounts = await db.chatMessage.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      senderRole: "EMPLOYEE",
      readByAdminAt: null,
    },
    _count: { _all: true },
  });
  const unreadMap = new Map<string, number>();
  for (const u of unreadCounts) unreadMap.set(u.conversationId, u._count._all);

  const summaries: AdminConversationSummary[] = conversations.map((c) => {
    const last = c.messages[0];
    return {
      conversationId: c.id,
      employeeId: c.employee.id,
      employeeName: c.employee.name,
      employeeImage: c.employee.image,
      lastMessageBody: last?.body ?? null,
      lastMessageAt: last ? last.createdAt.toISOString() : null,
      lastSenderRole: last ? last.senderRole : null,
      unreadFromEmployee: unreadMap.get(c.id) ?? 0,
    };
  });

  // Sort: unread first, then by lastMessageAt desc, then alphabetic.
  summaries.sort((a, b) => {
    if (a.unreadFromEmployee !== b.unreadFromEmployee) {
      return b.unreadFromEmployee - a.unreadFromEmployee;
    }
    if (a.lastMessageAt && b.lastMessageAt) {
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    }
    if (a.lastMessageAt) return -1;
    if (b.lastMessageAt) return 1;
    return a.employeeName.localeCompare(b.employeeName);
  });

  return { success: true, data: summaries };
}

export async function getAdminChat(
  employeeId: string
): Promise<{ success: true; data: AdminChatPayload } | { success: false; error: string }> {
  const a = await requireUser();
  if ("error" in a) return { success: false, error: a.error };
  if (!isAdminRole(a.role)) return { success: false, error: "Not authorized" };

  const employee = await db.user.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, image: true, role: true },
  });
  if (!employee || employee.role !== "EMPLOYEE") {
    return { success: false, error: "Employee not found" };
  }

  const conversation = await findOrCreateConversationForEmployee(employee.id);

  const messages = await db.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { name: true } } },
  });

  // Mark all employee-sent messages as read by admin.
  const now = new Date();
  await db.chatMessage.updateMany({
    where: {
      conversationId: conversation.id,
      senderRole: "EMPLOYEE",
      readByAdminAt: null,
    },
    data: { readByAdminAt: now },
  });

  return {
    success: true,
    data: {
      conversationId: conversation.id,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeImage: employee.image,
      messages: messages.map(toMessageDTO),
    },
  };
}

export async function sendChatMessage(
  conversationId: string,
  body: string
): Promise<{ success: true; data: ChatMessageDTO } | { success: false; error: string }> {
  const a = await requireUser();
  if ("error" in a) return { success: false, error: a.error };

  const trimmed = body.trim();
  if (!trimmed) return { success: false, error: "Message cannot be empty" };
  if (trimmed.length > 4000) {
    return { success: false, error: "Message is too long (max 4000 characters)" };
  }

  const conversation = await db.chatConversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) return { success: false, error: "Conversation not found" };

  const senderRole: "EMPLOYEE" | "ADMIN" = isAdminRole(a.role) ? "ADMIN" : "EMPLOYEE";

  // An employee can only post in their own conversation.
  if (senderRole === "EMPLOYEE" && conversation.employeeId !== a.user.id) {
    return { success: false, error: "Not authorized" };
  }

  const now = new Date();

  const message = await db.chatMessage.create({
    data: {
      conversationId,
      senderId: a.user.id,
      senderRole,
      body: trimmed,
      // Auto-mark the sender's own side as read.
      readByAdminAt: senderRole === "ADMIN" ? now : null,
      readByEmployeeAt: senderRole === "EMPLOYEE" ? now : null,
    },
    include: { sender: { select: { name: true } } },
  });

  await db.chatConversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: now,
      ...(senderRole === "EMPLOYEE"
        ? { lastEmployeeMessageAt: now }
        : { lastAdminMessageAt: now }),
    },
  });

  return { success: true, data: toMessageDTO(message) };
}

export async function markChatRead(
  conversationId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const a = await requireUser();
  if ("error" in a) return { success: false, error: a.error };

  const conversation = await db.chatConversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) return { success: false, error: "Conversation not found" };

  const now = new Date();

  if (isAdminRole(a.role)) {
    await db.chatMessage.updateMany({
      where: {
        conversationId,
        senderRole: "EMPLOYEE",
        readByAdminAt: null,
      },
      data: { readByAdminAt: now },
    });
  } else {
    if (conversation.employeeId !== a.user.id) {
      return { success: false, error: "Not authorized" };
    }
    await db.chatMessage.updateMany({
      where: {
        conversationId,
        senderRole: "ADMIN",
        readByEmployeeAt: null,
      },
      data: { readByEmployeeAt: now },
    });
  }

  return { success: true };
}
