import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../../components/ui';
import { AuthShell, GlassCard } from '../../components/AuthShell';

/**
 * Shown when an account is in the wrong front-end:
 *  - an administrator opening the customer app  -> use the administration panel;
 *  - a non-administrator opening the admin panel -> not authorised.
 */
export function AccessBlockedScreen({ kind }: { kind: 'admin-in-app' | 'not-admin' }) {
  const { t } = useLanguage();
  const { signOut } = useAuth();
  return (
    <AuthShell badge={kind === 'not-admin' ? t('admin.badge') : undefined} heading={kind === 'not-admin' ? t('admin.notAdminTitle') : t('admin.inAppTitle')} subheading={kind === 'not-admin' ? t('admin.notAdmin') : t('admin.useAdminPanel')} hideLanguage={false}>
      <GlassCard>
        <View style={{ alignItems: 'center' }}><Ionicons name="lock-closed" size={44} color="#F1B84E" /></View>
        <Text style={{ color: '#AAB9D0', textAlign: 'center', lineHeight: 22 }}>{kind === 'not-admin' ? t('admin.notAdminHelp') : t('admin.inAppHelp')}</Text>
        <Button gradient title={t('auth.logout')} icon="log-out-outline" onPress={() => { void signOut(); }} />
      </GlassCard>
    </AuthShell>
  );
}
