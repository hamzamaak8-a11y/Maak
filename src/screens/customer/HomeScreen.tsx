import React, { useCallback, useState } from 'react';
import { Image, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
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
import { PAGE_MAX_WIDTH } from '../../config/env';
import { ratingNumber } from '../../lib/format';
import { errorKey } from '../../lib/errors';
import { useRequireAuth } from '../../lib/useRequireAuth';
import type { Nav } from '../../navigation/types';
import type { Provider } from '../../types';

export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const { t, lang, isRTL } = useLanguage();
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
  // "Top rated" only lists providers that actually have a rating; newcomers are never hidden, they get their own section.
  const rated = providers.filter(p => ratingNumber(p.rating) != null).sort((a, b) => (ratingNumber(b.rating) ?? 0) - (ratingNumber(a.rating) ?? 0) || b.reviews - a.reviews);
  const top = rated.slice(0, 6);
  const newcomers = providers.filter(p => ratingNumber(p.rating) == null).sort((a, b) => b.id - a.id);
  const rest = rated.slice(6, 14);
  const { width } = useWindowDimensions();
  const cardW = Math.min(Math.round((Math.min(width, PAGE_MAX_WIDTH) - 36) * 0.84), 340);
  const first = (profile?.full_name ?? user?.email ?? '').split(/[\s@]/)[0];
  const applicationOpen = providerProfile ? providerProfile.verification_status !== 'approved' : wantsProvider;

  return (
    <Screen>
      <Page refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <View style={{ gap: 18 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={8}>
              <Image source={require('../../../assets/logo-mark.png')} accessibilityIgnoresInvertColors style={{ width: 34, height: 34 }} resizeMode="contain" />
              <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 }}>Maak</Text>
            </Row>
            <BellButton />
          </Row>
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>{user ? t('home.hello') : t('home.welcome')}</Text>
            {first ? <Text numberOfLines={1} style={{ color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>{first}</Text> : null}
          </View>
          <Pressable onPress={search} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, minHeight: 54 }}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput accessibilityLabel={t('home.searchPlaceholder')} value={query} onChangeText={setQuery} placeholder={t('home.searchPlaceholder')} placeholderTextColor={colors.textMuted} returnKeyType="search" onSubmitEditing={search}
              style={[{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} textAlign={isRTL ? 'right' : 'left'} />
          </Pressable>
        </View>

        {user && applicationOpen ? (
          <Pressable onPress={() => nav.navigate('ProviderApplication')}>
            <Banner kind="warning" text={providerProfile?.verification_status === 'pending' ? t('home.applicationPending') : providerProfile?.verification_status === 'rejected' ? t('home.applicationRejected') : t('home.applicationDraft')} />
          </Pressable>
        ) : null}

        <SectionTitle title={t('home.categories')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 12 }}>
          {CATEGORIES.map(c => (
            <Pressable key={c.value} style={{ width: 82, alignItems: 'center', gap: 8 }} onPress={() => nav.navigate('CustomerTabs', { screen: 'DiscoverTab', params: { category: c.value } })} accessibilityRole="button" accessibilityLabel={c.label[lang]}>
              <View style={{ width: 66, height: 66, borderRadius: 22, backgroundColor: c.color + '1A', borderWidth: 1, borderColor: c.color + '33', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={c.icon} size={30} color={c.color} />
              </View>
              <Text numberOfLines={2} style={{ color: colors.text, fontSize: 12.5, fontWeight: '700', textAlign: 'center', lineHeight: 16 }}>{c.label[lang]}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : providers.length === 0 ? (
          <Card><EmptyState icon="people-outline" title={t('home.noProviders')} text={t('home.noProvidersText')} /></Card>
        ) : (
          <>
            {top.length ? (
              <>
                <SectionTitle title={t('home.topRated')} action={t('common.seeAll')} onAction={() => nav.navigate('CustomerTabs', { screen: 'DiscoverTab' })} />
                <Carousel items={top} cardW={cardW} onOpen={id => nav.navigate('ProviderDetail', { id })} isFavorite={fav.isFavorite} onFavorite={toggleFav} />
              </>
            ) : null}
            {newcomers.length ? (
              <>
                <SectionTitle title={t('home.newProviders')} action={top.length ? undefined : t('common.seeAll')} onAction={top.length ? undefined : () => nav.navigate('CustomerTabs', { screen: 'DiscoverTab' })} />
                <Carousel items={newcomers.slice(0, 8)} cardW={cardW} onOpen={id => nav.navigate('ProviderDetail', { id })} isFavorite={fav.isFavorite} onFavorite={toggleFav} />
              </>
            ) : null}
            {rest.length ? (
              <>
                <SectionTitle title={t('home.moreProviders')} />
                <View style={{ gap: 14 }}>
                  {rest.map(p => <ProviderCard key={p.id} provider={p} onPress={() => nav.navigate('ProviderDetail', { id: p.id })} favorite={fav.isFavorite(p.id)} onToggleFavorite={() => toggleFav(p)} />)}
                </View>
              </>
            ) : null}
          </>
        )}
      </Page>
    </Screen>
  );
}

function Carousel({ items, cardW, onOpen, isFavorite, onFavorite }: { items: Provider[]; cardW: number; onOpen: (id: number) => void; isFavorite: (id: number) => boolean; onFavorite: (p: Provider) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardW + 14} decelerationRate="fast" style={{ marginHorizontal: -18 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 14, paddingBottom: 6 }}>
      {items.map(p => <ProviderCard key={p.id} style={{ width: cardW }} provider={p} onPress={() => onOpen(p.id)} favorite={isFavorite(p.id)} onToggleFavorite={() => onFavorite(p)} />)}
    </ScrollView>
  );
}
