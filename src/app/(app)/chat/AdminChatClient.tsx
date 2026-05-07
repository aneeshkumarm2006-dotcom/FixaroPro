"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, MessageCircle, User as UserIcon, Search } from "lucide-react";
import useSWR from "swr";
import {
  getAdminChat,
  getAdminChatList,
  sendChatMessage,
} from "./actions";
import type {
  AdminChatPayload,
  AdminConversationSummary,
} from "./types";
import MessageBubble from "./MessageBubble";

interface AdminChatClientProps {
  initialList: AdminConversationSummary[];
}

function formatRelative(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  const diff = now.getTime() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < 7 * day) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AdminChatClient({ initialList }: AdminChatClientProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    initialList[0]?.employeeId ?? null
  );
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: list, mutate: mutateList } = useSWR<AdminConversationSummary[]>(
    "admin-chat-list",
    async () => {
      const res = await getAdminChatList();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    {
      fallbackData: initialList,
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  const { data: chat, mutate: mutateChat } = useSWR<AdminChatPayload | null>(
    selectedEmployeeId ? ["admin-chat", selectedEmployeeId] : null,
    async () => {
      if (!selectedEmployeeId) return null;
      const res = await getAdminChat(selectedEmployeeId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    {
      refreshInterval: 3000,
      revalidateOnFocus: true,
    }
  );

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = list ?? [];
    if (!q) return items;
    return items.filter((s) => s.employeeName.toLowerCase().includes(q));
  }, [list, search]);

  const totalUnread = useMemo(
    () => (list ?? []).reduce((acc, s) => acc + s.unreadFromEmployee, 0),
    [list]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat?.messages.length, selectedEmployeeId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !chat?.conversationId || sending) return;
    setSending(true);
    setDraft("");
    const res = await sendChatMessage(chat.conversationId, body);
    setSending(false);
    if (!res.success) {
      setDraft(body);
      return;
    }
    await Promise.all([mutateChat(), mutateList()]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 sm:px-8 pt-6 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl !font-light tracking-tight text-[#005F6A]">
              Chat
            </h1>
            <p className="text-sm text-[#005F6A]/70 !font-light mt-1">
              Direct messages with your employees
            </p>
          </div>
          {totalUnread > 0 && (
            <div className="px-3 py-1.5 rounded-full bg-[#005F6A] text-white text-xs font-[400]">
              {totalUnread} unread
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 sm:px-8 pb-6">
        <div className="h-full flex gap-4 rounded-2xl border border-[#005F6A]/10 bg-white overflow-hidden">
          {/* Sidebar */}
          <aside className="w-72 flex-shrink-0 flex flex-col border-r border-[#005F6A]/10">
            <div className="p-3 border-b border-[#005F6A]/10">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#005F6A]/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employees…"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-[#005F6A]/5 text-[#005F6A] placeholder:text-[#005F6A]/40 outline-none focus:bg-[#005F6A]/8"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredList.length === 0 ? (
                <p className="p-4 text-xs text-[#005F6A]/50 text-center">
                  No employees yet.
                </p>
              ) : (
                <ul>
                  {filteredList.map((s) => {
                    const active = s.employeeId === selectedEmployeeId;
                    const previewPrefix =
                      s.lastSenderRole === "ADMIN" ? "You: " : "";
                    return (
                      <li key={s.conversationId}>
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeId(s.employeeId)}
                          className={`w-full text-left px-3 py-3 flex items-start gap-3 border-b border-[#005F6A]/5 transition-colors ${
                            active
                              ? "bg-[#005F6A]/8"
                              : "hover:bg-[#005F6A]/5"
                          }`}>
                          <div className="w-9 h-9 rounded-full bg-[#005F6A]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {s.employeeImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={s.employeeImage}
                                alt={s.employeeName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <UserIcon className="w-4 h-4 text-[#005F6A]/60" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-sm truncate ${
                                  s.unreadFromEmployee > 0
                                    ? "font-[500] text-[#005F6A]"
                                    : "font-[400] text-[#005F6A]"
                                }`}>
                                {s.employeeName}
                              </span>
                              <span className="text-[10px] text-[#005F6A]/50 flex-shrink-0">
                                {formatRelative(s.lastMessageAt)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <span className="text-xs text-[#005F6A]/60 truncate">
                                {s.lastMessageBody
                                  ? `${previewPrefix}${s.lastMessageBody}`
                                  : "No messages yet"}
                              </span>
                              {s.unreadFromEmployee > 0 && (
                                <span className="text-[10px] font-[500] bg-[#005F6A] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0">
                                  {s.unreadFromEmployee}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Thread */}
          <section className="flex-1 min-w-0 flex flex-col">
            {!chat ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="p-3 bg-[#005F6A]/10 rounded-2xl mb-3">
                  <MessageCircle className="w-6 h-6 text-[#005F6A]" />
                </div>
                <p className="text-sm text-[#005F6A]/60">
                  Select an employee to start chatting.
                </p>
              </div>
            ) : (
              <>
                <header className="px-5 py-3 border-b border-[#005F6A]/10 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#005F6A]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {chat.employeeImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={chat.employeeImage}
                        alt={chat.employeeName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-4 h-4 text-[#005F6A]/60" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-[400] text-[#005F6A] truncate">
                      {chat.employeeName}
                    </h2>
                    <p className="text-[11px] text-[#005F6A]/50">Employee</p>
                  </div>
                </header>

                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                  {chat.messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-sm text-[#005F6A]/50">
                        No messages yet. Send the first one.
                      </p>
                    </div>
                  ) : (
                    chat.messages.map((m) => (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        isMine={m.senderRole === "ADMIN"}
                      />
                    ))
                  )}
                </div>

                <div className="px-5 py-3 border-t border-[#005F6A]/10">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      placeholder="Type a message…"
                      className="flex-1 resize-none rounded-2xl bg-[#005F6A]/5 hover:bg-[#005F6A]/7 focus:bg-white focus:outline focus:outline-1 focus:outline-[#005F6A]/30 px-4 py-3 text-sm text-[#005F6A] placeholder:text-[#005F6A]/40 max-h-32"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={sending || draft.trim().length === 0}
                      className="p-3 rounded-2xl bg-[#005F6A] text-white disabled:opacity-40 hover:bg-[#005F6A]/90 transition-colors">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
