"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Shield } from "lucide-react";
import useSWR from "swr";
import {
  getEmployeeChat,
  sendChatMessage,
} from "./actions";
import type { EmployeeChatPayload } from "./types";
import MessageBubble from "./MessageBubble";

interface EmployeeChatClientProps {
  initial: EmployeeChatPayload;
}

export default function EmployeeChatClient({ initial }: EmployeeChatClientProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, mutate } = useSWR<EmployeeChatPayload>(
    "employee-chat",
    async () => {
      const res = await getEmployeeChat();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    {
      fallbackData: initial,
      refreshInterval: 3000,
      revalidateOnFocus: true,
    }
  );

  const messages = data?.messages ?? [];
  const conversationId = data?.conversationId ?? initial.conversationId;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !conversationId || sending) return;
    setSending(true);
    setDraft("");
    const res = await sendChatMessage(conversationId, body);
    setSending(false);
    if (!res.success) {
      setDraft(body);
      return;
    }
    await mutate();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="h-full flex flex-col max-w-[60rem] mx-auto px-4 sm:px-6 py-6">
      <header className="flex items-center gap-3 pb-4 border-b border-[#005F6A]/10">
        <div className="p-2.5 bg-[#005F6A]/10 rounded-xl">
          <Shield className="w-5 h-5 text-[#005F6A]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-[400] text-[#005F6A]">Admin</h1>
          <p className="text-xs text-[#005F6A]/60">
            Direct line to your manager
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-4 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-[#005F6A]/50">
              No messages yet. Say hi to your admin.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isMine={m.senderRole === "EMPLOYEE"}
            />
          ))
        )}
      </div>

      <div className="pt-3 border-t border-[#005F6A]/10">
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
    </div>
  );
}
