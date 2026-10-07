import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth, Intent } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Banner, Button, Chip, EmptyState, Form, H1, Header, Muted, Page, Row, Screen, TextField } from '../../components/ui';
import { GoogleButton } from '../../components/GoogleButton';
import { errorKey } from '../../lib/errors';
import type { ScreenProps } from '../../navigation/types';

export function SignupScreen({ navigation, route }: ScreenProps<'Signup'>) {
  const { colors } = useTheme();
  const { t } = useLanguage();
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
      <Screen>
        <Header title={t('auth.createAccount')} />
        <Page>
          <EmptyState icon="mail-open-outline" title={t('auth.checkEmail')} text={t('auth.checkEmailText', { email: sentTo })}
            action={<View style={{ gap: 10, minWidth: 240 }}>
              {note ? <Banner kind="success" text={note} /> : null}
              <Button title={t('auth.resendConfirmation')} variant="outline" onPress={async () => { try { await resendConfirmation(sentTo); setNote(t('auth.confirmationSent')); } catch (e) { setError(t(errorKey(e))); } }} />
              <Button title={t('auth.login')} onPress={() => navigation.navigate('Login')} />
            </View>} />
          {error ? <Banner kind="error" text={error} /> : null}
        </Page>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('auth.createAccount')} />
      <Form>
        <Page contentStyle={{ gap: 14 }}>
          <H1>{intent === 'provider' ? t('auth.joinProvider') : t('auth.joinCustomer')}</H1>
          <Muted>{intent === 'provider' ? t('auth.providerHint') : t('auth.customerHint')}</Muted>
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
          <Button title={t('auth.createAccount')} onPress={submit} loading={busy} />
          <Row style={{ alignItems: 'center' }} gap={10}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} /><Muted>{t('auth.or')}</Muted><View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </Row>
          <GoogleButton intent={intent} />
          <Muted style={{ textAlign: 'center' }}>{t('auth.terms')}</Muted>
          <Row style={{ justifyContent: 'center' }} gap={6}>
            <Muted>{t('welcome.haveAccount')}</Muted>
            <Pressable onPress={() => navigation.navigate('Login')}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>{t('auth.login')}</Text></Pressable>
          </Row>
        </Page>
      </Form>
    </Screen>
  );
}
