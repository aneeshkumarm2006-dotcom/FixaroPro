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
    hour12: true,
  });
}

export default function MessageBubble({ message, isMine }: MessageBubbleProps) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isMine
            ? "bg-[#e85d04] text-white"
            : "bg-[#e85d04]/8 text-[#1c1917]"
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
          className={`text-[9px] mt-0.5 ${
            isMine ? "text-white/50 text-right" : "text-[#1c1917]/40"
          }`}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
