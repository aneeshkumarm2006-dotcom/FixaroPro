export type ChatRole = "OWNER" | "ADMIN" | "EMPLOYEE";

export type SenderRole = "EMPLOYEE" | "ADMIN";

export interface ChatMessageDTO {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: SenderRole;
  body: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  createdAt: string;
  readByAdminAt: string | null;
  readByEmployeeAt: string | null;
}

export interface AdminConversationSummary {
  conversationId: string;
  employeeId: string;
  employeeName: string;
  employeeImage: string | null;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  lastSenderRole: SenderRole | null;
  unreadFromEmployee: number;
}

export interface EmployeeChatPayload {
  conversationId: string;
  messages: ChatMessageDTO[];
}

export interface AdminChatPayload {
  conversationId: string;
  employeeId: string;
  employeeName: string;
  employeeImage: string | null;
  messages: ChatMessageDTO[];
}
