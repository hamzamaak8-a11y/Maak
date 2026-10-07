import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { AdminBooking, adminCancelBooking, adminMarkPaid, listAdminBookings } from '../../api/admin';
import { Button, Card, EmptyState, ErrorState, Header, Loading, Muted, Page, ReasonSheet, Row, Screen, Sheet, StatusBadge, TextField, useAsync } from '../../components/ui';
import { formatDateTime, formatMoney } from '../../lib/format';
import { errorKey } from '../../lib/errors';

export function AdminBookingsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const toast = useToast();
  const { data, setData, loading, error, reload } = useAsync(() => listAdminBookings(), []);
  const [cancelling, setCancelling] = useState<AdminBooking | null>(null);
  const [paying, setPaying] = useState<AdminBooking | null>(null);
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(false);

  const cancel = async (reason: string) => {
    if (!cancelling) return;
    setBusy(true);
    try { await adminCancelBooking(cancelling.id, reason); setData(prev => (prev ?? []).map(b => (b.id === cancelling.id ? { ...b, status: 'cancelled' } : b))); setCancelling(null); toast.show(t('common.saved'), 'success'); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(false); }
  };

  const markPaid = async () => {
    if (!paying) return;
    setBusy(true);
    try { await adminMarkPaid(paying.id, method); setData(prev => (prev ?? []).map(b => (b.id === paying.id ? { ...b, payment_status: 'paid', payment_method: method } : b))); setPaying(null); toast.show(t('common.saved'), 'success'); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t('admin.bookings')} />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <Page>
          {(data ?? []).length === 0 ? <EmptyState icon="calendar-outline" title={t('admin.noBookings')} /> : (data ?? []).map(b => (
            <Card key={b.id} style={{ gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, flex: 1 }}>{b.service_category}</Text><StatusBadge status={b.status} /></Row>
              <Muted>{b.customer_name ?? '—'} → {b.provider_name ?? '—'}</Muted>
              <Muted>{formatDateTime(b.service_date, lang)}</Muted>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{b.price != null ? formatMoney(b.price, b.currency, lang) : '—'}</Text>
                <StatusBadge status={b.payment_status} />
              </Row>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {b.price != null && b.payment_status !== 'paid' ? <Button title={t('admin.markPaid')} size="sm" variant="secondary" onPress={() => { setMethod('cash'); setPaying(b); }} /> : null}
                {!['completed', 'cancelled', 'rejected'].includes(b.status) ? <Button title={t('admin.cancelBooking')} size="sm" variant="danger" onPress={() => setCancelling(b)} /> : null}
              </Row>
            </Card>
          ))}
        </Page>
      )}
      <ReasonSheet visible={!!cancelling} title={t('admin.cancelBooking')} placeholder={t('admin.cancelReason')} confirmLabel={t('admin.cancelBooking')} required={false} busy={busy} onClose={() => setCancelling(null)} onConfirm={cancel} />
      <Sheet visible={!!paying} onClose={() => setPaying(null)} title={t('admin.markPaid')}>
        <TextField label={t('admin.paymentMethod')} value={method} onChangeText={setMethod} />
        <Button title={t('common.save')} loading={busy} onPress={markPaid} />
      </Sheet>
    </Screen>
  );
}
