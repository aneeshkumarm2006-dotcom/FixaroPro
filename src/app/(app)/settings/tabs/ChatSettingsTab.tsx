"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { updateAppSetting } from "../../actions/updateAppSetting";
import { AppSettingRecord, getSetting } from "../types";
import { SectionCard, Field, Feedback, Msg } from "./_shared";
import {
  CHAT_CHANNELS_KEY,
  ChannelKey,
  ChatChannel,
  ChatChannelsConfig,
  ChatRole,
  DEFAULT_CHAT_CHANNELS,
} from "../../chat/types";

interface ChatSettingsTabProps {
  settings: AppSettingRecord[];
}

const ROLE_LABELS: { role: ChatRole; label: string }[] = [
  { role: "OWNER", label: "Owner" },
  { role: "ADMIN", label: "Admin" },
  { role: "EMPLOYEE", label: "Employee" },
];

function mergeWithDefaults(
  config: ChatChannelsConfig
): ChatChannelsConfig {
  const byKey = new Map<ChannelKey, ChatChannel>();
  for (const c of DEFAULT_CHAT_CHANNELS.channels) byKey.set(c.key, c);
  for (const c of config.channels ?? []) {
    const base = byKey.get(c.key);
    if (base) {
      byKey.set(c.key, {
        ...base,
        url: c.url ?? "",
        visibleTo:
          Array.isArray(c.visibleTo) && c.visibleTo.length > 0
            ? c.visibleTo
            : base.visibleTo,
      });
    }
  }
  return { channels: Array.from(byKey.values()) };
}

export default function ChatSettingsTab({ settings }: ChatSettingsTabProps) {
  const initial = useMemo(
    () =>
      mergeWithDefaults(
        getSetting<ChatChannelsConfig>(
          settings,
          CHAT_CHANNELS_KEY,
          DEFAULT_CHAT_CHANNELS
        )
      ),
    [settings]
  );

  const [config, setConfig] = useState<ChatChannelsConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  function updateChannel(
    key: ChannelKey,
    patch: Partial<Pick<ChatChannel, "url" | "visibleTo">>
  ) {
    setConfig((prev) => ({
      channels: prev.channels.map((c) =>
        c.key === key ? { ...c, ...patch } : c
      ),
    }));
  }

  function toggleRole(key: ChannelKey, role: ChatRole) {
    setConfig((prev) => ({
      channels: prev.channels.map((c) => {
        if (c.key !== key) return c;
        const has = c.visibleTo.includes(role);
        const next = has
          ? c.visibleTo.filter((r) => r !== role)
          : [...c.visibleTo, role];
        return { ...c, visibleTo: next };
      }),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const res = await updateAppSetting({
      key: CHAT_CHANNELS_KEY,
      category: "chat",
      value: config,
    });
    if (res.success) {
      setMsg({ type: "success", text: "Chat channels saved." });
    } else {
      setMsg({ type: "error", text: res.error || "Failed to save." });
    }
    setSaving(false);
  }

  return (
    <SectionCard
      title="Chat Channels"
      description="Configure WhatsApp group invite links and which roles can see each channel."
      icon={MessageCircle}>
      <div className="space-y-5">
        {config.channels.map((channel) => (
          <div
            key={channel.key}
            className="p-4 rounded-2xl border border-[#005F6A]/10 bg-white space-y-3">
            <div>
              <h3 className="text-sm font-[400] text-[#005F6A]">
                {channel.label}
              </h3>
              <p className="text-xs text-[#005F6A]/60 mt-0.5">
                {channel.description}
              </p>
            </div>
            <Field label="WhatsApp Invite URL">
              <Input
                variant="form"
                type="url"
                value={channel.url}
                onChange={(e) =>
                  updateChannel(channel.key, { url: e.target.value })
                }
                placeholder="https://chat.whatsapp.com/..."
              />
            </Field>
            <Field label="Visible to roles">
              <div className="flex gap-2 flex-wrap">
                {ROLE_LABELS.map(({ role, label }) => {
                  const active = channel.visibleTo.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(channel.key, role)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-[350] transition-colors ${
                        active
                          ? "bg-[#005F6A] text-white"
                          : "bg-[#005F6A]/5 text-[#005F6A] hover:bg-[#005F6A]/10"
                      }`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        ))}
      </div>

      {msg && <Feedback msg={msg} />}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="action"
          border={false}
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl px-6 py-2.5">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </SectionCard>
  );
}
