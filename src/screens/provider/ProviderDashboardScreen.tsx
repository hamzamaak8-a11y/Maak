import React, { useCallback, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchDashboardStats, myListingId } from '../../api/provider';
import { BellButton } from '../../components/Common';
import { Banner, Card, ErrorState, Loading, Muted, Page, Row, SectionTitle, Screen, StatusBadge, Stars, useAsync } from '../../components/ui';
import { formatDateTime, formatMoney } from '../../lib/format';
import type { Nav } from '../../navigation/types';

export function ProviderDashboardScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, error, reload } = useAsync(async () => ({ stats: await fetchDashboardStats(), listingId: await myListingId().catch(() => null) }), []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const s = data?.stats;
  return (
    <Screen>
      <Page refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={colors.primary} />}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Muted>{t('home.hello')}</Muted>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{profile?.full_name ?? ''}</Text>
          </View>
          <BellButton />
        </Row>
        {loading && !s ? <Loading /> : error && !s ? <ErrorState error={error} onRetry={reload} /> : s ? (
          <>
            {data?.listingId == null ? <Banner kind="warning" text={t('dashboard.noListing')} /> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Stat icon="checkmark-done" label={t('dashboard.completed')} value={String(s.total_completed_bookings)} color={colors.success} />
              <Stat icon="cash-outline" label={t('dashboard.earnings')} value={s.total_earnings != null && s.total_earnings_currency ? formatMoney(s.total_earnings, s.total_earnings_currency, lang) : '—'} color={colors.primary} />
              <Stat icon="star" label={t('dashboard.rating')} value={s.total_reviews ? s.average_rating.toFixed(1) : '—'} color={colors.accent} />
              <Stat icon="chatbox-ellipses-outline" label={t('dashboard.reviews')} value={String(s.total_reviews)} color={colors.info} />
            </View>
            <SectionTitle title={t('dashboard.upcoming')} action={t('common.seeAll')} onAction={() => nav.navigate('ProviderTabs', { screen: 'RequestsTab' })} />
            {s.upcoming_bookings.length === 0 ? <Card><Muted>{t('dashboard.noUpcoming')}</Muted></Card> : s.upcoming_bookings.map(b => (
              <Card key={b.id} onPress={() => nav.navigate('BookingDetail', { id: b.id })} style={{ gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}><Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>{b.service_category}</Text><StatusBadge status={b.status} /></Row>
                <Muted>{b.customer_name} · {formatDateTime(b.service_date, lang)}</Muted>
              </Card>
            ))}
          </>
        ) : null}
      </Page>
    </Screen>
  );
}

function Stat({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 }}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
