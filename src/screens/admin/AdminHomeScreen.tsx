import React from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchAdminStats } from '../../api/admin';
import { BellButton } from '../../components/Common';
import { Button, ErrorState, Loading, Muted, Page, Row, Screen, SectionTitle, useAsync } from '../../components/ui';
import type { Nav } from '../../navigation/types';

export function AdminHomeScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { profile, signOut } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);
  const { data, loading, error, reload } = useAsync(() => fetchAdminStats(), []);
  useFocusEffect(React.useCallback(() => { void reload(); }, [reload]));

  const pending = data?.providers_by_status?.pending ?? 0;
  const tiles: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: number | string; color: string }> = data ? [
    { icon: 'people-outline', label: t('admin.customers'), value: data.total_customers, color: colors.info },
    { icon: 'briefcase-outline', label: t('admin.providers'), value: data.total_providers, color: colors.primary },
    { icon: 'shield-checkmark-outline', label: t('admin.approved'), value: data.approved_providers, color: colors.success },
    { icon: 'calendar-outline', label: t('admin.bookings'), value: data.total_bookings, color: colors.accent },
  ] : [];
  const links: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; screen: 'AdminApplications' | 'AdminUsers' | 'AdminBookings' | 'AdminReviews' | 'AdminAudit' | 'AdminReports'; badge?: number }> = [
    { icon: 'document-text-outline', label: t('admin.applications'), screen: 'AdminApplications', badge: pending },
    { icon: 'people-outline', label: t('admin.users'), screen: 'AdminUsers' },
    { icon: 'calendar-outline', label: t('admin.bookings'), screen: 'AdminBookings' },
    { icon: 'star-outline', label: t('admin.reviews'), screen: 'AdminReviews' },
    { icon: 'flag-outline', label: t('admin.reports'), screen: 'AdminReports' },
    { icon: 'list-outline', label: t('admin.audit'), screen: 'AdminAudit' },
  ];

  return (
    <Screen>
      <Page refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={colors.primary} />}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><Muted>{t('admin.title')}</Muted><Text numberOfLines={1} style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{profile?.full_name || 'Admin'}</Text></View>
          <BellButton />
        </Row>
        {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {tiles.map(tile => (
              <View key={tile.label} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 }}>
                <Ionicons name={tile.icon} size={22} color={tile.color} />
                <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>{tile.value}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{tile.label}</Text>
              </View>
            ))}
          </View>
        )}
        <SectionTitle title={t('admin.manage')} />
        <View style={{ gap: 10 }}>
          {links.map(l => (
            <Pressable key={l.screen} onPress={() => nav.navigate(l.screen)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name={l.icon} size={22} color={colors.primary} />
              <Text style={{ flex: 1, color: colors.text, fontWeight: '700', fontSize: 15 }}>{l.label}</Text>
              {l.badge ? <View style={{ minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{l.badge}</Text></View> : null}
            </Pressable>
          ))}
        </View>
        <Button title={t('settings.title')} variant="ghost" icon="settings-outline" onPress={() => nav.navigate('Settings')} />
        <Button title={t('auth.logout')} variant="outline" icon="log-out-outline" onPress={() => { void signOut(); }} />
      </Page>
    </Screen>
  );
}
