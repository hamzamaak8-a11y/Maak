import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { sendAnnouncement } from '../../api/admin';
import { Banner, Button, Card, Chip, Form, Header, Muted, Page, Row, Screen, Sheet, TextField } from '../../components/ui';
import { errorKey } from '../../lib/errors';

type Audience = 'all' | 'customers' | 'providers';

export function AdminAnnouncementsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [audience, setAudience] = useState<Audience>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  const valid = title.trim().length > 0 && title.length <= 80 && body.trim().length > 0 && body.length <= 500;
  const send = async () => {
    setBusy(true); setError(null);
    try { const n = await sendAnnouncement(audience, title, body); setSent(n); setConfirm(false); setTitle(''); setBody(''); }
    catch (e) { setError(t(errorKey(e))); setConfirm(false); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t('admin.announcements')} noBack />
      <Form>
        <Page>
          <Muted>{t('admin.announcementsText')}</Muted>
          {sent !== null ? <Banner kind="success" text={t('admin.announcementSent', { n: sent })} /> : null}
          {error ? <Banner kind="error" text={error} /> : null}
          <Card style={{ gap: 14 }}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>{t('admin.audience')}</Text>
            <Row style={{ flexWrap: 'wrap' }}>
              {(['all', 'customers', 'providers'] as Audience[]).map(a => <Chip key={a} label={t(`admin.audience.${a}` as never)} selected={audience === a} onPress={() => setAudience(a)} />)}
            </Row>
            <TextField label={`${t('admin.announceTitle')} (${title.length}/80)`} value={title} onChangeText={setTitle} maxLength={80} />
            <TextField label={`${t('admin.announceBody')} (${body.length}/500)`} value={body} onChangeText={setBody} maxLength={500} multiline />
          </Card>
          <Card style={{ gap: 6, backgroundColor: colors.primaryLight, borderColor: colors.primary }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800' }}>{t('admin.preview')}</Text>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{title || t('admin.announceTitle')}</Text>
            <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>{body || t('admin.announceBody')}</Text>
          </Card>
          <Button title={t('admin.sendAnnouncement')} icon="megaphone-outline" disabled={!valid} onPress={() => setConfirm(true)} />
        </Page>
      </Form>
      <Sheet visible={confirm} onClose={() => setConfirm(false)} title={t('admin.sendAnnouncement')}>
        <Banner kind="warning" text={t('admin.announceConfirm', { audience: t(`admin.audience.${audience}` as never) })} />
        <View style={{ gap: 4 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{title}</Text><Muted>{body}</Muted></View>
        <Button title={t('admin.sendNow')} loading={busy} onPress={send} />
        <Button title={t('common.cancel')} variant="ghost" onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}
