import React, { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { getProviderAvailability } from '../../api/bookings';
import { myListingId, saveAvailability } from '../../api/provider';
import { Banner, Button, Card, EmptyState, ErrorState, Header, Loading, Muted, Page, Row, Screen, TextField, useAsync } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import type { Availability } from '../../types';

type Day = { enabled: boolean; start: string; end: string };
const ORDER = [6, 0, 1, 2, 3, 4, 5]; // Saturday first, as in the Maghreb week
const DAY_NAMES: Record<string, string[]> = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  fr: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function ProviderAvailabilityScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const listingId = await myListingId();
    if (listingId == null) return { listingId, rows: [] as Availability[] };
    return { listingId, rows: await getProviderAvailability(listingId) };
  }, []);
  const [days, setDays] = useState<Record<number, Day>>({});
  const [busyDay, setBusyDay] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    const next: Record<number, Day> = {};
    for (let d = 0; d < 7; d++) {
      const row = data.rows.find(r => r.day_of_week === d && r.is_available);
      next[d] = { enabled: !!row, start: row?.start_time.slice(0, 5) ?? '09:00', end: row?.end_time.slice(0, 5) ?? '17:00' };
    }
    setDays(next);
  }, [data]);

  const save = async (d: number) => {
    const v = days[d];
    if (v.enabled && (!TIME.test(v.start) || !TIME.test(v.end) || v.start >= v.end)) { toast.show(t('availability.invalid'), 'error'); return; }
    setBusyDay(d);
    try { await saveAvailability({ listingId: data!.listingId!, day: d, start: v.start, end: v.end, enabled: v.enabled }); toast.show(t('common.saved'), 'success'); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusyDay(null); }
  };

  return (
    <Screen>
      <Header title={t('provider.availability')} />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : data?.listingId == null ? <EmptyState icon="calendar-clear-outline" title={t('dashboard.noListing')} /> : (
        <Page>
          <Banner kind="info" text={t('availability.hint')} />
          {ORDER.map(d => {
            const v = days[d];
            if (!v) return null;
            const set = (p: Partial<Day>) => setDays(prev => ({ ...prev, [d]: { ...prev[d], ...p } }));
            return (
              <Card key={d} style={{ gap: 12 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{DAY_NAMES[lang][d]}</Text>
                  <Switch value={v.enabled} onValueChange={val => set({ enabled: val })} trackColor={{ true: colors.primary, false: colors.border }} />
                </Row>
                {v.enabled ? (
                  <Row gap={10}>
                    <TextField style={{ flex: 1 }} label={t('availability.from')} value={v.start} onChangeText={x => set({ start: x })} placeholder="09:00" maxLength={5} />
                    <TextField style={{ flex: 1 }} label={t('availability.to')} value={v.end} onChangeText={x => set({ end: x })} placeholder="17:00" maxLength={5} />
                  </Row>
                ) : <Muted>{t('availability.off')}</Muted>}
                <Button title={t('common.save')} size="sm" variant="secondary" loading={busyDay === d} onPress={() => save(d)} />
              </Card>
            );
          })}
        </Page>
      )}
    </Screen>
  );
}
