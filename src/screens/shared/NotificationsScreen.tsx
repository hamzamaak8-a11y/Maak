import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { listNotifications, markAllNotificationsRead, markNotificationRead, subscribeToNotifications } from '../../api/notifications';
import { LoginRequired } from '../../components/Common';
import { Button, EmptyState, ErrorState, Header, Loading, Row, Screen, useAsync } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import type { TKey } from '../../i18n/en';
import type { AppNotification } from '../../types';
import type { ScreenProps } from '../../navigation/types';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  booking_new: 'calendar', booking_accepted: 'checkmark-circle', booking_rejected: 'close-circle', booking_cancelled: 'remove-circle',
  booking_started: 'play-circle', booking_completed: 'checkmark-done-circle', new_message: 'chatbubble', review_received: 'star',
};

export function NotificationsScreen({ navigation }: ScreenProps<'Notifications'>) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { data, setData, loading, error, reload } = useAsync(() => (user ? listNotifications(80, 0) : Promise.resolve([] as AppNotification[])), [user?.id]);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.id, n => setData(prev => [n, ...(prev ?? [])]));
  }, [user, setData]);

  const text = useCallback((raw: string) => { const out = t(raw as TKey); return out === raw && raw.includes('.') ? '' : out; }, [t]);

  const open = async (n: AppNotification) => {
    if (!n.is_read) { setData(prev => (prev ?? []).map(x => (x.id === n.id ? { ...x, is_read: true } : x))); markNotificationRead(n.id).catch(() => {}); }
    const m = n.metadata ?? {};
    if (typeof m.conversation_id === 'string') navigation.navigate('Chat', { conversationId: m.conversation_id, title: t('chat.title') });
    else if (typeof m.booking_id === 'string') navigation.navigate('BookingDetail', { id: m.booking_id });
  };

  const readAll = async () => {
    setData(prev => (prev ?? []).map(x => ({ ...x, is_read: true })));
    markAllNotificationsRead().catch(() => reload());
  };

  if (!user) return <Screen><Header title={t('notifications.title')} /><LoginRequired icon="notifications-outline" /></Screen>;
  const hasUnread = (data ?? []).some(n => !n.is_read);

  return (
    <Screen>
      <Header title={t('notifications.title')} right={hasUnread ? <Pressable onPress={readAll} hitSlop={8}><Ionicons name="checkmark-done" size={22} color={colors.primary} /></Pressable> : undefined} />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <FlatList
          data={data ?? []}
          keyExtractor={n => n.id}
          contentContainerStyle={{ padding: 16, gap: 8, width: '100%', maxWidth: 720, alignSelf: 'center' }}
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title={t('notifications.empty')} text={t('notifications.emptyText')} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: item.is_read ? colors.border : colors.primary, backgroundColor: item.is_read ? colors.surface : colors.primaryLight }}>
              <Ionicons name={ICONS[item.type] ?? 'notifications'} size={24} color={colors.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>{text(item.title) || t('notifications.generic')}</Text>
                {text(item.body) ? <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>{text(item.body)}</Text> : null}
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{formatDateTime(item.created_at, lang)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
