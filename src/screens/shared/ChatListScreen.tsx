import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { listConversations } from '../../api/chat';
import { LoginRequired } from '../../components/Common';
import { Avatar, EmptyState, ErrorState, Header, Loading, Row, Screen, useAsync } from '../../components/ui';
import { formatDate, formatTime } from '../../lib/format';
import type { Nav } from '../../navigation/types';

export function ChatListScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, error, reload } = useAsync(() => (user ? listConversations() : Promise.resolve([])), [user?.id]);
  useFocusEffect(useCallback(() => { if (user) void reload(); }, [user?.id, reload]));

  if (!user) return <Screen><Header title={t('chat.title')} noBack /><LoginRequired icon="chatbubbles-outline" /></Screen>;

  const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

  return (
    <Screen>
      <Header title={t('chat.title')} noBack />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <FlatList
          data={data ?? []}
          keyExtractor={c => c.conversation_id}
          contentContainerStyle={{ padding: 16, gap: 8, width: '100%', maxWidth: 720, alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title={t('chat.empty')} text={t('chat.emptyText')} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => nav.navigate('Chat', { conversationId: item.conversation_id, title: item.other_user_name ?? t('chat.user') })}
              style={{ flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <Avatar name={item.other_user_name ?? '?'} size={46} />
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', fontSize: 15, flex: 1 }}>{item.other_user_name ?? t('chat.user')}</Text>
                  {item.last_message_at ? <Text style={{ color: colors.textMuted, fontSize: 11 }}>{sameDay(item.last_message_at) ? formatTime(item.last_message_at, lang) : formatDate(item.last_message_at, lang)}</Text> : null}
                </Row>
                <Text numberOfLines={1} style={{ color: item.unread_count ? colors.text : colors.textSecondary, fontSize: 13, fontWeight: item.unread_count ? '700' : '400' }}>{item.last_message ?? t('chat.noMessages')}</Text>
              </View>
              {item.unread_count > 0 ? <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ color: colors.onPrimary, fontSize: 11, fontWeight: '800' }}>{item.unread_count}</Text></View> : null}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
