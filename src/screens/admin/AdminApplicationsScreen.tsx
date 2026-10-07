import React, { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { AdminApplication, AdminDocument, approveProvider, listApplicationDocuments, listApplications, rejectProvider, signedDocumentUrl } from '../../api/admin';
import { Button, Card, EmptyState, ErrorState, Header, InfoRow, Loading, Muted, ReasonSheet, Row, Screen, StatusBadge, Tabs, useAsync, Page } from '../../components/ui';
import { categoryLabel } from '../../constants/categories';
import { formatDate } from '../../lib/format';
import { errorKey } from '../../lib/errors';
import type { VerificationStatus } from '../../types';

type Filter = Extract<VerificationStatus, 'pending' | 'approved' | 'rejected' | 'suspended'>;

export function AdminApplicationsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('pending');
  const [openId, setOpenId] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, AdminDocument[]>>({});
  const [rejecting, setRejecting] = useState<AdminApplication | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { data, setData, loading, error, reload } = useAsync(() => listApplications(filter), [filter]);

  const toggle = async (a: AdminApplication) => {
    if (openId === a.id) { setOpenId(null); return; }
    setOpenId(a.id);
    if (!docs[a.id]) {
      try { const d = await listApplicationDocuments(a.id); setDocs(prev => ({ ...prev, [a.id]: d })); }
      catch (e) { toast.show(t(errorKey(e)), 'error'); }
    }
  };

  const openDoc = async (d: AdminDocument) => {
    try { await Linking.openURL(await signedDocumentUrl(d.storage_path)); } catch (e) { toast.show(t(errorKey(e)), 'error'); }
  };

  const approve = async (a: AdminApplication) => {
    setBusy(a.id);
    try { await approveProvider(a.id); setData(prev => (prev ?? []).filter(x => x.id !== a.id)); toast.show(t('admin.approvedToast'), 'success'); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };

  const reject = async (reason: string) => {
    if (!rejecting) return;
    setBusy(rejecting.id);
    try { await rejectProvider(rejecting.id, reason); setData(prev => (prev ?? []).filter(x => x.id !== rejecting.id)); setRejecting(null); toast.show(t('admin.rejectedToast'), 'success'); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };

  return (
    <Screen>
      <Header title={t('admin.applications')} />
      <View style={{ paddingVertical: 12 }}>
        <Tabs items={(['pending', 'approved', 'rejected', 'suspended'] as Filter[]).map(k => ({ key: k, label: t(`status.${k}` as never) }))} value={filter} onChange={setFilter} />
      </View>
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <Page>
          {(data ?? []).length === 0 ? <EmptyState icon="document-text-outline" title={t('admin.noApplications')} /> : (data ?? []).map(a => (
            <Card key={a.id} style={{ gap: 12 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{a.full_name || '—'}</Text>
                  <Muted>{a.profession} · {categoryLabel(a.service_category, lang)}</Muted>
                  <Muted>{a.city} · {a.phone}</Muted>
                </View>
                <StatusBadge status={a.verification_status} />
              </Row>
              <Muted>{t('admin.submitted', { date: formatDate(a.updated_at, lang) })}</Muted>
              <Button title={openId === a.id ? t('admin.hideDetails') : t('admin.showDetails')} variant="ghost" size="sm" onPress={() => toggle(a)} />
              {openId === a.id ? (
                <View style={{ gap: 10 }}>
                  <InfoRow icon="information-circle-outline" label={t('application.bio')} value={a.bio} />
                  <InfoRow icon="time-outline" label={t('application.years')} value={a.experience_years != null ? String(a.experience_years) : null} />
                  <InfoRow icon="alert-circle-outline" label={t('application.rejectedReason')} value={a.rejection_reason} />
                  <Text style={{ color: colors.text, fontWeight: '800' }}>{t('application.documents')}</Text>
                  {(docs[a.id] ?? []).map(d => (
                    <Row key={d.id} style={{ justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textSecondary }}>{t(`doc.${d.document_type}` as never)}</Text>
                      <Button title={t('admin.openDocument')} variant="secondary" size="sm" icon="open-outline" onPress={() => openDoc(d)} />
                    </Row>
                  ))}
                  {docs[a.id] && docs[a.id].length === 0 ? <Muted>{t('admin.noDocuments')}</Muted> : null}
                </View>
              ) : null}
              {a.verification_status === 'pending' ? (
                <Row gap={10}>
                  <Button title={t('admin.approve')} icon="checkmark" loading={busy === a.id} onPress={() => approve(a)} style={{ flex: 1 }} />
                  <Button title={t('admin.reject')} variant="danger" onPress={() => setRejecting(a)} style={{ flex: 1 }} />
                </Row>
              ) : null}
            </Card>
          ))}
        </Page>
      )}
      <ReasonSheet visible={!!rejecting} title={t('admin.rejectTitle')} placeholder={t('admin.rejectPlaceholder')} confirmLabel={t('admin.reject')} busy={!!busy} onClose={() => setRejecting(null)} onConfirm={reject} />
    </Screen>
  );
}
