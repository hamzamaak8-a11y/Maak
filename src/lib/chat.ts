import { supabase } from "./supabaseClient";

export type Conversation = {
  conversation_id: string;
  booking_id: string | null;
  other_user_id: string;
  other_user_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

function throwChatError(error: unknown, fallback: string): never {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  if (/not_authenticated/i.test(message)) throw new Error("chat.notAuthenticated");
  if (/provider_not_bookable/i.test(message)) throw new Error("chat.providerUnavailable");
  if (/empty_message/i.test(message)) throw new Error("chat.emptyMessage");
  if (/message_too_long/i.test(message)) throw new Error("chat.messageTooLong");
  if (/forbidden/i.test(message)) throw new Error("chat.forbidden");
  throw new Error(fallback);
}

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc("list_my_conversations");
  if (error) throwChatError(error, "chat.loadFail");
  return ((data ?? []) as Array<Conversation & { unread_count: number }>).map((row) => ({
    ...row,
    unread_count: Number(row.unread_count ?? 0),
  }));
}

export async function getOrCreateProviderConversation(providerProfileId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_provider_conversation", {
    p_provider_profile_id: providerProfileId,
  });
  if (error) throwChatError(error, "chat.openFail");
  return String(data);
}

export async function getOrCreateBookingConversation(bookingId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_booking_conversation", {
    p_booking_id: bookingId,
  });
  if (error) throwChatError(error, "chat.openFail");
  return String(data);
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc("get_conversation_messages", {
    p_conversation_id: conversationId,
  });
  if (error) throwChatError(error, "chat.loadMessagesFail");
  return (data ?? []) as ChatMessage[];
}

export async function sendMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const { data, error } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversationId,
    p_body: body,
  });
  if (error) throwChatError(error, "chat.sendFail");
  return data as ChatMessage;
}

export async function markRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_chat_read", {
    p_conversation_id: conversationId,
  });
  if (error) throwChatError(error, "chat.readFail");
}
