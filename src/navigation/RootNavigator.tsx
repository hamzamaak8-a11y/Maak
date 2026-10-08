import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNavigationContainerRef, DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IS_ADMIN_PORTAL, isSupabaseConfigured } from '../config/env';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button, Muted } from '../components/ui';
import type { AllParams, CustomerTabParams, ProviderTabParams } from './types';

import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { HomeScreen } from '../screens/customer/HomeScreen';
import { DiscoverScreen } from '../screens/customer/DiscoverScreen';
import { BookingsScreen } from '../screens/customer/BookingsScreen';
import { ProviderDetailScreen } from '../screens/customer/ProviderDetailScreen';
import { BookingFlowScreen } from '../screens/customer/BookingFlowScreen';
import { FavoritesScreen } from '../screens/customer/FavoritesScreen';
import { MyReviewsScreen } from '../screens/customer/MyReviewsScreen';
import { ChatListScreen } from '../screens/shared/ChatListScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { BookingDetailScreen } from '../screens/shared/BookingDetailScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';
import { SettingsScreen } from '../screens/shared/SettingsScreen';
import { HelpScreen } from '../screens/shared/HelpScreen';
import { SecurityScreen } from '../screens/shared/SecurityScreen';
import { DeleteAccountScreen } from '../screens/shared/DeleteAccountScreen';
import { AdminReportsScreen } from '../screens/admin/AdminReportsScreen';
import { AdminLoginScreen } from '../screens/admin/AdminLoginScreen';
import { AccessBlockedScreen } from '../screens/shared/AccessBlockedScreen';
import { ProviderApplicationScreen } from '../screens/provider/ProviderApplicationScreen';
import { ProviderDashboardScreen } from '../screens/provider/ProviderDashboardScreen';
import { ProviderRequestsScreen } from '../screens/provider/ProviderRequestsScreen';
import { ProviderServicesScreen } from '../screens/provider/ProviderServicesScreen';
import { ProviderAvailabilityScreen } from '../screens/provider/ProviderAvailabilityScreen';
import { ProviderPortfolioScreen } from '../screens/provider/ProviderPortfolioScreen';
import { ProviderReviewsScreen } from '../screens/provider/ProviderReviewsScreen';
import { ProviderMarketplaceScreen } from '../screens/provider/ProviderMarketplaceScreen';
import { AdminHomeScreen } from '../screens/admin/AdminHomeScreen';
import { AdminApplicationsScreen } from '../screens/admin/AdminApplicationsScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminBookingsScreen } from '../screens/admin/AdminBookingsScreen';
import { AdminReviewsScreen } from '../screens/admin/AdminReviewsScreen';
import { AdminAuditScreen } from '../screens/admin/AdminAuditScreen';

const Stack = createNativeStackNavigator<AllParams>();
const CTabs = createBottomTabNavigator<CustomerTabParams>();
const PTabs = createBottomTabNavigator<ProviderTabParams>();
export const navRef = createNavigationContainerRef<AllParams>();

type IconPair = [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap];

function useTabOptions() {
  const { colors } = useTheme();
  // Never fix the bar height: it must grow by the bottom inset (gesture bar / home indicator / browser chrome),
  // otherwise the lower half of the bar is drawn under the system UI.
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, height: 66 + bottom, paddingTop: 10, paddingBottom: bottom, boxShadow: '0 -4px 18px rgba(15,23,42,0.06)' },
    tabBarItemStyle: { paddingVertical: 0 },
    tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, marginTop: 3 },
    tabBarAllowFontScaling: false,
  };
}

const icon = (pair: IconPair) => ({ focused, color, size }: { focused: boolean; color: string; size: number }) => <Ionicons name={focused ? pair[0] : pair[1]} size={size} color={color} />;

function CustomerTabsNavigator() {
  const { t } = useLanguage();
  const options = useTabOptions();
  return (
    <CTabs.Navigator screenOptions={options}>
      <CTabs.Screen name="HomeTab" component={HomeScreen} options={{ title: t('tabs.home'), tabBarIcon: icon(['home', 'home-outline']) }} />
      <CTabs.Screen name="DiscoverTab" component={DiscoverScreen} options={{ title: t('tabs.discover'), tabBarIcon: icon(['search', 'search-outline']) }} />
      <CTabs.Screen name="BookingsTab" component={BookingsScreen} options={{ title: t('tabs.bookings'), tabBarIcon: icon(['calendar', 'calendar-outline']) }} />
      <CTabs.Screen name="MessagesTab" component={ChatListScreen} options={{ title: t('tabs.messages'), tabBarIcon: icon(['chatbubbles', 'chatbubbles-outline']) }} />
      <CTabs.Screen name="ProfileTab" component={ProfileScreen} options={{ title: t('tabs.profile'), tabBarIcon: icon(['person', 'person-outline']) }} />
    </CTabs.Navigator>
  );
}

function ProviderTabsNavigator() {
  const { t } = useLanguage();
  const options = useTabOptions();
  return (
    <PTabs.Navigator screenOptions={options}>
      <PTabs.Screen name="DashboardTab" component={ProviderDashboardScreen} options={{ title: t('tabs.dashboard'), tabBarIcon: icon(['grid', 'grid-outline']) }} />
      <PTabs.Screen name="RequestsTab" component={ProviderRequestsScreen} options={{ title: t('tabs.requests'), tabBarIcon: icon(['calendar', 'calendar-outline']) }} />
      <PTabs.Screen name="ProServicesTab" options={{ title: t('tabs.services'), tabBarIcon: icon(['construct', 'construct-outline']) }}>{() => <ProviderServicesScreen embedded />}</PTabs.Screen>
      <PTabs.Screen name="ProMessagesTab" component={ChatListScreen} options={{ title: t('tabs.messages'), tabBarIcon: icon(['chatbubbles', 'chatbubbles-outline']) }} />
      <PTabs.Screen name="ProProfileTab" component={ProfileScreen} options={{ title: t('tabs.profile'), tabBarIcon: icon(['person', 'person-outline']) }} />
    </PTabs.Navigator>
  );
}

const shared = () => (
  <>
    <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
    <Stack.Screen name="Chat" component={ChatScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="Help" component={HelpScreen} />
    <Stack.Screen name="Security" component={SecurityScreen} />
    <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
  </>
);

function useStackOptions() {
  const { colors } = useTheme();
  return { headerShown: false, contentStyle: { backgroundColor: colors.background } };
}

/** Guests and customers share one navigator: guests browse freely and are sent to Login only when an action needs an account. */
function CustomerNavigator() {
  const { user } = useAuth();
  const options = useStackOptions();
  return (
    <Stack.Navigator screenOptions={options} initialRouteName={user ? 'CustomerTabs' : 'Welcome'}>
      {!user ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      ) : null}
      <Stack.Screen name="CustomerTabs" component={CustomerTabsNavigator} />
      <Stack.Screen name="ProviderDetail" component={ProviderDetailScreen} />
      <Stack.Screen name="BookingFlow" component={BookingFlowScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="MyReviews" component={MyReviewsScreen} />
      <Stack.Screen name="ProviderApplication" component={ProviderApplicationScreen} />
      {shared()}
    </Stack.Navigator>
  );
}

function ProviderNavigator() {
  const options = useStackOptions();
  return (
    <Stack.Navigator screenOptions={options} initialRouteName="ProviderTabs">
      <Stack.Screen name="ProviderTabs" component={ProviderTabsNavigator} />
      <Stack.Screen name="ProviderAvailability" component={ProviderAvailabilityScreen} />
      <Stack.Screen name="ProviderPortfolio" component={ProviderPortfolioScreen} />
      <Stack.Screen name="ProviderReviews" component={ProviderReviewsScreen} />
      <Stack.Screen name="ProviderMarketplace" component={ProviderMarketplaceScreen} />
      <Stack.Screen name="ProviderApplication" component={ProviderApplicationScreen} />
      {shared()}
    </Stack.Navigator>
  );
}

function AdminNavigator() {
  const options = useStackOptions();
  return (
    <Stack.Navigator screenOptions={options} initialRouteName="AdminHome">
      <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
      <Stack.Screen name="AdminApplications" component={AdminApplicationsScreen} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Stack.Screen name="AdminBookings" component={AdminBookingsScreen} />
      <Stack.Screen name="AdminReviews" component={AdminReviewsScreen} />
      <Stack.Screen name="AdminAudit" component={AdminAuditScreen} />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
      <Stack.Screen name="Security" component={SecurityScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

function Splash({ message, children }: { message?: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: colors.background }}>
      <Image source={require('../../assets/splash-icon.png')} style={{ width: 84, height: 84, borderRadius: 22 }} />
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}>Maak</Text>
      {message ? <Muted style={{ textAlign: 'center', maxWidth: 360 }}>{message}</Muted> : <ActivityIndicator color={colors.primary} />}
      {children}
    </View>
  );
}

export function RootNavigator() {
  const { colors, isDark } = useTheme();
  const { t, isRTL, ready } = useLanguage();
  const { user, role, loading, passwordRecovery, wantsProvider, takePending, signOut } = useAuth();

  // After sign-in: continue what the guest was doing, or resume an unfinished provider application.
  useEffect(() => {
    if (!user || role !== 'customer') return;
    const action = wantsProvider ? { name: 'ProviderApplication', params: undefined } : takePending();
    if (!action) return;
    const id = setTimeout(() => { if (navRef.isReady()) (navRef.navigate as (n: string, p?: object) => void)(action.name, action.params); }, 80);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role, wantsProvider]);

  // Signing out (or deleting the account) must never leave the user on a stale account screen.
  const previousUser = useRef<string | null>(null);
  useEffect(() => {
    const id = user?.id ?? null;
    if (previousUser.current && !id) {
      const timer = setTimeout(() => { if (navRef.isReady()) navRef.resetRoot({ index: 0, routes: [{ name: 'Welcome' }] }); }, 0);
      previousUser.current = id;
      return () => clearTimeout(timer);
    }
    previousUser.current = id;
  }, [user?.id]);

  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary } };

  let body: React.ReactNode;
  if (!isSupabaseConfigured) body = <Splash message={t('app.notConfigured')} />;
  else if (!ready || loading) body = <Splash />;
  else if (passwordRecovery) body = (
    <Stack.Navigator screenOptions={{ headerShown: false }}><Stack.Screen name="ResetPassword" component={ResetPasswordScreen} /></Stack.Navigator>
  );
  else if (IS_ADMIN_PORTAL) {
    // Standalone administration panel: only administrators get in, nothing of the customer app is reachable.
    if (!user) body = <AdminLoginScreen />;
    else if (role === 'suspended') body = <Splash message={t('app.suspended')}><Button title={t('auth.logout')} onPress={() => { void signOut(); }} /></Splash>;
    else if (role === 'admin') body = <AdminNavigator />;
    else body = <AccessBlockedScreen kind="not-admin" />;
  }
  else if (role === 'admin') body = <AccessBlockedScreen kind="admin-in-app" />;
  else if (role === 'suspended') body = <Splash message={t('app.suspended')}><Button title={t('auth.logout')} onPress={() => { void signOut(); }} /></Splash>;
  else if (role === 'provider') body = <ProviderNavigator />;
  else body = <CustomerNavigator />;

  return (
    <NavigationContainer ref={navRef} theme={theme} direction={isRTL ? 'rtl' : 'ltr'}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {body}
    </NavigationContainer>
  );
}
