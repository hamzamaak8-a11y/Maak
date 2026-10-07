import React, { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { legalUrl } from '../../config/env';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { deleteMyAccount } from '../../api/account';
import { Banner, Button, Card, Form, Header, Muted, Page, Row, Screen, TextField } from '../../components/ui';
import { errorKey } from '../../lib/errors';

export function DeleteAccountScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user, role, signOut, clearIntent } = useAuth();
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = user?.email ?? '';
  const matches = !!email && typed.trim().toLowerCase() === email.toLowerCase();

  const remove = async () => {
    if (!user || !matches) return;
    setBusy(true); setError(null);
    try {
      await deleteMyAccount(user.id);
      await clearIntent();
      toast.show(t('delete.done'), 'success');
      await signOut();
    } catch (e) { setError(t(errorKey(e))); setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t('delete.title')} />
      <Form>
        <Page contentStyle={{ gap: 14 }}>
          <Card style={{ gap: 10, borderColor: colors.error }}>
            <Row><Ionicons name="warning" size={22} color={colors.error} /><Text style={{ color: colors.error, fontWeight: '800', fontSize: 16, flex: 1 }}>{t('delete.warning')}</Text></Row>
            {(['delete.what1', 'delete.what2', 'delete.what3'] as const).map(k => (
              <Row key={k} gap={8} style={{ alignItems: 'flex-start' }}><Text style={{ color: colors.textSecondary }}>•</Text><Muted style={{ flex: 1 }}>{t(k)}</Muted></Row>
            ))}
          </Card>
          {role === 'admin' ? <Banner kind="warning" text={t('err.adminCannotDelete')} /> : (
            <>
              <Banner kind="info" text={t('delete.activeNote')} />
              {error ? <Banner kind="error" text={error} /> : null}
              <TextField label={t('delete.confirmLabel', { email })} value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder={email} />
              <Button title={t('delete.confirm')} variant="danger" disabled={!matches} loading={busy} onPress={remove} />
            </>
          )}
          <View style={{ alignItems: 'center' }}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }} onPress={() => Linking.openURL(legalUrl('privacy'))}>{t('legal.privacy')}</Text></View>
        </Page>
      </Form>
    </Screen>
  );
}
