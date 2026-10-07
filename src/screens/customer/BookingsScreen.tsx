import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { listMyBookings } from '../../api/bookings';
import { fetchProviders } from '../../api/providers';
import { BookingCard } from '../../components/BookingCard';
import { LoginRequired } from '../../components/Common';
import { Button, EmptyState, ErrorState, Header, Loading, Screen, Tabs, useAsync } from '../../components/ui';
import type { Nav } from '../../navigation/types';
import type { Provider } from '../../types';

type Filter = 'active' | 'past';

export function BookingsScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('active');
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, error, reload } = useAsync(async () => {
    if (!user) return null;
    const [bookings, providers] = await Promise.all([listMyBookings(), fetchProviders().catch(() => [] as Provider[])]);
    return { bookings, map: new Map(providers.map(p => [p.id, p])) };
  }, [user?.id]);

  useFocusEffect(useCallback(() => { if (user) void reload(); }, [user?.id, reload]));

  if (!user) return <Screen><Header title={t('bookings.title')} noBack /><LoginRequired icon="calendar-outline" /></Screen>;

  const list = (data?.bookings ?? []).filter(b => (filter === 'active' ? ['pending', 'accepted', 'in_progress'].includes(b.status) : ['completed', 'rejected', 'cancelled'].includes(b.status)));
  const onRefresh = async () => { setRefreshing(true); await reload(); setRefreshing(false); };

  return (
    <Screen>
      <Header title={t('bookings.title')} noBack />
      <View style={{ paddingVertical: 12 }}>
        <Tabs items={[{ key: 'active' as Filter, label: t('bookings.active') }, { key: 'past' as Filter, label: t('bookings.past') }]} value={filter} onChange={setFilter} />
      </View>
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <FlatList
          data={list}
          keyExtractor={b => b.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title={t('bookings.empty')} text={t('bookings.emptyText')} action={<Button title={t('bookings.findProvider')} onPress={() => nav.navigate('CustomerTabs', { screen: 'DiscoverTab' })} />} />}
          renderItem={({ item }) => <BookingCard booking={item} viewer="customer" providerMap={data?.map} onPress={() => nav.navigate('BookingDetail', { id: item.id })} />}
        />
      )}
    </Screen>
  );
}
