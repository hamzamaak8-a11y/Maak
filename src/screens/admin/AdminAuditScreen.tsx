import React from 'react';
import { Text } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { listAudit } from '../../api/admin';
import { Card, EmptyState, ErrorState, Header, Loading, Muted, Page, Screen, useAsync } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

export function AdminAuditScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { data, loading, error, reload } = useAsync(() => listAudit(), []);
  return (
    <Screen>
      <Header title={t('admin.audit')} />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <Page>
          {(data ?? []).length === 0 ? <EmptyState icon="list-outline" title={t('admin.noAudit')} /> : (data ?? []).map(a => (
            <Card key={a.id} style={{ gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{a.action}</Text>
              <Muted>{a.target_type}{a.target_id ? ` · ${a.target_id.slice(0, 8)}…` : ''}</Muted>
              <Muted>{formatDateTime(a.created_at, lang)}</Muted>
            </Card>
          ))}
        </Page>
      )}
    </Screen>
  );
}
