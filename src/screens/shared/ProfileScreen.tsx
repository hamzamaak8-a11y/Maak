import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Avatar, Button, Card, ChevronIcon, Header, Muted, Page, Row, Screen, StatusBadge } from '../../components/ui';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import type { Nav } from '../../navigation/types';

type Item = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; right?: React.ReactNode };

export function ProfileScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user, profile, role, providerProfile, signOut } = useAuth();

  if (!user) {
    return (
      <Screen>
        <Header title={t('profile.title')} noBack />
        <Page>
          <Card style={{ gap: 12, alignItems: 'center' }}>
            <Ionicons name="person-circle-outline" size={64} color={colors.textMuted} />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>{t('guest.title')}</Text>
            <Muted style={{ textAlign: 'center' }}>{t('guest.text')}</Muted>
            <View style={{ alignSelf: 'stretch', gap: 10 }}>
              <Button title={t('auth.login')} onPress={() => nav.navigate('Login')} />
              <Button title={t('auth.createAccount')} variant="outline" onPress={() => nav.navigate('Signup', { intent: 'customer' })} />
              <Button title={t('welcome.signupProvider')} variant="ghost" onPress={() => nav.navigate('Signup', { intent: 'provider' })} />
            </View>
          </Card>
          <Card style={{ gap: 10 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{t('settings.language')}</Text><LanguageSwitcher /></Card>
          <MenuCard items={[{ icon: 'help-circle-outline', label: t('help.title'), onPress: () => nav.navigate('Help') }]} />
        </Page>
      </Screen>
    );
  }

  const isProvider = role === 'provider';
  const appStatus = providerProfile?.verification_status;
  const items: Item[] = [
    { icon: 'person-outline', label: t('profile.edit'), onPress: () => nav.navigate('EditProfile') },
    ...(isProvider ? [
      { icon: 'briefcase-outline' as const, label: t('provider.marketplaceProfile'), onPress: () => nav.navigate('ProviderMarketplace') },
      { icon: 'images-outline' as const, label: t('provider.portfolio'), onPress: () => nav.navigate('ProviderPortfolio') },
      { icon: 'time-outline' as const, label: t('provider.availability'), onPress: () => nav.navigate('ProviderAvailability') },
      { icon: 'star-outline' as const, label: t('provider.myReviews'), onPress: () => nav.navigate('ProviderReviews') },
    ] : [
      { icon: 'heart-outline' as const, label: t('favorites.title'), onPress: () => nav.navigate('Favorites') },
      { icon: 'star-outline' as const, label: t('reviews.mine'), onPress: () => nav.navigate('MyReviews') },
      { icon: 'briefcase-outline' as const, label: appStatus ? t('application.title') : t('profile.becomeProvider'), onPress: () => nav.navigate('ProviderApplication'), right: appStatus ? <StatusBadge status={appStatus} /> : undefined },
    ]),
    { icon: 'notifications-outline', label: t('notifications.title'), onPress: () => nav.navigate('Notifications') },
    { icon: 'settings-outline', label: t('settings.title'), onPress: () => nav.navigate('Settings') },
    { icon: 'shield-checkmark-outline', label: t('security.title'), onPress: () => nav.navigate('Security') },
    { icon: 'help-circle-outline', label: t('help.title'), onPress: () => nav.navigate('Help') },
  ];

  return (
    <Screen>
      <Header title={t('profile.title')} noBack />
      <Page>
        <Card style={{ alignItems: 'center', gap: 8 }}>
          <Avatar name={profile?.full_name ?? user.email ?? '?'} uri={profile?.avatar_url} size={76} />
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900' }}>{profile?.full_name || user.email}</Text>
          <Muted>{user.email}</Muted>
          {isProvider ? <StatusBadge status="approved" /> : null}
        </Card>
        <MenuCard items={items} />
        <Button title={t('auth.logout')} variant="outline" icon="log-out-outline" onPress={() => { void signOut(); }} />
      </Page>
    </Screen>
  );
}

export function MenuCard({ items }: { items: Item[] }) {
  const { colors } = useTheme();
  return (
    <Card padded={false}>
      {items.map((it, i) => (
        <Pressable key={it.label} onPress={it.onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.85 : 1 })}>
          <Ionicons name={it.icon} size={22} color={colors.primary} />
          <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' }}>{it.label}</Text>
          {it.right}
          <ChevronIcon />
        </Pressable>
      ))}
    </Card>
  );
}
