import React, { useEffect, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { listNotifications, subscribeToNotifications } from '../api/notifications';
import { Avatar, Button, Card, EmptyState, IconButton, Row } from './ui';
import { CoverPhoto, useCover } from './ProviderVisual';
import { formatStartingPrice, ratingNumber } from '../lib/format';
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

export function ProviderCard({ provider, onPress, favorite, onToggleFavorite, style }: { provider: Provider; onPress: () => void; favorite?: boolean; onToggleFavorite?: () => void; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const rating = ratingNumber(provider.rating);
  const cover = useCover(provider);
  const startPrice = formatStartingPrice(provider.price, provider.currency, lang);
  return (
    <Card onPress={onPress} padded={false} style={[{ overflow: 'hidden', borderRadius: 24 }, style]}>
      <CoverPhoto provider={provider} uri={cover} height={188}>
        <View style={{ position: 'absolute', top: 12, start: 12, end: 60, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {provider.verified ? <View style={styles.pill}><Ionicons name="shield-checkmark" size={13} color="#1D5FE0" /><Text style={styles.pillText}>{t('provider.verified')}</Text></View> : null}
          {provider.category ? <View style={styles.pill}><Text style={styles.pillText}>{categoryLabel(provider.category, lang)}</Text></View> : null}
          {provider.available !== true ? <View style={[styles.pill, { backgroundColor: 'rgba(10,22,51,0.72)' }]}><Text style={[styles.pillText, { color: '#fff' }]}>{t('provider.notOpenYet')}</Text></View> : null}
        </View>
        {onToggleFavorite ? (
          <Pressable onPress={onToggleFavorite} hitSlop={10} accessibilityLabel={t('favorites.title')} style={{ position: 'absolute', top: 10, end: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={21} color={favorite ? colors.error : '#0A1633'} />
          </Pressable>
        ) : null}
        <View style={{ position: 'absolute', start: 14, end: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={provider.name} uri={provider.image} size={44} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.2 }}>{provider.name}</Text>
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5, fontWeight: '600' }}>{provider.job}</Text>
          </View>
        </View>
      </CoverPhoto>
      <View style={[styles.footer, { padding: 14 }]}>
        <Row gap={6} style={{ flex: 1 }}>
          {rating ? <><Ionicons name="star" size={16} color={colors.accent} /><Text style={{ color: colors.text, fontSize: 14.5, fontWeight: '800' }}>{rating.toFixed(1)}</Text><Text style={{ color: colors.textMuted, fontSize: 14 }}>({provider.reviews})</Text></>
            : <View style={{ backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 }}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>{t('provider.newBadge')}</Text></View>}
          <Ionicons name="location-outline" size={15} color={colors.textMuted} style={{ marginStart: 8 }} /><Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '500', flexShrink: 1 }}>{provider.city}</Text>
        </Row>
        {startPrice ? <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '800' }}>{t('provider.from', { price: startPrice })}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  pillText: { color: '#0A1633', fontSize: 11.5, fontWeight: '800' },
});
