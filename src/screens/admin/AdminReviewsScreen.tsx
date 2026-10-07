import React, { useState } from 'react';
import { Text } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { listAdminReviews, toggleReviewVisibility } from '../../api/admin';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Loading, Muted, Page, Row, Screen, Stars, useAsync } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { errorKey } from '../../lib/errors';

export function AdminReviewsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const toast = useToast();
  const { data, setData, loading, error, reload } = useAsync(() => listAdminReviews(0), []);
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (id: string) => {
    setBusy(id);
    try {
      const row = await toggleReviewVisibility(id);
      setData(prev => (prev ? { ...prev, rows: prev.rows.map(r => (r.id === id ? { ...r, is_hidden: row.is_hidden } : r)) } : prev));
    } catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };

  return (
    <Screen>
      <Header title={t('admin.reviews')} />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <Page>
          {(data?.rows ?? []).length === 0 ? <EmptyState icon="star-outline" title={t('admin.noReviews')} /> : (data?.rows ?? []).map(r => (
            <Card key={r.id} style={{ gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}><Stars value={r.rating} /><Muted>{formatDate(r.created_at, lang)}</Muted></Row>
              <Muted>{r.customer_name ?? '—'} → {r.provider_name ?? '—'}</Muted>
              {r.comment ? <Text style={{ color: colors.text, lineHeight: 21 }}>{r.comment}</Text> : null}
              <Row style={{ justifyContent: 'space-between' }}>
                {r.is_hidden ? <Badge text={t('reviews.hidden')} tone="warning" /> : <Badge text={t('reviews.visible')} tone="success" />}
                <Button title={r.is_hidden ? t('admin.show') : t('admin.hide')} size="sm" variant="secondary" loading={busy === r.id} onPress={() => toggle(r.id)} />
              </Row>
            </Card>
          ))}
        </Page>
      )}
    </Screen>
  );
}
