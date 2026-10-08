import React, { useCallback, useState } from 'react';
import { Platform, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const top = [...providers].sort((a, b) => (ratingNumber(b.rating) ?? 0) - (ratingNumber(a.rating) ?? 0) || b.reviews - a.reviews).slice(0, 6);
  const first = (profile?.full_name ?? user?.email ?? '').split(/[\s@]/)[0];
  const applicationOpen = providerProfile ? providerProfile.verification_status !== 'approved' : wantsProvider;

  return (
    <Screen>
      <Page refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <LinearGradient colors={['#061A44', '#0B2F7A', '#1D5FE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 20, gap: 16, boxShadow: '0 14px 34px rgba(29,95,224,0.30)' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, fontWeight: '600' }}>{user ? t('home.hello') : t('home.welcome')}</Text>
              <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.4 }}>{first || 'Maak'}</Text>
            </View>
            <BellButton />
          </Row>
          <Pressable onPress={search} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 16, paddingHorizontal: 16, minHeight: 54 }}>
            <Ionicons name="search" size={20} color="#475569" />
            <TextInput value={query} onChangeText={setQuery} placeholder={t('home.searchPlaceholder')} placeholderTextColor="#64748B" returnKeyType="search" onSubmitEditing={search}
              style={[{ flex: 1, fontSize: 16, color: '#0B1220', paddingVertical: 12 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} textAlign={isRTL ? 'right' : 'left'} />
          </Pressable>
        </LinearGradient>

        {user && applicationOpen ? (
          <Pressable onPress={() => nav.navigate('ProviderApplication')}>
            <Banner kind="warning" text={providerProfile?.verification_status === 'pending' ? t('home.applicationPending') : providerProfile?.verification_status === 'rejected' ? t('home.applicationRejected') : t('home.applicationDraft')} />
          </Pressable>
        ) : null}

        <SectionTitle title={t('home.categories')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 }}>
          {CATEGORIES.map(c => (
            <Pressable key={c.value} style={{ width: '25%', alignItems: 'center', gap: 8 }} onPress={() => nav.navigate('CustomerTabs', { screen: 'DiscoverTab', params: { category: c.value } })} accessibilityRole="button" accessibilityLabel={c.label[lang]}>
              <View style={{ width: 62, height: 62, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(15,23,42,0.07)' }}>
                <Ionicons name={c.icon} size={28} color={c.color} />
              </View>
              <Text numberOfLines={2} style={{ color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 17 }}>{c.label[lang]}</Text>
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
