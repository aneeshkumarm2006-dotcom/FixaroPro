export type ChatRole = "OWNER" | "ADMIN" | "EMPLOYEE";

export type ChannelKey = "general" | "fieldManagers" | "urgent";

export interface ChatChannel {
  key: ChannelKey;
  label: string;
  description: string;
  url: string;
  visibleTo: ChatRole[];
}

export interface ChatChannelsConfig {
  channels: ChatChannel[];
}

export const CHAT_CHANNELS_KEY = "chat.channels";

export const DEFAULT_CHAT_CHANNELS: ChatChannelsConfig = {
  channels: [
    {
      key: "general",
      label: "General",
      description: "Day-to-day team chat for everyone.",
      url: "",
      visibleTo: ["OWNER", "ADMIN", "EMPLOYEE"],
    },
    {
      key: "fieldManagers",
      label: "Field Managers",
      description: "Coordination channel for admins and managers.",
      url: "",
      visibleTo: ["OWNER", "ADMIN"],
    },
    {
      key: "urgent",
      label: "Urgent",
      description: "Time-sensitive issues that need immediate attention.",
      url: "",
      visibleTo: ["OWNER", "ADMIN", "EMPLOYEE"],
    },
  ],
};

export function filterChannelsForRole(
  config: ChatChannelsConfig,
  role: ChatRole
): ChatChannel[] {
  return config.channels.filter((c) => c.visibleTo.includes(role));
}
