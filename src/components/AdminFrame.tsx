import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { navRef } from '../navigation/ref';
import type { AllParams } from '../navigation/types';
import { BrandMark } from './AuthShell';
import { Avatar, Sheet } from './ui';
import type { TKey } from '../i18n/en';

type Item = { route: keyof AllParams; icon: keyof typeof Ionicons.glyphMap; label: TKey; group?: string };

const ITEMS: Item[] = [
  { route: 'AdminHome', icon: 'grid-outline', label: 'admin.nav.dashboard' },
  { route: 'AdminApplications', icon: 'document-text-outline', label: 'admin.applications' },
  { route: 'AdminUsers', icon: 'people-outline', label: 'admin.users' },
  { route: 'AdminBookings', icon: 'calendar-outline', label: 'admin.bookings' },
  { route: 'AdminReviews', icon: 'star-outline', label: 'admin.reviews' },
  { route: 'AdminReports', icon: 'flag-outline', label: 'admin.reports' },
  { route: 'AdminAnnouncements', icon: 'megaphone-outline', label: 'admin.announcements' },
  { route: 'AdminAudit', icon: 'list-outline', label: 'admin.audit' },
  { route: 'Settings', icon: 'settings-outline', label: 'settings.title' },
];
const PRIMARY_NARROW = ['AdminHome', 'AdminApplications', 'AdminUsers', 'AdminBookings'];

function useCurrentRoute(): string {
  const [name, setName] = useState('AdminHome');
  useEffect(() => {
    const read = () => setName(navRef.isReady() ? navRef.getCurrentRoute()?.name ?? 'AdminHome' : 'AdminHome');
    read();
    const unsub = navRef.addListener('state', read);
    const timer = setTimeout(read, 200);
    return () => { unsub(); clearTimeout(timer); };
  }, []);
  return name;
}

const go = (route: keyof AllParams) => { if (navRef.isReady()) (navRef.navigate as (n: string) => void)(route as string); };

/**
 * Responsive shell of the administration panel:
 *  - wide screens (desktop / tablet landscape): permanent sidebar;
 *  - narrow screens (phones): bottom bar with the main sections and a "More" sheet for the rest.
 */
export function AdminFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const current = useCurrentRoute();
  const [more, setMore] = useState(false);

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
        <View style={{ width: 272, backgroundColor: colors.surface, borderEndWidth: 1, borderEndColor: colors.border, paddingTop: Math.max(insets.top, 18), paddingBottom: 18 }}>
          <View style={{ paddingHorizontal: 20, paddingBottom: 18, alignItems: 'flex-start' }}><SidebarBrand /></View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, gap: 4 }}>
            {ITEMS.map(i => <SideLink key={i.route} item={i} active={current === i.route || (i.route === 'AdminUsers' && current.startsWith('AdminUser') ) || (i.route === 'AdminUsers' && current === 'AdminCreateUser')} />)}
          </ScrollView>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={profile?.full_name ?? 'A'} uri={profile?.avatar_url} size={40} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>{profile?.full_name ?? 'Admin'}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('admin.badge')}</Text>
              </View>
              <Pressable onPress={() => { void signOut(); }} accessibilityRole="button" accessibilityLabel={t('auth.logout')} hitSlop={8}><Ionicons name="log-out-outline" size={22} color={colors.textSecondary} /></Pressable>
            </View>
          </View>
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  const bottom = Math.max(insets.bottom, 8);
  const items = ITEMS.filter(i => PRIMARY_NARROW.includes(i.route as string));
  const rest = ITEMS.filter(i => !PRIMARY_NARROW.includes(i.route as string));
  const moreActive = rest.some(i => i.route === current);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>{children}</View>
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, paddingBottom: bottom, boxShadow: '0 -4px 18px rgba(15,23,42,0.06)' }}>
        {items.map(i => <NarrowTab key={i.route as string} icon={i.icon} label={t(i.label)} active={current === i.route || (i.route === 'AdminUsers' && current.startsWith('AdminUser'))} onPress={() => go(i.route)} />)}
        <NarrowTab icon="ellipsis-horizontal-circle-outline" label={t('admin.more')} active={moreActive} onPress={() => setMore(true)} />
      </View>
      <Sheet visible={more} onClose={() => setMore(false)} title={t('admin.more')}>
        {rest.map(i => (
          <Pressable key={i.route as string} onPress={() => { setMore(false); go(i.route); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
            <Ionicons name={i.icon} size={22} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{t(i.label)}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => { setMore(false); void signOut(); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: 16, fontWeight: '700' }}>{t('auth.logout')}</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

function SidebarBrand() {
  const { t } = useLanguage();
  return <BrandMark size={44} wordmark={false} label={undefined} />;
}

function SideLink({ item, active }: { item: Item; active: boolean }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  return (
    <Pressable onPress={() => go(item.route)} accessibilityRole="button" accessibilityLabel={t(item.label)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, backgroundColor: active ? colors.primaryLight : pressed ? colors.surfaceAlt : 'transparent' })}>
      <Ionicons name={item.icon} size={22} color={active ? colors.primary : colors.textSecondary} />
      <Text style={{ color: active ? colors.primary : colors.text, fontSize: 15, fontWeight: active ? '800' : '600' }}>{t(item.label)}</Text>
    </Pressable>
  );
}

function NarrowTab({ icon, label, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 }}>
      <Ionicons name={icon} size={24} color={active ? colors.primary : colors.textMuted} />
      <Text numberOfLines={1} style={{ color: active ? colors.primary : colors.textMuted, fontSize: 11, lineHeight: 14, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
