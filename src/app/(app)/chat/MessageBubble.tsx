"use client";

import type { ChatMessageDTO } from "./types";

interface MessageBubbleProps {
  message: ChatMessageDTO;
  isMine: boolean;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MessageBubble({ message, isMine }: MessageBubbleProps) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isMine
            ? "bg-[#005F6A] text-white"
            : "bg-[#005F6A]/8 text-[#005F6A]"
        }`}>
        {!isMine && (
          <div className="text-[10px] font-[400] opacity-70 mb-0.5">
            {message.senderName}
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap break-words leading-snug">
          {message.body}
        </div>
        <div
          className={`text-[10px] mt-1 ${
            isMine ? "text-white/70" : "text-[#005F6A]/50"
          }`}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
