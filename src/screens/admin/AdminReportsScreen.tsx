import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { setAccountStatus, toggleReviewVisibility } from '../../api/admin';
import { AdminReport, listReports, resolveReport } from '../../api/reports';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Loading, Muted, Page, ReasonSheet, Row, Screen, StatusBadge, Tabs, useAsync } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import { errorKey } from '../../lib/errors';

type Filter = 'open' | 'resolved' | 'dismissed';

export function AdminReportsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('open');
  const [closing, setClosing] = useState<{ report: AdminReport; status: 'resolved' | 'dismissed' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { data, setData, loading, error, reload } = useAsync(() => listReports(filter), [filter]);

  const suspend = async (r: AdminReport) => {
    if (!r.reported_user_id) return;
    setBusy(r.id + 'u');
    try { await setAccountStatus(r.reported_user_id, 'suspended'); setData(prev => (prev ?? []).map(x => (x.reported_user_id === r.reported_user_id ? { ...x, reported_account_status: 'suspended' } : x))); toast.show(t('common.saved'), 'success'); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };
  const hideReview = async (r: AdminReport) => {
    setBusy(r.id + 'r');
    try { await toggleReviewVisibility(r.target_id); toast.show(t('common.saved'), 'success'); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };
  const close = async (note: string) => {
    if (!closing) return;
    setBusy(closing.report.id);
    try { await resolveReport(closing.report.id, closing.status, note); setData(prev => (prev ?? []).filter(x => x.id !== closing.report.id)); setClosing(null); toast.show(t('common.saved'), 'success'); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };

  return (
    <Screen>
      <Header title={t('admin.reports')} />
      <View style={{ paddingVertical: 12 }}>
        <Tabs items={(['open', 'resolved', 'dismissed'] as Filter[]).map(k => ({ key: k, label: t(`status.${k}` as never) }))} value={filter} onChange={setFilter} />
      </View>
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <Page>
          {(data ?? []).length === 0 ? <EmptyState icon="flag-outline" title={t('admin.noReports')} /> : (data ?? []).map(r => (
            <Card key={r.id} style={{ gap: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Badge text={t(`report.reason.${r.reason}` as never)} tone="warning" />
                <Muted>{formatDateTime(r.created_at, lang)}</Muted>
              </Row>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{t('admin.reportAbout', { name: r.reported_name ?? '—' })}</Text>
              <Muted>{t('admin.reportBy', { name: r.reporter_name ?? '—' })} · {t(`report.target.${r.target_type}` as never)}</Muted>
              {r.content ? <Text style={{ color: colors.text, lineHeight: 21, backgroundColor: colors.surfaceAlt, padding: 10, borderRadius: 10 }}>{r.content}</Text> : null}
              {r.details ? <Muted>{r.details}</Muted> : null}
              {r.reported_account_status ? <StatusBadge status={r.reported_account_status} /> : null}
              {r.status === 'open' ? (
                <>
                  <Row gap={8} style={{ flexWrap: 'wrap' }}>
                    {r.reported_user_id && r.reported_account_status === 'active' ? <Button title={t('admin.suspendUser')} size="sm" variant="danger" loading={busy === r.id + 'u'} onPress={() => suspend(r)} /> : null}
                    {r.target_type === 'review' ? <Button title={t('admin.hideReview')} size="sm" variant="secondary" loading={busy === r.id + 'r'} onPress={() => hideReview(r)} /> : null}
                  </Row>
                  <Row gap={8}>
                    <Button title={t('admin.resolve')} size="sm" style={{ flex: 1 }} onPress={() => setClosing({ report: r, status: 'resolved' })} />
                    <Button title={t('admin.dismiss')} size="sm" variant="outline" style={{ flex: 1 }} onPress={() => setClosing({ report: r, status: 'dismissed' })} />
                  </Row>
                </>
              ) : r.resolution_note ? <Muted>{r.resolution_note}</Muted> : null}
            </Card>
          ))}
        </Page>
      )}
      <ReasonSheet visible={!!closing} title={closing?.status === 'dismissed' ? t('admin.dismiss') : t('admin.resolve')} placeholder={t('admin.resolveNote')} confirmLabel={closing?.status === 'dismissed' ? t('admin.dismiss') : t('admin.resolve')} required={false} busy={!!busy} onClose={() => setClosing(null)} onConfirm={close} />
    </Screen>
  );
}
