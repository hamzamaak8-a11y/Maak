import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GOOGLE_LOGIN_ENABLED } from '../../config/env';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Banner, Button, Muted, Row, TextField } from '../../components/ui';
import { AuthShell, GlassCard } from '../../components/AuthShell';
import { GoogleButton } from '../../components/GoogleButton';
import { errorKey } from '../../lib/errors';
import type { ScreenProps } from '../../navigation/types';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { t, isRTL } = useLanguage();
  const { signIn, resendConfirmation } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const submit = async () => {
    setError(null); setNote(null); setUnconfirmed(false);
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || !password) { setError(t('auth.fillAll')); return; }
    setBusy(true);
    try { await signIn(email, password); }
    catch (e) { const k = errorKey(e); setUnconfirmed(k === 'err.emailNotConfirmed'); setError(t(k)); }
    finally { setBusy(false); }
  };
  const resend = async () => { try { await resendConfirmation(email); setNote(t('auth.confirmationSent')); } catch (e) { setError(t(errorKey(e))); } };

  return (
    <AuthShell heading={t('auth.welcomeBack')} subheading={t('brand.tagline')} onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Welcome'))}
      footer={
        <GlassCard style={{ alignItems: 'center', gap: 6, paddingVertical: 16 }}>
          <Muted>{t('auth.noAccount')}</Muted>
          <Pressable onPress={() => navigation.navigate('Signup', { intent: 'customer' })} accessibilityRole="button">
            <Row gap={8}>
              <Text style={{ color: '#2DD4BF', fontWeight: '800', fontSize: 17 }}>{t('auth.createAccount')}</Text>
              <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color="#2DD4BF" />
            </Row>
          </Pressable>
        </GlassCard>
      }>
      <GlassCard>
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800' }}>{t('auth.login')}</Text>
          <Muted>{t('auth.loginCardText')}</Muted>
        </View>
        {error ? <Banner kind="error" text={error} /> : null}
        {note ? <Banner kind="success" text={note} /> : null}
        {unconfirmed ? <Button title={t('auth.resendConfirmation')} variant="outline" size="sm" onPress={resend} /> : null}
        <TextField label={t('auth.email')} icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="name@example.com" />
        <TextField label={t('auth.password')} icon="lock-closed-outline" secure value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="password" onSubmitEditing={submit} returnKeyType="go" />
        <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'flex-start' }} accessibilityRole="button">
          <Text style={{ color: '#2DD4BF', fontWeight: '700', fontSize: 14 }}>{t('auth.forgot')}</Text>
        </Pressable>
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
