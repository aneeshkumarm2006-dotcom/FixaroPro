"use client";

import Card from "@/components/ui/Card";
import { MessageCircle, ExternalLink, AlertCircle } from "lucide-react";
import {
  ChatChannelsConfig,
  ChatRole,
  filterChannelsForRole,
} from "./types";

interface ChatClientProps {
  role: ChatRole;
  config: ChatChannelsConfig;
}

export default function ChatClient({ role, config }: ChatClientProps) {
  const channels = filterChannelsForRole(config, role);

  return (
    <div className="max-w-[60rem] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl !font-light tracking-tight text-[#005F6A]">
          Chat
        </h1>
        <p className="text-sm text-[#005F6A]/70 !font-light mt-1">
          Open team WhatsApp channels available for your role
        </p>
      </div>

      {channels.length === 0 ? (
        <Card variant="ghost" className="p-8">
          <p className="text-sm text-[#005F6A]/60 text-center">
            No chat channels are configured for your role yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {channels.map((channel) => {
            const hasUrl = channel.url.trim().length > 0;
            return (
              <Card
                key={channel.key}
                variant="default"
                className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2.5 bg-[#005F6A]/10 rounded-xl">
                      <MessageCircle className="w-5 h-5 text-[#005F6A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-[400] text-[#005F6A]">
                        {channel.label}
                      </h2>
                      <p className="text-xs text-[#005F6A]/60 mt-1">
                        {channel.description}
                      </p>
                    </div>
                  </div>
                  {hasUrl ? (
                    <a
                      href={channel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#005F6A] text-white text-sm font-[350] hover:bg-[#005F6A]/90 transition-colors whitespace-nowrap">
                      Open
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-50 text-yellow-700 text-xs font-[350] whitespace-nowrap">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Not configured
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
