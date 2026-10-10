import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { AdminBooking, BookingFilter, adminCancelBooking, adminMarkPaid, adminRefundBooking, listAdminBookings } from '../../api/admin';
import { Button, Card, Chip, EmptyState, ErrorState, Header, Loading, Muted, Page, ReasonSheet, Row, Screen, Sheet, StatusBadge, TextField } from '../../components/ui';
import { canAdminMarkPaid, canAdminRefund } from '../../lib/bookingRules';
import { formatDateTime, formatMoney } from '../../lib/format';
import { errorKey } from '../../lib/errors';

const FILTERS: BookingFilter[] = ['all', 'open', 'completed', 'unpaid', 'closed'];

export function AdminBookingsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const toast = useToast();
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AdminBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [cancelling, setCancelling] = useState<AdminBooking | null>(null);
  const [refunding, setRefunding] = useState<AdminBooking | null>(null);
  const [paying, setPaying] = useState<AdminBooking | null>(null);
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => { const id = setTimeout(() => setQ(search), 300); return () => clearTimeout(id); }, [search]);

  const load = useCallback(async (offset: number) => {
    const mine = ++seq.current;
    if (offset === 0) setLoading(true); else setMore(true);
    setError(null);
    try {
      const page = await listAdminBookings({ filter, search: q, offset });
      if (mine !== seq.current) return;
      setRows(prev => (offset === 0 ? page.rows : [...prev, ...page.rows]));
      setTotal(page.total);
    } catch (e) { if (mine === seq.current) setError(e); }
    finally { if (mine === seq.current) { setLoading(false); setMore(false); } }
  }, [filter, q]);

  useEffect(() => { void load(0); }, [load]);

  // After a money action the server decides what changed; reload the visible rows from the start.
  const refresh = () => load(0);

  const cancel = async (reason: string) => {
    if (!cancelling) return;
    setBusy(true);
    try { await adminCancelBooking(cancelling.id, reason); setCancelling(null); toast.show(t('common.saved'), 'success'); await refresh(); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(false); }
  };

  const markPaid = async () => {
    if (!paying) return;
    setBusy(true);
    try { await adminMarkPaid(paying.id, method); setPaying(null); toast.show(t('common.saved'), 'success'); await refresh(); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(false); }
  };

  const refund = async (reason: string) => {
    if (!refunding) return;
    setBusy(true);
    try { await adminRefundBooking(refunding.id, reason); setRefunding(null); toast.show(t('common.saved'), 'success'); await refresh(); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t('admin.bookings')} />
      <Page>
        <TextField icon="search" value={search} onChangeText={setSearch} placeholder={t('admin.searchBookings')} autoCapitalize="none" />
        <Row style={{ flexWrap: 'wrap' }}>
          {FILTERS.map(f => <Chip key={f} label={t(`admin.bf.${f}` as never)} selected={filter === f} onPress={() => setFilter(f)} />)}
        </Row>
        <Muted>{t('admin.bookingsShown', { shown: rows.length, total })}</Muted>

        {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={() => load(0)} /> : rows.length === 0 ? <EmptyState icon="calendar-outline" title={t('admin.noBookings')} /> : (
          <>
            {rows.map(b => (
              <Card key={b.id} style={{ gap: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, flex: 1 }}>{b.service_category}</Text><StatusBadge status={b.status} /></Row>
                <Muted>{b.customer_name ?? '—'} → {b.provider_name ?? '—'}</Muted>
                <Muted>{formatDateTime(b.service_date, lang)}</Muted>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{b.price != null ? formatMoney(b.price, b.currency, lang) : '—'}</Text>
                  <StatusBadge status={b.payment_status} />
                </Row>
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {canAdminMarkPaid(b) ? <Button title={t('admin.markPaid')} size="sm" variant="secondary" onPress={() => { setMethod('cash'); setPaying(b); }} /> : null}
                  {canAdminRefund(b) ? <Button title={t('admin.refund')} size="sm" variant="outline" onPress={() => setRefunding(b)} /> : null}
                  {!['completed', 'cancelled', 'rejected'].includes(b.status) ? <Button title={t('admin.cancelBooking')} size="sm" variant="danger" onPress={() => setCancelling(b)} /> : null}
                </Row>
              </Card>
            ))}
            {rows.length < total ? <Button title={t('admin.loadMore')} variant="outline" loading={more} onPress={() => load(rows.length)} /> : null}
          </>
        )}
      </Page>
      <ReasonSheet visible={!!cancelling} title={t('admin.cancelBooking')} placeholder={t('admin.cancelReason')} confirmLabel={t('admin.cancelBooking')} required={false} busy={busy} onClose={() => setCancelling(null)} onConfirm={cancel} />
      <ReasonSheet visible={!!refunding} title={t('admin.refund')} placeholder={t('admin.refundReason')} confirmLabel={t('admin.refund')} busy={busy} onClose={() => setRefunding(null)} onConfirm={refund} />
      <Sheet visible={!!paying} onClose={() => setPaying(null)} title={t('admin.markPaid')}>
        <Muted>{t('admin.markPaidHint')}</Muted>
        <TextField label={t('admin.paymentMethod')} value={method} onChangeText={setMethod} />
        <Button title={t('common.save')} loading={busy} onPress={markPaid} />
      </Sheet>
    </Screen>
  );
}
