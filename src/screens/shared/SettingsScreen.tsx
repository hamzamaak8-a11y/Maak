import React from 'react';
import Constants from 'expo-constants';
import { Text } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Card, Chip, Header, Muted, Page, Row, Screen } from '../../components/ui';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import type { ThemeMode } from '../../types';

export function SettingsScreen() {
  const { t } = useLanguage();
  const { colors, mode, setMode } = useTheme();
  const modes: Array<{ key: ThemeMode; label: string }> = [{ key: 'system', label: t('settings.themeSystem') }, { key: 'light', label: t('settings.themeLight') }, { key: 'dark', label: t('settings.themeDark') }];
  return (
    <Screen>
      <Header title={t('settings.title')} />
      <Page>
        <Card style={{ gap: 12 }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{t('settings.language')}</Text><LanguageSwitcher /></Card>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{t('settings.theme')}</Text>
          <Row style={{ flexWrap: 'wrap' }}>{modes.map(m => <Chip key={m.key} label={m.label} selected={mode === m.key} onPress={() => setMode(m.key)} />)}</Row>
        </Card>
        <Muted style={{ textAlign: 'center' }}>Maak · v{Constants.expoConfig?.version ?? '1.0.0'}</Muted>
      </Page>
    </Screen>
  );
}
