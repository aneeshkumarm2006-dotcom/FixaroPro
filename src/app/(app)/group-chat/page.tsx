import { requireStaff } from "@/lib/page-guards";
import AdminGroupChatClient from "./AdminGroupChatClient";
import GroupChatClient from "./GroupChatClient";
import {
  listGroupChannels,
  getGroupMessages,
  getTeamChatSettings,
  type GroupMessageDTO,
} from "./groupChat";

// Management roles get the moderator view (manage channels + moderate + chat
// settings); every other staff role (FIELD_LEAD, EMPLOYEE/Pro) gets the
// participant view. Clients are bounced by requireStaff.
function canManage(role: string | undefined): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "OPS_MANAGER";
}

export default async function GroupChatPage() {
  const session = await requireStaff();
  const role = (session.user as { role?: string }).role;

  const list = await listGroupChannels();
  const channels = list.success ? list.data : [];
  const initialChannelId = channels[0]?.id ?? null;

  let initialMessages: GroupMessageDTO[] = [];
  if (initialChannelId) {
    const msgs = await getGroupMessages(initialChannelId);
    if (msgs.success) initialMessages = msgs.data;
  }

  if (canManage(role)) {
    return (
      <div className="h-full overflow-hidden">
        <AdminGroupChatClient
          initialChannels={channels}
          initialChannelId={initialChannelId}
          initialMessages={initialMessages}
          currentUserId={session.user.id}
        />
      </div>
    );
  }

  const settings = await getTeamChatSettings();

  return (
    <div className="h-full overflow-hidden">
      <GroupChatClient
        initialChannels={channels}
        initialChannelId={initialChannelId}
        initialMessages={initialMessages}
        currentUserId={session.user.id}
        userName={session.user.name ?? undefined}
        dmEnabled={settings.success ? settings.data.dmEnabled : true}
      />
    </div>
  );
}
