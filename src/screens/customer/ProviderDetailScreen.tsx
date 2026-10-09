import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchPortfolio, fetchProvider, fetchPublicServices, isBookable } from '../../api/providers';
import { getProviderReviews } from '../../api/reviews';
import { withRetry } from '../../lib/retry';
import { openProviderConversation } from '../../api/chat';
import { Avatar, Badge, Banner, Button, Card, EmptyState, ErrorState, H1, Header, Loading, Muted, Row, Screen, SectionTitle, Stars, useAsync, Chip } from '../../components/ui';
import { CoverPhoto } from '../../components/ProviderVisual';
import { PAGE_MAX_WIDTH } from '../../config/env';
import { categoryLabel } from '../../constants/categories';
import { ReportSheet } from '../../components/ReportSheet';
import type { ReportTarget } from '../../api/reports';
import { formatDate, formatMoney, formatStartingPrice, ratingNumber } from '../../lib/format';
import { errorKey } from '../../lib/errors';
import { useRequireAuth } from '../../lib/useRequireAuth';
import type { ScreenProps } from '../../navigation/types';

export function ProviderDetailScreen({ navigation, route }: ScreenProps<'ProviderDetail'>) {
  const { id } = route.params;
  const { colors } = useTheme();
  const { t, lang, isRTL } = useLanguage();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
  const toast = useToast();
  const fav = useFavorites();
  const requireAuth = useRequireAuth();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ type: ReportTarget; id: string } | null>(null);

  const provider = useAsync(() => fetchProvider(id), [id]);
  const p = provider.data;
  const reviews = useAsync(() => (p?.provider_profile_id ? withRetry(() => getProviderReviews(p.provider_profile_id as string, 5, 0)) : Promise.resolve(null)), [p?.provider_profile_id]);
  const catalog = useAsync(() => (p?.provider_profile_id ? withRetry(() => fetchPublicServices(p.provider_profile_id as string)) : Promise.resolve([])), [p?.provider_profile_id]);
  const portfolio = useAsync(() => (p ? withRetry(() => fetchPortfolio(p.id)) : Promise.resolve([])), [p?.id]);

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
  const startPrice = formatStartingPrice(p.price, p.currency, lang);
  const slides = (portfolio.data ?? []).map(i => i.url);
  if (!slides.length && p.image) slides.push(p.image);
  const galleryW = Math.min(width, PAGE_MAX_WIDTH);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ width: '100%', maxWidth: PAGE_MAX_WIDTH, alignSelf: 'center' }}>
          <View style={{ height: 330 }}>
            {slides.length > 1 ? (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16}
                onScroll={e => setSlide(Math.round(e.nativeEvent.contentOffset.x / galleryW))}>
                {slides.map(u => <View key={u} style={{ width: galleryW }}><CoverPhoto provider={p} uri={u} height={330} /></View>)}
              </ScrollView>
            ) : <CoverPhoto provider={p} uri={slides[0] ?? null} height={330} />}
            <View style={{ position: 'absolute', top: insets.top + 10, start: 14, end: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
              <GlassButton icon={isRTL ? 'arrow-forward' : 'arrow-back'} label={t('common.back')} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('CustomerTabs' as never))} />
              <Row gap={8}>
                <GlassButton icon="flag-outline" label={t('report.title')} onPress={() => { if (p.provider_profile_id && !own && requireAuth(here)) setReport({ type: 'user', id: p.provider_profile_id }); }} />
                <GlassButton icon={fav.isFavorite(p.id) ? 'heart' : 'heart-outline'} color={fav.isFavorite(p.id) ? colors.error : undefined} label={t('favorites.title')} onPress={toggleFav} />
              </Row>
            </View>
            {slides.length > 1 ? <View style={{ position: 'absolute', bottom: 44, end: 14, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{slide + 1} / {slides.length}</Text></View> : null}
          </View>

          <View style={{ backgroundColor: colors.background, borderTopStartRadius: 28, borderTopEndRadius: 28, marginTop: -28, paddingHorizontal: 18, paddingTop: 0, gap: 18 }}>
            <Row gap={14} style={{ alignItems: 'flex-end', marginTop: -44 }}>
              <View style={{ borderWidth: 4, borderColor: colors.background, borderRadius: 50, backgroundColor: colors.background }}><Avatar name={p.name} uri={p.image} size={84} /></View>
              <View style={{ flex: 1, paddingBottom: 6 }}>
                <H1 style={{ fontSize: 23 }} >{p.name}</H1>
                <Muted>{p.job}{p.city ? ` · ${p.city}` : ''}</Muted>
              </View>
            </Row>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Badge text={bookable ? t('provider.available') : t('provider.unavailable')} tone={bookable ? 'success' : 'neutral'} />
              {p.verified ? <Badge text={t('provider.verified')} tone="primary" /> : null}
              {p.category ? <Badge text={categoryLabel(p.category, lang)} /> : null}
            </Row>

            <Card padded={false} style={{ flexDirection: 'row' }}>
              <Stat value={rating ? rating.toFixed(1) : '—'} label={t('provider.statRating')} icon="star" iconColor={colors.accent} />
              <Stat value={String(count)} label={t('provider.reviews')} divider />
              <Stat value={p.experience ?? '—'} label={t('provider.experience')} divider />
            </Card>

            {!bookable ? <Banner kind="warning" text={t('provider.notBookable')} /> : null}

            {p.intro ? (
              <View style={{ gap: 8 }}>
                <SectionTitle title={t('provider.about')} />
                <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}>{p.intro}</Text>
              </View>
            ) : null}

            {p.services.length ? (
              <View style={{ gap: 10 }}>
                <SectionTitle title={t('provider.services')} />
                <Row style={{ flexWrap: 'wrap' }} gap={8}>{p.services.map(sv => <Chip key={sv} label={sv} />)}</Row>
              </View>
            ) : null}

            {catalog.error && !(catalog.data ?? []).length ? <LoadFailed text={t('provider.priceListFailed')} onRetry={catalog.reload} /> : null}
            {catalog.data && catalog.data.length ? (
              <View style={{ gap: 10 }}>
                <SectionTitle title={t('provider.priceList')} />
                {catalog.data.map(sv => (
                  <Card key={sv.id} style={{ gap: 4, borderRadius: 18 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15.5, flex: 1 }}>{sv.name}</Text>
                      {sv.price != null ? <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 15.5 }}>{formatMoney(sv.price, sv.currency, lang)}</Text> : null}
                    </Row>
                    {sv.description ? <Muted>{sv.description}</Muted> : null}
                    {sv.duration_minutes ? <Muted>{t('services.minutes', { n: sv.duration_minutes })}</Muted> : null}
                  </Card>
                ))}
              </View>
            ) : null}

            {portfolio.error && !(portfolio.data ?? []).length ? (
              <View style={{ gap: 10 }}>
                <SectionTitle title={t('provider.portfolio')} />
                <LoadFailed text={t('provider.portfolioFailed')} onRetry={portfolio.reload} />
              </View>
            ) : null}

            {slides.length > 1 ? (
              <View style={{ gap: 10 }}>
                <SectionTitle title={t('provider.portfolio')} />
                <View style={{ flexDirection: 'row', gap: 8, height: 250 }}>
                  <View style={{ flex: 1.4, borderRadius: 20, overflow: 'hidden' }}><CoverPhoto provider={p} uri={slides[0]} height={250} /></View>
                  <View style={{ flex: 1, gap: 8 }}>
                    {slides.slice(1, 3).map(u => <View key={u} style={{ flex: 1, borderRadius: 20, overflow: 'hidden' }}><CoverPhoto provider={p} uri={u} height={121} /></View>)}
                  </View>
                </View>
                {slides.length > 3 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {slides.slice(3).map(u => <View key={u} style={{ width: 150, borderRadius: 16, overflow: 'hidden' }}><CoverPhoto provider={p} uri={u} height={110} /></View>)}
                  </ScrollView>
                ) : null}
              </View>
            ) : null}

            <View style={{ gap: 10 }}>
              <SectionTitle title={t('provider.reviews')} />
              {reviews.loading && !reviews.data ? <Loading /> : reviews.error && !reviews.data ? <LoadFailed text={t('provider.reviewsFailed')} onRetry={reviews.reload} /> : !reviews.data || reviews.data.reviews.length === 0 ? <Muted>{t('provider.noReviews')}</Muted> : reviews.data.reviews.map(r => (
                <Card key={r.id} style={{ gap: 6, borderRadius: 18 }}>
                  <Row style={{ justifyContent: 'space-between' }}><Stars value={r.rating} size={13} /><Row gap={10}><Muted>{formatDate(r.created_at, lang)}</Muted><Pressable accessibilityRole="button" accessibilityLabel={t('report.title')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', margin: -14 }} onPress={() => { if (requireAuth(here)) setReport({ type: 'review', id: r.id }); }}><Ionicons name="flag-outline" size={16} color={colors.textMuted} /></Pressable></Row></Row>
                  {r.comment ? <Text style={{ color: colors.text, fontSize: 14.5, lineHeight: 22 }}>{r.comment}</Text> : null}
                </Card>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {!own ? (
        <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) + 4, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, boxShadow: '0 -10px 30px rgba(10,22,51,0.10)' }}>
          <Row gap={12} style={{ maxWidth: PAGE_MAX_WIDTH, width: '100%', alignSelf: 'center' }}>
            {startPrice ? (
              <View style={{ flexShrink: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 11.5, fontWeight: '700' }}>{t('provider.priceFrom')}</Text>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{startPrice}</Text>
              </View>
            ) : null}
            {p.provider_profile_id ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('provider.message')} onPress={message} disabled={busy} style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
                <Ionicons name="chatbubble-ellipses" size={24} color={colors.primary} />
              </Pressable>
            ) : null}
            <Button title={t('provider.book')} icon="calendar" gradient disabled={!bookable} onPress={book} style={{ flex: 1, minHeight: 54, borderRadius: 18 }} />
          </Row>
        </View>
      ) : null}
      <ReportSheet visible={!!report} onClose={() => setReport(null)} targetType={report?.type ?? 'user'} targetId={report?.id ?? null} />
    </View>
  );
}

function GlassButton({ icon, onPress, label, color }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; color?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
      <Ionicons name={icon} size={21} color={color ?? '#0A1633'} />
    </Pressable>
  );
}

function Stat({ value, label, divider, icon, iconColor }: { value: string; label: string; divider?: boolean; icon?: keyof typeof Ionicons.glyphMap; iconColor?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, gap: 2, borderStartWidth: divider ? 1 : 0, borderStartColor: colors.border }}>
      <Row gap={4}>{icon ? <Ionicons name={icon} size={17} color={iconColor} /> : null}<Text numberOfLines={1} style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>{value}</Text></Row>
      <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** Compact, in-place error with a retry; the rest of the page keeps working. */
function LoadFailed({ text, onRetry }: { text: string; onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={{ gap: 8 }}>
      <Banner kind="warning" text={text} />
      <Button title={t('common.retry')} icon="refresh" variant="outline" size="sm" onPress={onRetry} />
    </View>
  );
}
