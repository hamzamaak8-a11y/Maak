import React from 'react';
import { RefreshControl, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { overviewStats } from '../../api/admin';
import { BellButton } from '../../components/Common';
import { ActionTile, AttentionRow, MiniBars, StatTile } from '../../components/AdminWidgets';
import { Button, Card, ErrorState, Loading, Muted, Page, Row, Screen, SectionTitle, useAsync } from '../../components/ui';
import { formatMoney } from '../../lib/format';
import type { Nav } from '../../navigation/types';

export function AdminHomeScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const [refreshing, setRefreshing] = React.useState(false);
  const { data: s, loading, error, reload } = useAsync(() => overviewStats(), []);
  useFocusEffect(React.useCallback(() => { void reload(); }, [reload]));

  const paid = s ? Object.entries(s.paid_30d) : [];
  const paidLabel = paid.length ? paid.map(([cur, v]) => formatMoney(Number(v), cur, lang)).join(' · ') : '—';
  const dayLabel = (key: string) => new Date(key + 'T00:00:00Z').getUTCDate().toString();

  return (
    <Screen>
      <Page refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={colors.primary} />}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }} gap={12}>
          <View style={{ flex: 1 }}>
            <Muted>{t('admin.welcomeBack')}</Muted>
            <Text accessibilityRole="header" numberOfLines={1} style={{ color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>{profile?.full_name || t('admin.title')}</Text>
          </View>
          {wide ? <Button title={t('admin.addUser')} icon="person-add-outline" size="sm" onPress={() => nav.navigate('AdminCreateUser')} /> : null}
          <BellButton />
        </Row>
        {!wide ? <Button title={t('admin.addUser')} icon="person-add-outline" onPress={() => nav.navigate('AdminCreateUser')} /> : null}

        {loading && !s ? <Loading /> : error && !s ? <ErrorState error={error} onRetry={reload} /> : s ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              <StatTile wide={wide} icon="people" color={colors.info} label={t('admin.customers')} value={s.customers} hint={t('admin.newThisWeek', { n: s.new_users_7d })} onPress={() => nav.navigate('AdminUsers')} />
              <StatTile wide={wide} icon="briefcase" color={colors.primary} label={t('admin.providers')} value={s.providers} hint={t('admin.approvedCount', { n: s.approved_providers })} onPress={() => nav.navigate('AdminUsers')} />
              <StatTile wide={wide} icon="calendar" color={colors.accent} label={t('admin.bookings')} value={s.total_bookings} hint={t('admin.last30', { n: s.bookings_30d })} onPress={() => nav.navigate('AdminBookings')} />
              <StatTile wide={wide} icon="cash" color={colors.success} label={t('admin.paid30')} value={paid.length > 1 ? `${paid.length} ${t('admin.currencies')}` : paidLabel} hint={paid.length > 1 ? paidLabel : t('admin.completed30', { n: s.completed_30d })} onPress={() => nav.navigate('AdminBookings')} />
            </View>

            <View style={{ flexDirection: wide ? 'row' : 'column', gap: 18, alignItems: 'flex-start' }}>
              <Card style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 4 }}>
                <SectionTitle title={t('admin.needsAttention')} />
                <AttentionRow icon="document-text" tone="warning" label={t('admin.pendingApplications')} count={s.pending_applications} onPress={() => nav.navigate('AdminApplications')} />
                <AttentionRow icon="flag" tone="error" label={t('admin.openReports')} count={s.open_reports} onPress={() => nav.navigate('AdminReports')} />
                <AttentionRow icon="card" tone="info" label={t('admin.unpaidCompleted')} count={s.unpaid_completed} onPress={() => nav.navigate('AdminBookings')} />
                <AttentionRow icon="ban" tone="error" label={t('admin.suspendedAccounts')} count={s.suspended_accounts} onPress={() => nav.navigate('AdminUsers')} />
              </Card>
              <Card style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 14 }}>
                <SectionTitle title={t('admin.activity14')} />
                <Muted>{t('admin.bookingsPerDay')}</Muted>
                <MiniBars color={colors.primary} data={s.daily.map(d => ({ key: d.day, value: Number(d.bookings) }))} labelFor={dayLabel} />
                <Muted>{t('admin.newUsersPerDay')}</Muted>
                <MiniBars color={colors.info} data={s.daily.map(d => ({ key: d.day, value: Number(d.users) }))} labelFor={dayLabel} />
              </Card>
            </View>

            <SectionTitle title={t('admin.quickActions')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <ActionTile icon="person-add" color={colors.primary} label={t('admin.addUser')} onPress={() => nav.navigate('AdminCreateUser')} />
              <ActionTile icon="cloud-upload" color={colors.info} label={t('admin.importCsv')} onPress={() => nav.navigate('AdminCreateUser', { mode: 'csv' })} />
              <ActionTile icon="megaphone" color={colors.accent} label={t('admin.announcements')} onPress={() => nav.navigate('AdminAnnouncements')} />
              <ActionTile icon="shield-checkmark" color={colors.success} label={t('admin.applications')} onPress={() => nav.navigate('AdminApplications')} />
              <ActionTile icon="star" color={colors.warning} label={t('admin.reviews')} onPress={() => nav.navigate('AdminReviews')} />
              <ActionTile icon="list" color={colors.textSecondary} label={t('admin.audit')} onPress={() => nav.navigate('AdminAudit')} />
            </View>
          </>
        ) : null}
      </Page>
    </Screen>
  );
}
