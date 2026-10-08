import React, { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchPortfolio, fetchProvider, fetchPublicServices, isBookable } from '../../api/providers';
import { getProviderReviews } from '../../api/reviews';
import { openProviderConversation } from '../../api/chat';
import { Avatar, Badge, Banner, Button, Card, EmptyState, ErrorState, H1, Header, IconButton, InfoRow, Loading, Muted, Page, Row, Screen, SectionTitle, Stars, useAsync, Chip } from '../../components/ui';
import { categoryLabel } from '../../constants/categories';
import { ReportSheet } from '../../components/ReportSheet';
import type { ReportTarget } from '../../api/reports';
import { formatDate, formatMoney, ratingNumber } from '../../lib/format';
import { errorKey } from '../../lib/errors';
import { useRequireAuth } from '../../lib/useRequireAuth';
import type { ScreenProps } from '../../navigation/types';

export function ProviderDetailScreen({ navigation, route }: ScreenProps<'ProviderDetail'>) {
  const { id } = route.params;
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const fav = useFavorites();
  const requireAuth = useRequireAuth();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ type: ReportTarget; id: string } | null>(null);

  const provider = useAsync(() => fetchProvider(id), [id]);
  const p = provider.data;
  const reviews = useAsync(() => (p?.provider_profile_id ? getProviderReviews(p.provider_profile_id, 5, 0) : Promise.resolve(null)), [p?.provider_profile_id]);
  const catalog = useAsync(() => (p?.provider_profile_id ? fetchPublicServices(p.provider_profile_id).catch(() => []) : Promise.resolve([])), [p?.provider_profile_id]);
  const portfolio = useAsync(() => (p ? fetchPortfolio(p.id) : Promise.resolve([])), [p?.id]);

  const here = { name: 'ProviderDetail', params: { id } };
  const own = !!user && !!p && p.provider_profile_id === user.id;

  const book = () => { if (requireAuth({ name: 'BookingFlow', params: { id } })) navigation.navigate('BookingFlow', { id }); };
  const message = async () => {
    if (!p?.provider_profile_id || !requireAuth(here)) return;
    setBusy(true);
    try {
      const conversationId = await openProviderConversation(p.provider_profile_id);
      navigation.navigate('Chat', { conversationId, title: p.name });
    } catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(false); }
  };
  const toggleFav = async () => {
    if (!p || !requireAuth(here)) return;
    try { await fav.toggle(p.id); } catch (e) { toast.show(t(errorKey(e)), 'error'); }
  };

  if (provider.loading && !p) return <Screen><Header title="" /><Loading /></Screen>;
  if (provider.error && !p) return <Screen><Header title="" /><ErrorState error={provider.error} onRetry={provider.reload} /></Screen>;
  if (!p) return <Screen><Header title="" /><EmptyState icon="person-outline" title={t('provider.notFound')} /></Screen>;

  const rating = reviews.data && reviews.data.total_count > 0 ? reviews.data.average_rating : ratingNumber(p.rating);
  const count = reviews.data?.total_count ?? p.reviews;
  const bookable = isBookable(p);

  return (
    <Screen>
      <Header title={p.name} right={<Row gap={8}><IconButton icon="flag-outline" onPress={() => { if (p.provider_profile_id && !own && requireAuth(here)) setReport({ type: 'user', id: p.provider_profile_id }); }} label={t('report.title')} /><IconButton icon={fav.isFavorite(p.id) ? 'heart' : 'heart-outline'} color={fav.isFavorite(p.id) ? colors.error : undefined} onPress={toggleFav} label={t('favorites.title')} /></Row>} />
      <Page contentStyle={{ paddingBottom: 110 }}>
        <Card style={{ gap: 14, alignItems: 'center' }}>
          <Avatar name={p.name} uri={p.image} size={84} />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <H1 style={{ fontSize: 22, textAlign: 'center' }}>{p.name}</H1>
            <Muted>{p.job}</Muted>
            <Row gap={6}>
              {rating ? <><Stars value={rating} /><Text style={{ color: colors.textSecondary, fontSize: 14 }}>{rating.toFixed(1)} ({count})</Text></> : <Badge text={t('provider.newBadge')} tone="primary" />}
            </Row>
          </View>
          <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <Badge text={bookable ? t('provider.available') : t('provider.unavailable')} tone={bookable ? 'success' : 'neutral'} />
            <Badge text={t('provider.verified')} tone="primary" />
            {p.category ? <Badge text={categoryLabel(p.category, lang)} /> : null}
          </Row>
        </Card>

        {!bookable ? <Banner kind="warning" text={t('provider.notBookable')} /> : null}

        <Card style={{ gap: 14 }}>
          <InfoRow icon="location-outline" label={t('provider.city')} value={p.city} />
          <InfoRow icon="ribbon-outline" label={t('provider.experience')} value={p.experience} />
          <InfoRow icon="cash-outline" label={t('provider.priceFrom')} value={p.price} />
          <InfoRow icon="information-circle-outline" label={t('provider.about')} value={p.intro} />
        </Card>

        {p.services.length ? (
          <View style={{ gap: 10 }}>
            <SectionTitle title={t('provider.services')} />
            <Row style={{ flexWrap: 'wrap' }} gap={8}>{p.services.map(s => <Chip key={s} label={s} />)}</Row>
          </View>
        ) : null}

        {catalog.data && catalog.data.length ? (
          <View style={{ gap: 10 }}>
            <SectionTitle title={t('provider.priceList')} />
            {catalog.data.map(s => (
              <Card key={s.id} style={{ gap: 4 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>{s.name}</Text>
                  {s.price != null ? <Text style={{ color: colors.primary, fontWeight: '800' }}>{formatMoney(s.price, s.currency, lang)}</Text> : null}
                </Row>
                {s.description ? <Muted>{s.description}</Muted> : null}
                {s.duration_minutes ? <Muted>{t('services.minutes', { n: s.duration_minutes })}</Muted> : null}
              </Card>
            ))}
          </View>
        ) : null}

        {portfolio.data && portfolio.data.length ? (
          <View style={{ gap: 10 }}>
            <SectionTitle title={t('provider.portfolio')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {portfolio.data.map(img => <Image key={img.id} source={{ uri: img.url }} style={{ width: 180, height: 130, borderRadius: 14, backgroundColor: colors.surfaceAlt }} />)}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <SectionTitle title={t('provider.reviews')} />
          {reviews.loading && !reviews.data ? <Loading /> : !reviews.data || reviews.data.reviews.length === 0 ? <Muted>{t('provider.noReviews')}</Muted> : reviews.data.reviews.map(r => (
            <Card key={r.id} style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}><Stars value={r.rating} size={13} /><Row gap={10}><Muted>{formatDate(r.created_at, lang)}</Muted><Ionicons name="flag-outline" size={15} color={colors.textMuted} onPress={() => { if (requireAuth(here)) setReport({ type: 'review', id: r.id }); }} /></Row></Row>
              {r.comment ? <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{r.comment}</Text> : null}
            </Card>
          ))}
        </View>
      </Page>
      <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Row gap={10} style={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}>
          {!own && p.provider_profile_id ? <Button title={t('provider.message')} icon="chatbubble-ellipses-outline" variant="outline" loading={busy} onPress={message} style={{ flex: 1 }} /> : null}
          {!own ? <Button title={t('provider.book')} icon="calendar-outline" disabled={!bookable} onPress={book} style={{ flex: 1.4 }} /> : null}
        </Row>
      </View>
      <ReportSheet visible={!!report} onClose={() => setReport(null)} targetType={report?.type ?? 'user'} targetId={report?.id ?? null} />
    </Screen>
  );
}
