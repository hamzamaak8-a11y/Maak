import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GOOGLE_LOGIN_ENABLED } from '../../config/env';
import { useAuth, Intent } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Banner, Button, Chip, Muted, Row, TextField } from '../../components/ui';
import { AuthShell, GlassCard } from '../../components/AuthShell';
import { GoogleButton } from '../../components/GoogleButton';
import { LegalLinks } from '../../components/LegalLinks';
import { errorKey } from '../../lib/errors';
import type { ScreenProps } from '../../navigation/types';

export function SignupScreen({ navigation, route }: ScreenProps<'Signup'>) {
  const { t, isRTL } = useLanguage();
  const { signUp, resendConfirmation } = useAuth();
  const [intent, setIntent] = useState<Intent>(route.params?.intent ?? 'customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Welcome'));

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) { setError(t('auth.nameRequired')); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(t('auth.emailInvalid')); return; }
    if (password.length < 8) { setError(t('auth.passwordShort')); return; }
    if (password !== confirm) { setError(t('auth.passwordMismatch')); return; }
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp({ email, password, fullName: name, intent });
      if (needsConfirmation) setSentTo(email.trim());
    } catch (e) { setError(t(errorKey(e))); }
    finally { setBusy(false); }
  };

  if (sentTo) {
    return (
      <AuthShell heading={t('auth.checkEmail')} subheading={t('auth.checkEmailText', { email: sentTo })} onBack={back}>
        <GlassCard>
          <View style={{ alignItems: 'center' }}><Ionicons name="mail-open-outline" size={44} color="#2DD4BF" /></View>
          {note ? <Banner kind="success" text={note} /> : null}
          {error ? <Banner kind="error" text={error} /> : null}
          <Button title={t('auth.resendConfirmation')} variant="outline" onPress={async () => { try { await resendConfirmation(sentTo); setNote(t('auth.confirmationSent')); } catch (e) { setError(t(errorKey(e))); } }} />
          <Button gradient title={t('auth.login')} onPress={() => navigation.navigate('Login')} />
        </GlassCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading={intent === 'provider' ? t('auth.joinProvider') : t('auth.joinCustomer')} subheading={intent === 'provider' ? t('auth.providerHint') : t('auth.customerHint')} onBack={back}
      footer={
        <GlassCard style={{ alignItems: 'center', gap: 6, paddingVertical: 16 }}>
          <Muted>{t('welcome.haveAccount')}</Muted>
          <Pressable onPress={() => navigation.navigate('Login')} accessibilityRole="button">
            <Row gap={8}>
              <Text style={{ color: '#2DD4BF', fontWeight: '800', fontSize: 17 }}>{t('auth.login')}</Text>
              <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color="#2DD4BF" />
            </Row>
          </Pressable>
        </GlassCard>
      }>
      <GlassCard>
        <Row gap={8}>
          <Chip label={t('auth.roleCustomer')} icon="person-outline" selected={intent === 'customer'} onPress={() => setIntent('customer')} />
          <Chip label={t('auth.roleProvider')} icon="briefcase-outline" selected={intent === 'provider'} onPress={() => setIntent('provider')} />
        </Row>
        {error ? <Banner kind="error" text={error} /> : null}
        <TextField label={t('auth.fullName')} icon="person-outline" value={name} onChangeText={setName} autoComplete="name" />
        <TextField label={t('auth.email')} icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="name@example.com" />
        <TextField label={t('auth.password')} icon="lock-closed-outline" secure value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="new-password" />
        <TextField label={t('auth.confirmPassword')} icon="lock-closed-outline" secure value={confirm} onChangeText={setConfirm} autoCapitalize="none" autoComplete="new-password" onSubmitEditing={submit} />
        {intent === 'provider' ? <Banner kind="info" text={t('auth.providerNextStep')} /> : null}
        <Button gradient title={t('auth.createAccount')} icon="person-add-outline" onPress={submit} loading={busy} />
        {GOOGLE_LOGIN_ENABLED ? (
          <>
            <Row gap={12} style={{ alignItems: 'center' }}>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(110,170,210,0.28)' }} /><Muted>{t('auth.or')}</Muted><View style={{ flex: 1, height: 1, backgroundColor: 'rgba(110,170,210,0.28)' }} />
            </Row>
            <GoogleButton intent={intent} />
          </>
        ) : null}
        <LegalLinks />
      </GlassCard>
    </AuthShell>
  );
}
