import { supabase } from '../lib/supabase';
import { createRealtimeHub, type HubClient } from '../lib/realtimeHub';
import type { ChatMessage, Conversation } from '../types';

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('list_my_conversations');
  if (error) throw error;
  return ((data ?? []) as Conversation[]).map(c => ({ ...c, unread_count: Number(c.unread_count ?? 0) }));
}

export async function openProviderConversation(providerProfileId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_provider_conversation', { p_provider_profile_id: providerProfileId });
  if (error) throw error;
  return String(data);
}

export async function openBookingConversation(bookingId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_booking_conversation', { p_booking_id: bookingId });
  if (error) throw error;
  return String(data);
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc('get_conversation_messages', { p_conversation_id: conversationId });
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function sendMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const { data, error } = await supabase.rpc('send_chat_message', { p_conversation_id: conversationId, p_body: body });
  if (error) throw error;
  return data as ChatMessage;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_chat_read', { p_conversation_id: conversationId });
  if (error) throw error;
}

const subscribe = createRealtimeHub(supabase as unknown as HubClient);

export function subscribeToConversation(conversationId: string, onMessage: (m: ChatMessage) => void): () => void {
  return subscribe<ChatMessage>(`conversation:${conversationId}:messages`, { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, onMessage);
}
