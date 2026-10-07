import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

export type CustomerTabParams = {
  HomeTab: undefined;
  DiscoverTab: { query?: string; category?: string } | undefined;
  BookingsTab: undefined;
  MessagesTab: undefined;
  ProfileTab: undefined;
};

export type ProviderTabParams = {
  DashboardTab: undefined;
  RequestsTab: undefined;
  ProServicesTab: undefined;
  ProMessagesTab: undefined;
  ProProfileTab: undefined;
};

/** One flat param list: every screen is reachable by name from any navigator (guards decide access). */
export type AllParams = {
  Welcome: undefined;
  Login: undefined;
  Signup: { intent?: 'customer' | 'provider' } | undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  CustomerTabs: NavigatorScreenParams<CustomerTabParams> | undefined;
  ProviderTabs: NavigatorScreenParams<ProviderTabParams> | undefined;
  ProviderDetail: { id: number };
  BookingFlow: { id: number };
  BookingDetail: { id: string };
  Chat: { conversationId?: string; bookingId?: string; providerProfileId?: string; title?: string };
  Notifications: undefined;
  Favorites: undefined;
  MyReviews: undefined;
  Settings: undefined;
  Help: undefined;
  Security: undefined;
  EditProfile: undefined;
  DeleteAccount: undefined;
  ProviderApplication: undefined;
  // provider
  ProviderServices: undefined;
  ProviderAvailability: undefined;
  ProviderPortfolio: undefined;
  ProviderReviews: undefined;
  ProviderMarketplace: undefined;
  // admin
  AdminHome: undefined;
  AdminApplications: undefined;
  AdminUsers: undefined;
  AdminBookings: undefined;
  AdminReviews: undefined;
  AdminAudit: undefined;
  AdminReports: undefined;
};

export type Nav = NativeStackNavigationProp<AllParams>;
export type ScreenProps<K extends keyof AllParams> = NativeStackScreenProps<AllParams, K>;
