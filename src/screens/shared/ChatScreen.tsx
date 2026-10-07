import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { getMessages, markConversationRead, openBookingConversation, openProviderConversation, sendMessage, subscribeToConversation } from '../../api/chat';
import { EmptyState, ErrorState, Header, Loading, Screen } from '../../components/ui';
import { formatTime } from '../../lib/format';
import { errorKey } from '../../lib/errors';
import type { ChatMessage } from '../../types';
import type { ScreenProps } from '../../navigation/types';

export function ChatScreen({ route }: ScreenProps<'Chat'>) {
  const { colors } = useTheme();
  const { t, lang, isRTL } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const [conversationId, setConversationId] = useState<string | null>(route.params.conversationId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const addMessage = useCallback((m: ChatMessage) => setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m])), []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let id = conversationId;
      if (!id) {
        if (route.params.bookingId) id = await openBookingConversation(route.params.bookingId);
        else if (route.params.providerProfileId) id = await openProviderConversation(route.params.providerProfileId);
        if (id) setConversationId(id);
      }
      if (!id) throw new Error('err.notFound');
      setMessages(await getMessages(id));
      markConversationRead(id).catch(() => {});
    } catch (e) { setError(e); } finally { setLoading(false); }
  }, [conversationId, route.params.bookingId, route.params.providerProfileId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!conversationId) return;
    return subscribeToConversation(conversationId, m => { addMessage(m); if (m.sender_id !== user?.id) markConversationRead(conversationId).catch(() => {}); });
  }, [conversationId, addMessage, user?.id]);

  useEffect(() => { const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60); return () => clearTimeout(id); }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !conversationId || sending) return;
    setSending(true);
    try { addMessage(await sendMessage(conversationId, body)); setText(''); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); }
    finally { setSending(false); }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={route.params.title ?? t('chat.title')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={load} /> : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}
            ListEmptyComponent={<EmptyState icon="chatbubble-outline" title={t('chat.noMessages')} text={t('chat.startHint')} />}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              return (
                <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  <View style={{ maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: mine ? colors.primary : colors.surface, borderWidth: mine ? 0 : 1, borderColor: colors.border }}>
                    <Text style={{ color: mine ? colors.onPrimary : colors.text, fontSize: 15, lineHeight: 21 }}>{item.body}</Text>
                    <Text style={{ color: mine ? colors.onPrimary : colors.textMuted, opacity: 0.75, fontSize: 10, marginTop: 3, alignSelf: 'flex-end' }}>{formatTime(item.created_at, lang)}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}
        <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, alignItems: 'flex-end' }}>
          <TextInput value={text} onChangeText={setText} placeholder={t('chat.placeholder')} placeholderTextColor={colors.textMuted} multiline maxLength={4000}
            textAlign={isRTL ? 'right' : 'left'}
            style={[{ flex: 1, maxHeight: 110, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.background, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
          <Pressable onPress={send} disabled={!text.trim() || sending || !conversationId} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: !text.trim() || sending ? 0.5 : 1 }}>
            <Ionicons name="send" size={18} color={colors.onPrimary} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
