import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import type { Nav } from '../../navigation/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { Banner, Button, Form, Header, Muted, Page, Screen, TextField } from '../../components/ui';
import { errorKey } from '../../lib/errors';

export function SecurityScreen() {
  const { t } = useLanguage();
  const { changePassword, user } = useAuth();
  const toast = useToast();
  const nav = useNavigation<Nav>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (password.length < 8) { setError(t('auth.passwordShort')); return; }
    if (password !== confirm) { setError(t('auth.passwordMismatch')); return; }
    setBusy(true);
    try { await changePassword(password); setPassword(''); setConfirm(''); toast.show(t('security.updated'), 'success'); }
    catch (e) { setError(t(errorKey(e))); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t('security.title')} />
      <Form>
        <Page contentStyle={{ gap: 14 }}>
          <Muted>{t('security.text', { email: user?.email ?? '' })}</Muted>
          {error ? <Banner kind="error" text={error} /> : null}
          <TextField label={t('auth.newPassword')} icon="lock-closed-outline" secure value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="new-password" />
          <TextField label={t('auth.confirmPassword')} icon="lock-closed-outline" secure value={confirm} onChangeText={setConfirm} autoCapitalize="none" autoComplete="new-password" />
          <Button title={t('security.update')} onPress={save} loading={busy} />
          <Button title={t('delete.entry')} variant="ghost" icon="trash-outline" onPress={() => nav.navigate('DeleteAccount')} />
        </Page>
      </Form>
    </Screen>
  );
}
