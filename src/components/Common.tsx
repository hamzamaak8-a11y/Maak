import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { listNotifications, subscribeToNotifications } from '../api/notifications';
import { Avatar, Button, Card, EmptyState, IconButton, Row, Stars } from './ui';
import { ratingNumber } from '../lib/format';
import { categoryLabel } from '../constants/categories';
import type { Nav } from '../navigation/types';
import type { Provider } from '../types';

/** Empty-state shown in place of an account-only area when the visitor is a guest. */
export function LoginRequired({ icon = 'lock-closed-outline', title }: { icon?: keyof typeof Ionicons.glyphMap; title?: string }) {
  const { t } = useLanguage();
  const nav = useNavigation<Nav>();
  return (
    <EmptyState icon={icon} title={title ?? t('guest.title')} text={t('guest.text')}
      action={<View style={{ gap: 10, minWidth: 220 }}>
        <Button title={t('auth.login')} onPress={() => nav.navigate('Login')} />
        <Button title={t('auth.createAccount')} variant="outline" onPress={() => nav.navigate('Signup', { intent: 'customer' })} />
      </View>} />
  );
}

export function BellButton() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const nav = useNavigation<Nav>();
  const [unread, setUnread] = useState(0);
  const uid = user?.id;
  useEffect(() => {
    if (!uid) { setUnread(0); return; }
    let alive = true;
    listNotifications(50, 0).then(rows => { if (alive) setUnread(rows.filter(r => !r.is_read).length); }).catch(() => {});
    const off = subscribeToNotifications(uid, () => setUnread(n => n + 1));
    return () => { alive = false; off(); };
  }, [uid]);
  return <IconButton icon="notifications-outline" label={t('notifications.title')} badge={unread} onPress={() => (user ? nav.navigate('Notifications') : nav.navigate('Login'))} />;
}

export function ProviderCard({ provider, onPress, favorite, onToggleFavorite }: { provider: Provider; onPress: () => void; favorite?: boolean; onToggleFavorite?: () => void }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const rating = ratingNumber(provider.rating);
  return (
    <Card onPress={onPress} style={{ gap: 12 }}>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <Avatar name={provider.name} uri={provider.image} size={56} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{provider.name}</Text>
          <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 13 }}>{provider.job}</Text>
          <Row gap={6}>
            {rating ? <><Stars value={rating} size={13} /><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{rating.toFixed(1)} · {provider.reviews}</Text></>
              : <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('provider.newBadge')}</Text>}
          </Row>
        </View>
        {onToggleFavorite ? (
          <Pressable onPress={onToggleFavorite} hitSlop={10} accessibilityLabel={t('favorites.title')}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={22} color={favorite ? colors.error : colors.textMuted} />
          </Pressable>
        ) : null}
      </Row>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Row gap={4} style={{ flex: 1 }}><Ionicons name="location-outline" size={14} color={colors.textMuted} /><Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>{provider.city}</Text></Row>
        {provider.category ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>{categoryLabel(provider.category, lang)}</Text> : null}
        {provider.price ? <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>{t('provider.from', { price: provider.price })}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
});
