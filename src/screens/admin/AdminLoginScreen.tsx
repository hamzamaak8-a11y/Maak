import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GOOGLE_LOGIN_ENABLED } from '../../config/env';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Banner, Button, Muted, Row, TextField } from '../../components/ui';
import { AuthShell, GlassCard } from '../../components/AuthShell';
import { GoogleButton } from '../../components/GoogleButton';
import { errorKey } from '../../lib/errors';

/** Sign-in of the standalone administration panel. No sign-up, no browsing, no way into the customer app. */
export function AdminLoginScreen() {
  const { t } = useLanguage();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || !password) { setError(t('auth.fillAll')); return; }
    setBusy(true);
    try { await signIn(email, password); }
    catch (e) { setError(t(errorKey(e))); }
    finally { setBusy(false); }
  };

  return (
    <AuthShell badge={t('admin.badge')} heading={t('admin.panelTitle')} subheading={t('admin.panelSubtitle')}>
      <GlassCard>
        <Row gap={10}>
          <Ionicons name="shield-checkmark" size={26} color="#2DD4BF" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>{t('auth.login')}</Text>
            <Muted>{t('admin.loginText')}</Muted>
          </View>
        </Row>
        {error ? <Banner kind="error" text={error} /> : null}
        <TextField label={t('auth.email')} icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="name@example.com" />
        <TextField label={t('auth.password')} icon="lock-closed-outline" secure value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="current-password" onSubmitEditing={submit} returnKeyType="go" />
        <Button gradient title={t('auth.login')} icon="log-in-outline" onPress={submit} loading={busy} />
        {GOOGLE_LOGIN_ENABLED ? (
          <>
            <Row gap={12} style={{ alignItems: 'center' }}>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(110,170,210,0.28)' }} /><Muted>{t('auth.or')}</Muted><View style={{ flex: 1, height: 1, backgroundColor: 'rgba(110,170,210,0.28)' }} />
            </Row>
            <GoogleButton intent="customer" />
          </>
        ) : null}
      </GlassCard>
    </AuthShell>
  );
}
