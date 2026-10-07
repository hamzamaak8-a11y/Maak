import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchProviders } from '../../api/providers';
import { ProviderCard } from '../../components/Common';
import { Chip, EmptyState, ErrorState, Header, Loading, Muted, Row, Screen, Tabs, TextField, useAsync } from '../../components/ui';
import { categoryLabel, CATEGORIES } from '../../constants/categories';
import { ratingNumber } from '../../lib/format';
import { errorKey } from '../../lib/errors';
import { useRequireAuth } from '../../lib/useRequireAuth';
import type { Nav } from '../../navigation/types';
import type { Provider } from '../../types';

type Sort = 'relevance' | 'rating';

export function DiscoverScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute();
  const params = (route.params ?? {}) as { query?: string; category?: string };
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const toast = useToast();
  const fav = useFavorites();
  const requireAuth = useRequireAuth();
  const [query, setQuery] = useState(params.query ?? '');
  const [category, setCategory] = useState<string>(params.category ?? '');
  const [city, setCity] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sort, setSort] = useState<Sort>('relevance');
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, error, reload } = useAsync(() => fetchProviders(), []);

  useEffect(() => { setQuery(params.query ?? ''); setCategory(params.category ?? ''); }, [params.query, params.category]);

  const cities = useMemo(() => Array.from(new Set((data ?? []).map(p => p.city).filter(Boolean))).sort(), [data]);

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    let list = (data ?? []).filter(p => {
      if (category && p.category !== category) return false;
      if (city && p.city !== city) return false;
      if (onlyAvailable && p.available !== true) return false;
      if (!q) return true;
      return `${p.name} ${p.job} ${p.city} ${p.services.join(' ')} ${p.category ?? ''} ${p.category ? categoryLabel(p.category, lang) : ''}`.toLocaleLowerCase().includes(q);
    });
    if (sort === 'rating') list = [...list].sort((a, b) => (ratingNumber(b.rating) ?? 0) - (ratingNumber(a.rating) ?? 0) || b.reviews - a.reviews);
    return list;
  }, [data, query, category, city, onlyAvailable, sort, lang]);

  const onRefresh = async () => { setRefreshing(true); await fetchProviders(true).then(() => reload()).catch(() => {}); setRefreshing(false); };
  const toggleFav = async (p: Provider) => {
    if (!requireAuth({ name: 'ProviderDetail', params: { id: p.id } })) return;
    try { await fav.toggle(p.id); } catch (e) { toast.show(t(errorKey(e)), 'error'); }
  };

  return (
    <Screen>
      <Header title={t('discover.title')} noBack />
      <View style={{ padding: 16, gap: 12 }}>
        <TextField icon="search" value={query} onChangeText={setQuery} placeholder={t('home.searchPlaceholder')} />
      </View>
      <Tabs items={[{ key: '', label: t('common.all') }, ...CATEGORIES.map(c => ({ key: c.value, label: c.label[lang] }))]} value={category} onChange={setCategory} />
      <Row style={{ paddingHorizontal: 16, paddingTop: 10, flexWrap: 'wrap' }} gap={8}>
        <Chip icon="flash-outline" label={t('discover.availableNow')} selected={onlyAvailable} onPress={() => setOnlyAvailable(v => !v)} />
        <Chip icon="star-outline" label={t('discover.topRated')} selected={sort === 'rating'} onPress={() => setSort(s => (s === 'rating' ? 'relevance' : 'rating'))} />
        {cities.slice(0, 6).map(c => <Chip key={c} label={c} selected={city === c} onPress={() => setCity(city === c ? '' : c)} />)}
      </Row>
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <FlatList
          data={results}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={<Muted>{t('discover.results', { n: results.length })}</Muted>}
          ListEmptyComponent={<EmptyState icon="search-outline" title={t('discover.empty')} text={t('discover.emptyText')} />}
          renderItem={({ item }) => <ProviderCard provider={item} onPress={() => nav.navigate('ProviderDetail', { id: item.id })} favorite={fav.isFavorite(item.id)} onToggleFavorite={() => toggleFav(item)} />}
        />
      )}
    </Screen>
  );
}
