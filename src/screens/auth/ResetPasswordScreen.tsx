import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Banner, Button, TextField } from '../../components/ui';
import { AuthShell, GlassCard } from '../../components/AuthShell';
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
    <AuthShell heading={t('auth.newPassword')} subheading={t('auth.newPasswordText')}>
      <GlassCard>
        {error ? <Banner kind="error" text={error} /> : null}
        <TextField label={t('auth.newPassword')} icon="lock-closed-outline" secure value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="new-password" />
        <TextField label={t('auth.confirmPassword')} icon="lock-closed-outline" secure value={confirm} onChangeText={setConfirm} autoCapitalize="none" autoComplete="new-password" onSubmitEditing={submit} />
        <Button gradient title={t('common.save')} onPress={submit} loading={busy} />
      </GlassCard>
    </AuthShell>
  );
}
