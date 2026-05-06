import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import ChatClient from "./ChatClient";
import {
  CHAT_CHANNELS_KEY,
  DEFAULT_CHAT_CHANNELS,
  type ChatChannelsConfig,
} from "./types";

export default async function ChatPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const userWithRole = session.user as typeof session.user & {
    role: "OWNER" | "ADMIN" | "EMPLOYEE";
  };

  const setting = await db.appSetting.findUnique({
    where: { key: CHAT_CHANNELS_KEY },
  });

  const config =
    (setting?.value as ChatChannelsConfig | undefined) ?? DEFAULT_CHAT_CHANNELS;

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <ChatClient role={userWithRole.role} config={config} />
    </div>
  );
}
