import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { checkAvailability, createBooking, getProviderAvailability } from '../../api/bookings';
import { PublicService, fetchProvider, fetchPublicServices, isBookable } from '../../api/providers';
import { withRetry } from '../../lib/retry';
import { Banner, Button, Card, Chip, EmptyState, ErrorState, Form, Header, InfoRow, Label, Loading, Muted, Page, Row, Screen, TextField, useAsync } from '../../components/ui';
import { LoginRequired } from '../../components/Common';
import { dayKeyUtc, formatDateTime, formatMoney, isoForUtcDay } from '../../lib/format';
import { errorKey } from '../../lib/errors';
import type { Availability } from '../../types';
import type { ScreenProps } from '../../navigation/types';

type Slot = { iso: string; label: string; free: boolean };

/** Start times on a one-hour grid at which a service of `minutes` still fits inside a working-hours window. */
function timesFor(dow: number, rows: Availability[], minutes: number): string[] {
  const out = new Set<string>();
  for (const r of rows.filter(x => x.day_of_week === dow && x.is_available)) {
    const [sh, sm] = r.start_time.slice(0, 5).split(':').map(Number);
    const [eh, em] = r.end_time.slice(0, 5).split(':').map(Number);
    for (let m = sh * 60 + sm; m + minutes <= eh * 60 + em; m += 60) out.add(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return [...out].sort();
}

export function BookingFlowScreen({ navigation, route }: ScreenProps<'BookingFlow'>) {
  const { id } = route.params;
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [service, setService] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(null); // a price-list service, or null for a free request
  const [otherOpen, setOtherOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [dayOffset, setDayOffset] = useState(0);
  const [slotIso, setSlotIso] = useState('');
  const [location, setLocation] = useState(profile?.city ?? '');
  const [note, setNote] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  const provider = useAsync(() => fetchProvider(id), [id]);
  const availability = useAsync(() => (user ? getProviderAvailability(id) : Promise.resolve([] as Availability[])), [id, user?.id]);
  const p = provider.data;
  // The provider's ACTIVE price list: the services a customer can book with their price and duration.
  const priceList = useAsync(() => (p?.provider_profile_id ? withRetry(() => fetchPublicServices(p.provider_profile_id as string)) : Promise.resolve([] as PublicService[])), [p?.provider_profile_id]);
  const list = priceList.data ?? [];
  const chosen = serviceId ? list.find(s => s.id === serviceId) ?? null : null;
  const minutes = chosen?.duration_minutes && chosen.duration_minutes > 0 ? chosen.duration_minutes : 60;

  // Default choice once the price list is known: the first listed service, else the provider's first profile service (a free request).
  useEffect(() => {
    if (!p || priceList.loading || service) return;
    const first = list[0];
    if (first) { setService(first.name); setServiceId(first.id); } else setService(p.services[0] ?? p.job);
  }, [p, priceList.loading, list, service]);

  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const { iso, dow } = dayKeyUtc(i);
    const label = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso));
    return { offset: i, dow, label };
  }), [lang]);

  useEffect(() => {
    if (!availability.data) return;
    let alive = true;
    const day = days[dayOffset];
    const now = Date.now() + 30 * 60_000;
    const times = timesFor(day.dow, availability.data, minutes).filter(tm => new Date(isoForUtcDay(dayOffset, tm)).getTime() > now);
    setSlotsLoading(true);
    setSlotIso('');
    Promise.all(times.map(async tm => {
      const iso = isoForUtcDay(dayOffset, tm);
      try { return { iso, label: tm, free: await checkAvailability(id, iso, new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()) }; }
      catch { return { iso, label: tm, free: false }; }
    })).then(r => { if (alive) setSlots(r); }).finally(() => { if (alive) setSlotsLoading(false); });
    return () => { alive = false; };
  }, [availability.data, dayOffset, days, id, minutes]);

  if (!user) return <Screen><Header title={t('booking.title')} /><LoginRequired /></Screen>;
  if (provider.loading && !p) return <Screen><Header title={t('booking.title')} /><Loading /></Screen>;
  if (provider.error && !p) return <Screen><Header title={t('booking.title')} /><ErrorState error={provider.error} onRetry={provider.reload} /></Screen>;
  if (!p || !isBookable(p)) return <Screen><Header title={t('booking.title')} /><EmptyState icon="calendar-clear-outline" title={t('provider.notBookable')} /></Screen>;

  if (doneId) {
    return (
      <Screen>
        <Header title={t('booking.title')} noBack />
        <Page>
          <EmptyState icon="checkmark-circle" title={t('booking.sentTitle')} text={t('booking.sentText', { name: p.name })}
            action={<View style={{ gap: 10, minWidth: 240 }}>
              <Button title={t('booking.viewBooking')} onPress={() => navigation.replace('BookingDetail', { id: doneId })} />
              <Button title={t('common.home')} variant="ghost" onPress={() => navigation.navigate('CustomerTabs', { screen: 'HomeTab' })} />
            </View>} />
        </Page>
      </Screen>
    );
  }

  const stepsLabels = [t('booking.stepService'), t('booking.stepWhen'), t('booking.stepWhere'), t('booking.stepReview')];

  const next = () => {
    setFieldError(null);
    if (step === 0 && !service.trim()) { setFieldError(t('booking.pickService')); return; }
    if (step === 1 && !slotIso) { setFieldError(t('booking.pickSlot')); return; }
    if (step === 2 && location.trim().length < 3) { setFieldError(t('booking.pickLocation')); return; }
    if (step < 3) setStep(step + 1); else void submit();
  };

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const b = await createBooking({ providerListingId: p.id, serviceCategory: service.trim(), serviceDescription: description.trim(), serviceDate: slotIso, locationText: location.trim(), customerNote: note.trim(), serviceId: chosen?.id ?? null, durationMinutes: minutes });
      setDoneId(b.id);
    } catch (e) { setError(t(errorKey(e))); }
    finally { setSubmitting(false); }
  };

  return (
    <Screen>
      <Header title={t('booking.title')} onBack={() => (step > 0 ? setStep(step - 1) : navigation.goBack())} />
      <Form>
        <Page contentStyle={{ gap: 16 }}>
          <Row gap={6}>
            {stepsLabels.map((l, i) => (
              <View key={l} style={{ flex: 1, gap: 4 }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.primary : colors.border }} />
                <Text numberOfLines={1} style={{ color: i === step ? colors.primary : colors.textMuted, fontSize: 12, fontWeight: '700' }}>{l}</Text>
              </View>
            ))}
          </Row>
          {error ? <Banner kind="error" text={error} /> : null}
          {fieldError ? <Banner kind="warning" text={fieldError} /> : null}

          {step === 0 ? (
            <View style={{ gap: 14 }}>
              <Label>{t('booking.service')}</Label>
              {priceList.loading && !priceList.data ? <Loading /> : null}
              {priceList.error && !priceList.data ? (
                <View style={{ gap: 8 }}>
                  <Banner kind="warning" text={t('booking.servicesFailed')} />
                  <Button title={t('common.retry')} icon="refresh" variant="outline" size="sm" onPress={priceList.reload} />
                </View>
              ) : null}
              {list.length ? (
                <View style={{ gap: 10 }}>
                  {list.map(sv => {
                    const on = serviceId === sv.id;
                    return (
                      <Pressable key={sv.id} accessibilityRole="button" onPress={() => { setServiceId(sv.id); setService(sv.name); setOtherOpen(false); }}
                        style={{ borderWidth: 1.5, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primaryLight : colors.surface, borderRadius: 18, padding: 14, gap: 4 }}>
                        <Row style={{ justifyContent: 'space-between' }}>
                          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15.5, flex: 1 }}>{sv.name}</Text>
                          {sv.price != null ? <Text style={{ color: colors.accent, fontWeight: '800' }}>{formatMoney(sv.price, sv.currency, lang)}</Text> : null}
                        </Row>
                        {sv.description ? <Muted>{sv.description}</Muted> : null}
                        {sv.duration_minutes ? <Muted>{t('services.minutes', { n: sv.duration_minutes })}</Muted> : null}
                      </Pressable>
                    );
                  })}
                  <Chip label={t('booking.otherRequest')} icon="create-outline" selected={otherOpen} onPress={() => { setOtherOpen(true); setServiceId(null); setService(p.services[0] ?? p.job); }} />
                  {otherOpen ? (
                    <View style={{ gap: 10 }}>
                      <Muted>{t('booking.otherRequestHint')}</Muted>
                      <Row style={{ flexWrap: 'wrap' }} gap={8}>
                        {(p.services.length ? p.services : [p.job]).map(s => <Chip key={s} label={s} selected={service === s} onPress={() => setService(s)} />)}
                      </Row>
                    </View>
                  ) : null}
                </View>
              ) : priceList.loading && !priceList.data ? null : (
                <Row style={{ flexWrap: 'wrap' }} gap={8}>
                  {(p.services.length ? p.services : [p.job]).map(s => <Chip key={s} label={s} selected={service === s} onPress={() => { setService(s); setServiceId(null); }} />)}
                </Row>
              )}
              <TextField label={t('booking.describe')} value={description} onChangeText={setDescription} multiline placeholder={t('booking.describePlaceholder')} />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={{ gap: 14 }}>
              <Label>{t('booking.chooseDay')}</Label>
              <Row style={{ flexWrap: 'wrap' }} gap={8}>{days.map(d => <Chip key={d.offset} label={d.label} selected={dayOffset === d.offset} onPress={() => setDayOffset(d.offset)} />)}</Row>
              <Label>{t('booking.chooseTime')}</Label>
              {availability.loading || slotsLoading ? <Loading /> : availability.error ? <ErrorState error={availability.error} onRetry={availability.reload} /> : slots.length === 0 ? <Muted>{t('booking.noSlots')}</Muted> : (
                <Row style={{ flexWrap: 'wrap' }} gap={8}>
                  {slots.map(s => (
                    <Pressable key={s.iso} disabled={!s.free} onPress={() => setSlotIso(s.iso)}
                      style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: slotIso === s.iso ? colors.primary : colors.border, backgroundColor: slotIso === s.iso ? colors.primary : colors.surface, opacity: s.free ? 1 : 0.4 }}>
                      <Text style={{ color: slotIso === s.iso ? colors.onPrimary : colors.text, fontWeight: '700' }}>{s.label}</Text>
                    </Pressable>
                  ))}
                </Row>
              )}
              <Muted>{t('booking.utcNote')}</Muted>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={{ gap: 14 }}>
              <TextField label={t('booking.location')} icon="location-outline" value={location} onChangeText={setLocation} placeholder={t('booking.locationPlaceholder')} />
              <TextField label={t('booking.note')} value={note} onChangeText={setNote} multiline placeholder={t('booking.notePlaceholder')} />
            </View>
          ) : null}

          {step === 3 ? (
            <Card style={{ gap: 14 }}>
              <InfoRow icon="person-outline" label={t('booking.provider')} value={p.name} />
              <InfoRow icon="construct-outline" label={t('booking.service')} value={service} />
              {chosen?.duration_minutes ? <InfoRow icon="time-outline" label={t('booking.duration')} value={t('services.minutes', { n: chosen.duration_minutes })} /> : null}
              {chosen?.price != null ? <InfoRow icon="cash-outline" label={t('booking.listPrice')} value={formatMoney(chosen.price, chosen.currency, lang)} /> : null}
              {description.trim() ? <InfoRow icon="document-text-outline" label={t('booking.describe')} value={description} /> : null}
              <InfoRow icon="calendar-outline" label={t('booking.when')} value={formatDateTime(slotIso, lang)} />
              <InfoRow icon="location-outline" label={t('booking.location')} value={location} />
              {note.trim() ? <InfoRow icon="chatbubble-outline" label={t('booking.note')} value={note} /> : null}
              <Banner kind="info" text={t('booking.priceNote')} />
            </Card>
          ) : null}

          <Button title={step === 3 ? t('booking.confirm') : t('common.next')} onPress={next} loading={submitting} />
        </Page>
      </Form>
    </Screen>
  );
}
