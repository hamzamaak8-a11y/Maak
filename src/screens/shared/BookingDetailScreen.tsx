import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { acceptBooking, cancelBooking, completeBooking, getBooking, rejectBooking, setBookingPrice, startBooking } from '../../api/bookings';
import { fetchProviders } from '../../api/providers';
import { listMyReviews, submitReview } from '../../api/reviews';
import { openBookingConversation } from '../../api/chat';
import { Badge, Banner, Button, Card, EmptyState, ErrorState, Header, InfoRow, Loading, Page, ReasonSheet, Row, Screen, Sheet, StarInput, StatusBadge, TextField, useAsync } from '../../components/ui';
import { formatDateTime, formatMoney } from '../../lib/format';
import { errorKey } from '../../lib/errors';
import type { Booking } from '../../types';
import type { ScreenProps } from '../../navigation/types';

export function BookingDetailScreen({ navigation, route }: ScreenProps<'BookingDetail'>) {
  const { id } = route.params;
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { user, role } = useAuth();
  const toast = useToast();
  const isProvider = role === 'provider';
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | 'cancel' | 'reject' | 'review' | 'price'>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('MAD');

  const { data, setData, loading, error, reload } = useAsync(async () => {
    const booking = await getBooking(id);
    if (!booking) return null;
    const providers = await fetchProviders().catch(() => []);
    const name = booking.provider_listing_id != null ? providers.find(p => p.id === booking.provider_listing_id)?.name ?? null : null;
    const reviewed = !isProvider && user ? (await listMyReviews(user.id).catch(() => [])).some(r => r.booking_id === booking.id) : false;
    return { booking, providerName: name, reviewed };
  }, [id, user?.id, isProvider]);

  const update = (b: Booking) => setData(d => (d ? { ...d, booking: b } : d));
  const run = async (fn: () => Promise<Booking>, ok: string) => {
    setBusy(true);
    try { update(await fn()); toast.show(ok, 'success'); setSheet(null); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); }
    finally { setBusy(false); }
  };

  const openChat = async () => {
    setBusy(true);
    try {
      const conversationId = await openBookingConversation(id);
      navigation.navigate('Chat', { conversationId, title: isProvider ? data?.booking.customer_name ?? t('booking.customer') : data?.providerName ?? t('booking.provider') });
    } catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(false); }
  };

  if (loading && !data) return <Screen><Header title={t('booking.details')} /><Loading /></Screen>;
  if (error && !data) return <Screen><Header title={t('booking.details')} /><ErrorState error={error} onRetry={reload} /></Screen>;
  if (!data) return <Screen><Header title={t('booking.details')} /><EmptyState icon="calendar-outline" title={t('err.notFound')} /></Screen>;

  const b = data.booking;
  const counterpart = isProvider ? b.customer_name || t('booking.customer') : data.providerName || t('booking.provider');

  return (
    <Screen>
      <Header title={t('booking.details')} />
      <Page>
        <Card style={{ gap: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900', flex: 1 }}>{b.service_category}</Text>
            <StatusBadge status={b.status} />
          </Row>
          <InfoRow icon="person-outline" label={isProvider ? t('booking.customer') : t('booking.provider')} value={counterpart} />
          <InfoRow icon="calendar-outline" label={t('booking.when')} value={formatDateTime(b.service_date, lang)} />
          <InfoRow icon="location-outline" label={t('booking.location')} value={b.location_text} />
          <InfoRow icon="document-text-outline" label={t('booking.describe')} value={b.service_description} />
          <InfoRow icon="chatbubble-outline" label={t('booking.note')} value={b.customer_note} />
          <InfoRow icon="alert-circle-outline" label={t('booking.rejectionReason')} value={b.rejection_reason} />
        </Card>

        <Card style={{ gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('booking.price')}</Text>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17 }}>{b.price != null ? formatMoney(b.price, b.currency, lang) : t('booking.pricePending')}</Text>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('booking.payment')}</Text>
            <StatusBadge status={b.payment_status} />
          </Row>
          {b.price != null && b.payment_status !== 'paid' ? <Banner kind="info" text={t('booking.payDirect')} /> : null}
        </Card>

        <View style={{ gap: 10 }}>
          <Button title={t('booking.message')} icon="chatbubble-ellipses-outline" variant="outline" loading={busy} onPress={openChat} />

          {!isProvider && b.status === 'pending' ? <Button title={t('booking.cancel')} variant="danger" onPress={() => setSheet('cancel')} /> : null}
          {!isProvider && b.status === 'completed' && !data.reviewed ? <Button title={t('booking.leaveReview')} icon="star-outline" onPress={() => setSheet('review')} /> : null}
          {!isProvider && b.status === 'completed' && data.reviewed ? <Badge text={t('booking.reviewed')} tone="success" /> : null}

          {isProvider && b.status === 'pending' ? (
            <>
              <Button title={t('provider.accept')} icon="checkmark" loading={busy} onPress={() => run(() => acceptBooking(b.id), t('booking.accepted'))} />
              <Button title={t('provider.reject')} variant="danger" onPress={() => setSheet('reject')} />
            </>
          ) : null}
          {isProvider && b.status === 'accepted' ? <Button title={t('provider.start')} icon="play" loading={busy} onPress={() => run(() => startBooking(b.id), t('booking.started'))} /> : null}
          {isProvider && b.status === 'in_progress' ? <Button title={t('provider.complete')} icon="checkmark-done" loading={busy} onPress={() => run(() => completeBooking(b.id), t('booking.completed'))} /> : null}
          {isProvider && ['pending', 'accepted', 'in_progress', 'completed'].includes(b.status) ? <Button title={b.price == null ? t('provider.setPrice') : t('provider.changePrice')} variant="secondary" icon="cash-outline" onPress={() => { setPrice(b.price == null ? '' : String(b.price)); setCurrency(b.currency || 'MAD'); setSheet('price'); }} /> : null}
        </View>
      </Page>

      <Sheet visible={sheet === 'cancel'} onClose={() => setSheet(null)} title={t('booking.cancelTitle')}>
        <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>{t('booking.cancelText')}</Text>
        <Button title={t('booking.cancel')} variant="danger" loading={busy} onPress={() => run(() => cancelBooking(b.id), t('booking.cancelled'))} />
        <Button title={t('common.back')} variant="ghost" onPress={() => setSheet(null)} />
      </Sheet>

      <ReasonSheet visible={sheet === 'reject'} title={t('provider.rejectTitle')} placeholder={t('provider.rejectPlaceholder')} confirmLabel={t('provider.reject')} busy={busy} onClose={() => setSheet(null)}
        onConfirm={reason => run(() => rejectBooking(b.id, reason), t('booking.rejected'))} />

      <Sheet visible={sheet === 'review'} onClose={() => setSheet(null)} title={t('booking.leaveReview')}>
        <StarInput value={rating} onChange={setRating} />
        <TextField value={comment} onChangeText={setComment} multiline placeholder={t('booking.reviewPlaceholder')} maxLength={1000} />
        <Button title={t('booking.sendReview')} loading={busy} onPress={async () => {
          setBusy(true);
          try { await submitReview(b.id, rating, comment); setData(d => (d ? { ...d, reviewed: true } : d)); setSheet(null); toast.show(t('booking.reviewThanks'), 'success'); }
          catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(false); }
        }} />
      </Sheet>

      <Sheet visible={sheet === 'price'} onClose={() => setSheet(null)} title={t('provider.setPrice')}>
        <TextField label={t('booking.price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
        <TextField label={t('provider.currency')} value={currency} onChangeText={v => setCurrency(v.toUpperCase())} maxLength={3} autoCapitalize="characters" />
        <Button title={t('common.save')} loading={busy} onPress={() => { const v = Number(price.replace(',', '.')); if (!Number.isFinite(v) || v < 0) { toast.show(t('err.invalidPrice'), 'error'); return; } void run(() => setBookingPrice(b.id, v, currency), t('provider.priceSaved')); }} />
      </Sheet>
    </Screen>
  );
}
