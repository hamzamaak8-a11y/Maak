import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Banner, Button, TextField } from '../../components/ui';
import { AuthShell, GlassCard } from '../../components/AuthShell';
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
    <AuthShell heading={t('auth.resetTitle')} subheading={t('auth.resetText')} onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))}>
      <GlassCard>
        {error ? <Banner kind="error" text={error} /> : null}
        {sent ? <Banner kind="success" text={t('auth.resetSent')} /> : null}
        <TextField label={t('auth.email')} icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" onSubmitEditing={submit} />
        <Button gradient title={t('auth.sendResetLink')} icon="paper-plane-outline" onPress={submit} loading={busy} />
        <Button title={t('auth.backToLogin')} variant="ghost" onPress={() => navigation.navigate('Login')} />
      </GlassCard>
    </AuthShell>
  );
}
