import React from 'react';
import { Image, Text, View } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Muted, Page, Screen } from '../../components/ui';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import type { ScreenProps } from '../../navigation/types';

export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  return (
    <Screen>
      <Page contentStyle={{ paddingTop: 12, gap: 28 }}>
        <View style={{ alignItems: 'flex-end' }}><LanguageSwitcher compact /></View>
        <View style={{ alignItems: 'center', gap: 12, marginTop: 8 }}>
          <Image source={require('../../../assets/splash-icon.png')} style={{ width: 96, height: 96, borderRadius: 24 }} />
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: '900' }}>Maak</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center', lineHeight: 24 }}>{t('welcome.tagline')}</Text>
        </View>
        <View style={{ gap: 12 }}>
          <Button title={t('welcome.browse')} icon="search" onPress={() => navigation.navigate('CustomerTabs')} />
          <Button title={t('welcome.signupCustomer')} variant="secondary" icon="person-add-outline" onPress={() => navigation.navigate('Signup', { intent: 'customer' })} />
          <Button title={t('welcome.signupProvider')} variant="outline" icon="briefcase-outline" onPress={() => navigation.navigate('Signup', { intent: 'provider' })} />
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Muted>{t('welcome.haveAccount')}</Muted>
          <Button title={t('auth.login')} variant="ghost" onPress={() => navigation.navigate('Login')} />
        </View>
      </Page>
    </Screen>
  );
}
