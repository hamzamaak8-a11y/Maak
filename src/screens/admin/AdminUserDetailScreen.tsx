import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { WEB_URL } from '../../config/env';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { deleteUserAccount, setAccountStatus, userOverview } from '../../api/admin';
import { recoveryLink } from '../../api/adminOps';
import { Avatar, Badge, Banner, Button, Card, ErrorState, Header, InfoRow, Loading, Muted, Page, Row, Screen, Sheet, StatusBadge, TextField, useAsync } from '../../components/ui';
import { categoryLabel } from '../../constants/categories';
import { copyText } from '../../lib/csv';
import { errorKey } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import type { ScreenProps } from '../../navigation/types';

export function AdminUserDetailScreen({ navigation, route }: ScreenProps<'AdminUserDetail'>) {
  const { id } = route.params;
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const { data: u, setData, loading, error, reload } = useAsync(() => userOverview(id), [id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState('');

  const isSelf = user?.id === id;
  const isAdmin = u?.role === 'admin';

  const toggleStatus = async () => {
    if (!u) return;
    const next = u.account_status === 'active' ? 'suspended' : 'active';
    setBusy('status');
    try { await setAccountStatus(u.id, next); setData({ ...u, account_status: next }); toast.show(t('common.saved'), 'success'); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };

  const makeLink = async () => {
    setBusy('link');
    try { const r = await recoveryLink(id, WEB_URL + '/'); setLink(r.link); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };

  const remove = async () => {
    setBusy('delete');
    try { await deleteUserAccount(id); toast.show(t('admin.userDeleted'), 'success'); setDeleting(false); navigation.goBack(); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };

  return (
    <Screen>
      <Header title={t('admin.userDetails')} />
      {loading && !u ? <Loading /> : error && !u ? <ErrorState error={error} onRetry={reload} /> : u ? (
        <Page>
          <Card style={{ gap: 16 }}>
            <Row gap={16}>
              <Avatar name={u.full_name ?? u.email ?? '?'} size={72} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{u.full_name || '—'}</Text>
                <Row style={{ flexWrap: 'wrap' }}>
                  <Badge text={t(`admin.role.${u.role}` as never)} tone={u.role === 'admin' ? 'primary' : u.role === 'provider' ? 'info' : 'neutral'} />
                  <StatusBadge status={u.account_status} />
                  {u.email_confirmed ? <Badge text={t('admin.emailConfirmed')} tone="success" /> : <Badge text={t('admin.emailUnconfirmed')} tone="warning" />}
                </Row>
              </View>
            </Row>
            <InfoRow icon="mail-outline" label={t('auth.email')} value={u.email} />
            <InfoRow icon="call-outline" label={t('profile.phone')} value={u.phone} />
            <InfoRow icon="location-outline" label={t('provider.city')} value={u.city} />
            <InfoRow icon="calendar-outline" label={t('admin.joinedOn')} value={formatDateTime(u.created_at, lang)} />
            <InfoRow icon="time-outline" label={t('admin.lastSignIn')} value={u.last_sign_in_at ? formatDateTime(u.last_sign_in_at, lang) : t('admin.neverSignedIn')} />
          </Card>

          {u.provider_status ? (
            <Card style={{ gap: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>{t('admin.providerProfile')}</Text>
                <StatusBadge status={u.provider_status} />
              </Row>
              <InfoRow icon="briefcase-outline" label={t('application.profession')} value={u.profession} />
              <InfoRow icon="apps-outline" label={t('application.category')} value={u.service_category ? categoryLabel(u.service_category, lang) : null} />
              <InfoRow icon="alert-circle-outline" label={t('application.rejectedReason')} value={u.rejection_reason} />
              <Badge text={u.listing_published ? t('admin.listingPublished') : t('admin.listingHidden')} tone={u.listing_published ? 'success' : 'neutral'} />
            </Card>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {[
              [t('admin.stat.asCustomer'), u.bookings_as_customer], [t('admin.stat.asProvider'), u.bookings_as_provider], [t('admin.stat.open'), u.open_bookings],
              [t('admin.stat.reviewsWritten'), u.reviews_written], [t('admin.stat.reviewsReceived'), u.reviews_received], [t('admin.stat.reports'), `${u.open_reports_against}/${u.reports_against}`],
            ].map(([label, value]) => (
              <View key={String(label)} style={{ flexBasis: '30%', flexGrow: 1, minWidth: 104, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{String(value)}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{String(label)}</Text>
              </View>
            ))}
          </View>

          {!isAdmin && !isSelf ? (
            <Card style={{ gap: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>{t('admin.actions')}</Text>
              <Button title={u.account_status === 'active' ? t('admin.suspend') : t('admin.activate')} variant={u.account_status === 'active' ? 'danger' : 'secondary'} icon={u.account_status === 'active' ? 'ban-outline' : 'checkmark-circle-outline'} loading={busy === 'status'} onPress={toggleStatus} />
              <Button title={t('admin.resetLink')} variant="outline" icon="key-outline" loading={busy === 'link'} onPress={makeLink} />
              <Button title={t('admin.deleteUser')} variant="ghost" icon="trash-outline" onPress={() => { setTyped(''); setDeleting(true); }} />
            </Card>
          ) : <Banner kind="info" text={isSelf ? t('admin.thisIsYou') : t('admin.adminProtected')} />}
        </Page>
      ) : null}

      <Sheet visible={!!link} onClose={() => setLink(null)} title={t('admin.resetLink')}>
        <Banner kind="warning" text={t('admin.resetLinkWarn')} />
        <Text selectable style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>{link}</Text>
        <Button title={t('admin.copy')} icon="copy-outline" onPress={async () => { if (link) { await copyText(link); toast.show(t('admin.copied'), 'success'); } }} />
      </Sheet>

      <Sheet visible={deleting} onClose={() => setDeleting(false)} title={t('admin.deleteUser')}>
        <Banner kind="error" text={t('admin.deleteWarn')} />
        <Muted>{t('delete.confirmLabel', { email: u?.email ?? '' })}</Muted>
        <TextField value={typed} onChangeText={setTyped} autoCapitalize="none" placeholder={u?.email ?? ''} />
        <Button title={t('admin.deleteUser')} variant="danger" disabled={!u?.email || typed.trim().toLowerCase() !== u.email.toLowerCase()} loading={busy === 'delete'} onPress={remove} />
      </Sheet>
    </Screen>
  );
}
