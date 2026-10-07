import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { listMyBookings } from '../../api/bookings';
import { BookingCard } from '../../components/BookingCard';
import { EmptyState, ErrorState, Header, Loading, Screen, Tabs, useAsync } from '../../components/ui';
import type { BookingStatus } from '../../types';
import type { Nav } from '../../navigation/types';

type Filter = 'new' | 'accepted' | 'in_progress' | 'completed' | 'closed';
const MAP: Record<Filter, BookingStatus[]> = { new: ['pending'], accepted: ['accepted'], in_progress: ['in_progress'], completed: ['completed'], closed: ['rejected', 'cancelled'] };

export function ProviderRequestsScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('new');
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, error, reload } = useAsync(() => listMyBookings(), []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const count = (f: Filter) => (data ?? []).filter(b => MAP[f].includes(b.status)).length;
  const list = (data ?? []).filter(b => MAP[filter].includes(b.status));
  const labels: Record<Filter, string> = { new: t('requests.new'), accepted: t('requests.accepted'), in_progress: t('requests.inProgress'), completed: t('requests.completed'), closed: t('requests.closed') };

  return (
    <Screen>
      <Header title={t('requests.title')} noBack />
      <View style={{ paddingVertical: 12 }}>
        <Tabs items={(Object.keys(MAP) as Filter[]).map(k => ({ key: k, label: labels[k], count: k === 'new' || k === 'accepted' || k === 'in_progress' ? count(k) : 0 }))} value={filter} onChange={setFilter} />
      </View>
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <FlatList
          data={list}
          keyExtractor={b => b.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="file-tray-outline" title={t('requests.empty')} text={t('requests.emptyText')} />}
          renderItem={({ item }) => <BookingCard booking={item} viewer="provider" onPress={() => nav.navigate('BookingDetail', { id: item.id })} />}
        />
      )}
    </Screen>
  );
}
