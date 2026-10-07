import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchProviders } from '../../api/providers';
import { BellButton, ProviderCard } from '../../components/Common';
import { Banner, Card, ErrorState, EmptyState, Loading, Muted, Page, Row, Screen, SectionTitle, TextField, useAsync } from '../../components/ui';
import { CATEGORIES } from '../../constants/categories';
import { ratingNumber } from '../../lib/format';
import { errorKey } from '../../lib/errors';
import { useRequireAuth } from '../../lib/useRequireAuth';
import type { Nav } from '../../navigation/types';
import type { Provider } from '../../types';

export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { profile, user, providerProfile, wantsProvider } = useAuth();
  const toast = useToast();
  const fav = useFavorites();
  const requireAuth = useRequireAuth();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, error, reload } = useAsync(() => fetchProviders(true), []);

  const onRefresh = useCallback(async () => { setRefreshing(true); await reload(); setRefreshing(false); }, [reload]);
  const search = () => nav.navigate('CustomerTabs', { screen: 'DiscoverTab', params: { query: query.trim() } });
  const toggleFav = async (p: Provider) => {
    if (!requireAuth({ name: 'ProviderDetail', params: { id: p.id } })) return;
    try { await fav.toggle(p.id); } catch (e) { toast.show(t(errorKey(e)), 'error'); }
  };

  const providers = data ?? [];
  const top = [...providers].sort((a, b) => (ratingNumber(b.rating) ?? 0) - (ratingNumber(a.rating) ?? 0) || b.reviews - a.reviews).slice(0, 6);
  const first = (profile?.full_name ?? user?.email ?? '').split(/[\s@]/)[0];
  const applicationOpen = providerProfile ? providerProfile.verification_status !== 'approved' : wantsProvider;

  return (
    <Screen>
      <Page refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Muted>{user ? t('home.hello') : t('home.welcome')}</Muted>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{first || 'Maak'}</Text>
          </View>
          <BellButton />
        </Row>

        <TextField icon="search" value={query} onChangeText={setQuery} placeholder={t('home.searchPlaceholder')} returnKeyType="search" onSubmitEditing={search} />

        {user && applicationOpen ? (
          <Pressable onPress={() => nav.navigate('ProviderApplication')}>
            <Banner kind="warning" text={providerProfile?.verification_status === 'pending' ? t('home.applicationPending') : providerProfile?.verification_status === 'rejected' ? t('home.applicationRejected') : t('home.applicationDraft')} />
          </Pressable>
        ) : null}

        <SectionTitle title={t('home.categories')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
          {CATEGORIES.map(c => (
            <Pressable key={c.value} style={{ width: '25%', alignItems: 'center', gap: 6 }} onPress={() => nav.navigate('CustomerTabs', { screen: 'DiscoverTab', params: { category: c.value } })}>
              <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: c.color + '1F', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={c.icon} size={25} color={c.color} />
              </View>
              <Text numberOfLines={2} style={{ color: colors.text, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{c.label[lang]}</Text>
            </Pressable>
          ))}
        </View>

        {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : providers.length === 0 ? (
          <Card><EmptyState icon="people-outline" title={t('home.noProviders')} text={t('home.noProvidersText')} /></Card>
        ) : (
          <>
            <SectionTitle title={t('home.topRated')} action={t('common.seeAll')} onAction={() => nav.navigate('CustomerTabs', { screen: 'DiscoverTab' })} />
            <View style={{ gap: 12 }}>
              {top.map(p => <ProviderCard key={p.id} provider={p} onPress={() => nav.navigate('ProviderDetail', { id: p.id })} favorite={fav.isFavorite(p.id)} onToggleFavorite={() => toggleFav(p)} />)}
            </View>
          </>
        )}
      </Page>
    </Screen>
  );
}
