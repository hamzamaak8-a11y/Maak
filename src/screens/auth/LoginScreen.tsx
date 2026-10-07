import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Banner, Button, Form, H1, Header, Muted, Page, Row, Screen, TextField } from '../../components/ui';
import { GoogleButton } from '../../components/GoogleButton';
import { errorKey } from '../../lib/errors';
import type { ScreenProps } from '../../navigation/types';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { colors } = useTheme();
  const { t } = useLanguage();
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
    catch (e) {
      const k = errorKey(e);
      setUnconfirmed(k === 'err.emailNotConfirmed');
      setError(t(k));
    } finally { setBusy(false); }
  };

  const resend = async () => {
    try { await resendConfirmation(email); setNote(t('auth.confirmationSent')); } catch (e) { setError(t(errorKey(e))); }
  };

  return (
    <Screen>
      <Header title={t('auth.login')} />
      <Form>
        <Page contentStyle={{ gap: 14 }}>
          <H1>{t('auth.welcomeBack')}</H1>
          <Muted>{t('auth.loginSubtitle')}</Muted>
          {error ? <Banner kind="error" text={error} /> : null}
          {note ? <Banner kind="success" text={note} /> : null}
          {unconfirmed ? <Button title={t('auth.resendConfirmation')} variant="outline" size="sm" onPress={resend} /> : null}
          <TextField label={t('auth.email')} icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="name@example.com" />
          <TextField label={t('auth.password')} icon="lock-closed-outline" secure value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="password" onSubmitEditing={submit} returnKeyType="go" />
          <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'flex-start' }}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{t('auth.forgot')}</Text>
          </Pressable>
          <Button title={t('auth.login')} onPress={submit} loading={busy} />
          <Row style={{ alignItems: 'center' }} gap={10}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} /><Muted>{t('auth.or')}</Muted><View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </Row>
          <GoogleButton intent="customer" />
          <Row style={{ justifyContent: 'center' }} gap={6}>
            <Muted>{t('auth.noAccount')}</Muted>
            <Pressable onPress={() => navigation.navigate('Signup', { intent: 'customer' })}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>{t('auth.createAccount')}</Text></Pressable>
          </Row>
        </Page>
      </Form>
    </Screen>
  );
}
