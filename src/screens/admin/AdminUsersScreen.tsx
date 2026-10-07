import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { listUsers, setAccountStatus } from '../../api/admin';
import { Avatar, Badge, Button, Card, Chip, EmptyState, ErrorState, Header, Loading, Muted, Page, Row, Screen, StatusBadge, TextField, useAsync } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { errorKey } from '../../lib/errors';

export function AdminUsersScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | 'customer' | 'provider'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const { data, setData, loading, error, reload } = useAsync(() => listUsers(), []);

  const rows = (data?.rows ?? []).filter(u => (role === 'all' || u.role === role) && `${u.full_name ?? ''} ${u.phone ?? ''} ${u.city ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));

  const toggle = async (id: string, status: 'active' | 'suspended') => {
    const next = status === 'active' ? 'suspended' : 'active';
    setBusy(id);
    try { await setAccountStatus(id, next); setData(prev => (prev ? { ...prev, rows: prev.rows.map(u => (u.id === id ? { ...u, account_status: next } : u)) } : prev)); toast.show(t('common.saved'), 'success'); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };

  return (
    <Screen>
      <Header title={t('admin.users')} />
      <View style={{ padding: 16, gap: 10 }}>
        <TextField icon="search" value={q} onChangeText={setQ} placeholder={t('admin.searchUsers')} />
        <Row>{(['all', 'customer', 'provider'] as const).map(r => <Chip key={r} label={t(`admin.role.${r}` as never)} selected={role === r} onPress={() => setRole(r)} />)}</Row>
      </View>
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <Page contentStyle={{ paddingTop: 0 }}>
          {rows.length === 0 ? <EmptyState icon="people-outline" title={t('admin.noUsers')} /> : rows.map(u => (
            <Card key={u.id} style={{ gap: 10 }}>
              <Row gap={12}>
                <Avatar name={u.full_name ?? '?'} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{u.full_name || '—'}</Text>
                  <Muted numberOfLines={1}>{[u.phone, u.city].filter(Boolean).join(' · ') || '—'}</Muted>
                  <Muted>{formatDate(u.created_at, lang)}</Muted>
                </View>
                <View style={{ gap: 6, alignItems: 'flex-end' }}><Badge text={t(`admin.role.${u.role}` as never)} tone="info" /><StatusBadge status={u.account_status} /></View>
              </Row>
              <Button title={u.account_status === 'active' ? t('admin.suspend') : t('admin.activate')} variant={u.account_status === 'active' ? 'danger' : 'secondary'} size="sm" loading={busy === u.id} onPress={() => toggle(u.id, u.account_status)} />
            </Card>
          ))}
        </Page>
      )}
    </Screen>
  );
}
