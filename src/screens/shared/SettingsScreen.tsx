import React, { useCallback, useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { Linking, Text } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PUSH_SUPPORTED, PushState, disablePush, enablePush, pushState } from '../../lib/push';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Banner, Button, Card, Chip, Header, Muted, Page, Row, Screen } from '../../components/ui';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { LegalLinks } from '../../components/LegalLinks';
import type { ThemeMode } from '../../types';

export function SettingsScreen() {
  const { t, lang } = useLanguage();
  const { colors, mode, setMode } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [push, setPush] = useState<PushState>('unsupported');
  const [busy, setBusy] = useState(false);
  const refreshPushState = useCallback(() => { pushState().then(setPush).catch(() => setPush('unavailable')); }, []);
  useEffect(() => { refreshPushState(); }, [refreshPushState]);
  const turnOn = async () => {
    setBusy(true);
    try { setPush(await enablePush(lang)); } catch { toast.show(t('push.failed'), 'error'); } finally { setBusy(false); }
  };
  const turnOff = async () => { setBusy(true); try { await disablePush(); toast.show(t('common.saved'), 'success'); } finally { setBusy(false); } };
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
        {PUSH_SUPPORTED && user ? (
          <Card style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{t('push.title')}</Text>
            <Muted>{t('push.text')}</Muted>
            {push === 'unavailable' ? <Banner kind="info" text={t('push.unavailable')} /> : null}
            {push === 'denied' ? <><Banner kind="warning" text={t('push.denied')} /><Button title={t('push.openSettings')} variant="outline" onPress={() => { void Linking.openSettings(); }} /></> : null}
            {push === 'off' ? <Button title={t('push.enable')} icon="notifications" loading={busy} onPress={turnOn} /> : null}
            {push === 'on' ? <Row style={{ justifyContent: 'space-between' }}><Chip label={t('push.on')} icon="checkmark-circle" selected /><Button title={t('push.disable')} variant="ghost" size="sm" loading={busy} onPress={turnOff} /></Row> : null}
          </Card>
        ) : null}
        <LegalLinks prefix={false} />
        <Muted style={{ textAlign: 'center' }}>Maak · v{Constants.expoConfig?.version ?? '1.0.0'}</Muted>
      </Page>
    </Screen>
  );
}
