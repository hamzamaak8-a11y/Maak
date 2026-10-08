import React from 'react';
import { Text, View } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../../components/ui';
import { AuthShell, GlassCard } from '../../components/AuthShell';
import { LegalLinks } from '../../components/LegalLinks';
import type { ScreenProps } from '../../navigation/types';

export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const { t } = useLanguage();
  return (
    <AuthShell heading={t('auth.welcomeToMaak')} subheading={t('brand.tagline')}>
      <GlassCard>
        <Button gradient title={t('welcome.browse')} icon="search" onPress={() => navigation.navigate('CustomerTabs')} />
        <Button title={t('welcome.signupCustomer')} variant="outline" icon="person-add-outline" onPress={() => navigation.navigate('Signup', { intent: 'customer' })} />
        <Button title={t('welcome.signupProvider')} variant="outline" icon="briefcase-outline" onPress={() => navigation.navigate('Signup', { intent: 'provider' })} />
      </GlassCard>
      <GlassCard style={{ alignItems: 'center', gap: 4, paddingVertical: 14 }}>
        <Text style={{ color: '#AAB9D0', fontSize: 15 }}>{t('welcome.haveAccount')}</Text>
        <Button title={t('auth.login')} variant="ghost" onPress={() => navigation.navigate('Login')} />
      </GlassCard>
      <View><LegalLinks prefix={false} /></View>
    </AuthShell>
  );
}
