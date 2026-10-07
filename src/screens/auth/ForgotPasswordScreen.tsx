import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Banner, Button, Form, H1, Header, Muted, Page, Screen, TextField } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import type { ScreenProps } from '../../navigation/types';

export function ForgotPasswordScreen({ navigation }: ScreenProps<'ForgotPassword'>) {
  const { t } = useLanguage();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(t('auth.emailInvalid')); return; }
    setBusy(true);
    try { await sendPasswordReset(email); setSent(true); }
    catch (e) { setError(t(errorKey(e))); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t('auth.forgot')} />
      <Form>
        <Page contentStyle={{ gap: 14 }}>
          <H1>{t('auth.resetTitle')}</H1>
          <Muted>{t('auth.resetText')}</Muted>
          {error ? <Banner kind="error" text={error} /> : null}
          {sent ? <Banner kind="success" text={t('auth.resetSent')} /> : null}
          <TextField label={t('auth.email')} icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" onSubmitEditing={submit} />
          <Button title={t('auth.sendResetLink')} onPress={submit} loading={busy} />
          <Button title={t('auth.backToLogin')} variant="ghost" onPress={() => navigation.navigate('Login')} />
        </Page>
      </Form>
    </Screen>
  );
}
