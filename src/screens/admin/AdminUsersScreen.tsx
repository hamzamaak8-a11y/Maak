import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DirectoryUser, directoryUsers } from '../../api/admin';
import { Avatar, Badge, Button, Card, Chip, EmptyState, ErrorState, Header, IconButton, Loading, Muted, Page, Row, Screen, StatusBadge, TextField } from '../../components/ui';
import { saveTextFile, toCsv } from '../../lib/csv';
import { errorKey } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import type { Nav } from '../../navigation/types';

const PAGE = 40;

export function AdminUsersScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<DirectoryUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const seq = useRef(0);

  useEffect(() => { const id = setTimeout(() => setQ(search), 300); return () => clearTimeout(id); }, [search]);

  const load = useCallback(async (offset: number) => {
    const mine = ++seq.current;
    if (offset === 0) setLoading(true); else setMore(true);
    setError(null);
    try {
      const data = await directoryUsers({ search: q, role, status, limit: PAGE, offset });
      if (mine !== seq.current) return;
      setRows(prev => (offset === 0 ? data : [...prev, ...data]));
      setTotal(data[0]?.total_count ?? (offset === 0 ? 0 : total));
    } catch (e) { if (mine === seq.current) setError(e); }
    finally { if (mine === seq.current) { setLoading(false); setMore(false); } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, status]);

  useEffect(() => { void load(0); }, [load]);

  const exportCsv = async () => {
    try {
      const all: DirectoryUser[] = [];
      for (let off = 0; off < 2000; off += 200) {
        const part = await directoryUsers({ search: q, role, status, limit: 200, offset: off });
        all.push(...part);
        if (part.length < 200) break;
      }
      await saveTextFile(`maak-users-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(['email', 'full_name', 'phone', 'city', 'role', 'account_status', 'provider_status', 'created_at', 'last_sign_in_at'], all as unknown as Array<Record<string, unknown>>));
    } catch (e) { toast.show(t(errorKey(e)), 'error'); }
  };

  return (
    <Screen>
      <Header title={t('admin.users')} noBack right={<IconButton icon="person-add-outline" label={t('admin.addUser')} onPress={() => nav.navigate('AdminCreateUser')} />} />
      <Page>
        <TextField icon="search" value={search} onChangeText={setSearch} placeholder={t('admin.searchUsers')} autoCapitalize="none" />
        <Row style={{ flexWrap: 'wrap' }}>
          {(['', 'customer', 'provider', 'admin'] as const).map(r => <Chip key={r || 'all'} label={t(`admin.role.${r || 'all'}` as never)} selected={role === r} onPress={() => setRole(r)} />)}
        </Row>
        <Row style={{ flexWrap: 'wrap' }}>
          {(['', 'active', 'suspended'] as const).map(s => <Chip key={s || 'any'} icon={s === 'suspended' ? 'ban-outline' : undefined} label={s ? t(`status.${s}` as never) : t('admin.anyStatus')} selected={status === s} onPress={() => setStatus(s)} />)}
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Muted>{t('admin.usersCount', { n: total })}</Muted>
          <Button title={t('admin.exportCsv')} icon="download-outline" variant="outline" size="sm" onPress={exportCsv} />
        </Row>

        {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={() => load(0)} /> : rows.length === 0 ? <EmptyState icon="people-outline" title={t('admin.noUsers')} /> : (
          <>
            {rows.map(u => (
              <Card key={u.id} onPress={() => nav.navigate('AdminUserDetail', { id: u.id })} style={{ gap: 10 }}>
                <Row gap={14}>
                  <Avatar name={u.full_name ?? u.email ?? '?'} size={50} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{u.full_name || '—'}</Text>
                    <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 14 }}>{u.email}</Text>
                    <Muted numberOfLines={1}>{[u.phone, u.city].filter(Boolean).join(' · ') || '—'}</Muted>
                  </View>
                  <View style={{ gap: 6, alignItems: 'flex-end' }}>
                    <Badge text={t(`admin.role.${u.role}` as never)} tone={u.role === 'admin' ? 'primary' : u.role === 'provider' ? 'info' : 'neutral'} />
                    <StatusBadge status={u.account_status} />
                  </View>
                </Row>
                <Muted>{t('admin.joined', { date: formatDate(u.created_at, lang) })} · {u.last_sign_in_at ? t('admin.lastSeen', { date: formatDate(u.last_sign_in_at, lang) }) : t('admin.neverSignedIn')}</Muted>
              </Card>
            ))}
            {rows.length < total ? <Button title={t('admin.loadMore')} variant="outline" loading={more} onPress={() => load(rows.length)} /> : null}
          </>
        )}
      </Page>
    </Screen>
  );
}
