import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Banner, Button, Form, H1, Header, Muted, Page, Screen, TextField } from '../../components/ui';
import { errorKey } from '../../lib/errors';

export function ResetPasswordScreen() {
  const { t } = useLanguage();
  const { changePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 8) { setError(t('auth.passwordShort')); return; }
    if (password !== confirm) { setError(t('auth.passwordMismatch')); return; }
    setBusy(true);
    try { await changePassword(password); }
    catch (e) { setError(t(errorKey(e))); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t('auth.newPassword')} noBack />
      <Form>
        <Page contentStyle={{ gap: 14 }}>
          <H1>{t('auth.newPassword')}</H1>
          <Muted>{t('auth.newPasswordText')}</Muted>
          {error ? <Banner kind="error" text={error} /> : null}
          <TextField label={t('auth.newPassword')} icon="lock-closed-outline" secure value={password} onChangeText={setPassword} autoCapitalize="none" />
          <TextField label={t('auth.confirmPassword')} icon="lock-closed-outline" secure value={confirm} onChangeText={setConfirm} autoCapitalize="none" onSubmitEditing={submit} />
          <Button title={t('common.save')} onPress={submit} loading={busy} />
        </Page>
      </Form>
    </Screen>
  );
}
