import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { createPush, type PushState } from './pushPolicy';
import type { Lang } from '../types';

/**
 * Push notifications for a closed app (Android through Expo Push + FCM; free). Nothing is requested at start-up: the user
 * switches it on in Settings, which is when the system permission dialog appears. The module is only loaded on devices.
 */
export const PUSH_SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios';
export type { PushState };

type NotificationsModule = typeof import('expo-notifications');
const load = (): NotificationsModule => require('expo-notifications') as NotificationsModule;
const device = () => (require('expo-device') as typeof import('expo-device'));

const projectId = (): string | undefined => {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
};

let handlerInstalled = false;
async function prepare(N: NotificationsModule) {
  if (!handlerInstalled) {
    handlerInstalled = true;
    N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  }
  if (Platform.OS === 'android') await N.setNotificationChannelAsync('default', { name: 'Maak', importance: N.AndroidImportance.MAX, vibrationPattern: [0, 200, 100, 200], lightColor: '#1D5FE0' });
}

const policy = createPush({
  storage: {
    get: key => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
    remove: key => AsyncStorage.removeItem(key),
  },
  os: {
    available: () => PUSH_SUPPORTED && device().isDevice && !!projectId(),
    permission: async () => { const p = await load().getPermissionsAsync(); return { status: p.status as 'granted' | 'denied' | 'undetermined', canAskAgain: p.canAskAgain !== false }; },
    request: async () => { const N = load(); await prepare(N); const p = await N.requestPermissionsAsync(); return { status: p.status as 'granted' | 'denied' | 'undetermined', canAskAgain: p.canAskAgain !== false }; },
    token: async () => {
      const N = load();
      if ((await N.getPermissionsAsync()).status !== 'granted') return null;
      await prepare(N);
      return (await N.getExpoPushTokenAsync({ projectId: projectId() as string })).data;
    },
  },
  api: {
    register: async (token, lang) => { const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS, p_lang: lang }); if (error) throw error; },
    unregister: async token => { const { error } = await supabase.rpc('unregister_push_token', { p_token: token }); if (error) throw error; },
    revoke: async token => { const { error } = await supabase.rpc('revoke_push_token', { p_token: token }); if (error) throw error; },
  },
});

/** What Settings shows for this account on this phone ("on" needs the system permission AND this account's own opt-in). */
export async function pushState(uid: string): Promise<PushState> {
  if (!PUSH_SUPPORTED) return 'unsupported';
  try { return await policy.state(uid); } catch { return 'unavailable'; }
}
/** "Turn on": system permission dialog if needed, then registers this phone for this account. */
export async function enablePush(uid: string, lang: Lang): Promise<PushState> {
  if (!PUSH_SUPPORTED) return 'unsupported';
  return policy.enable(uid, lang);
}
/** Keeps the registration fresh. Does nothing unless this account turned notifications on for this phone. */
export async function refreshPush(uid: string, lang: Lang): Promise<void> {
  if (!PUSH_SUPPORTED) return;
  await policy.refresh(uid, lang);
}
/** "Turn off": saved locally first, then the server forgets this phone (retried later if offline). */
export async function disablePush(uid: string): Promise<{ revoked: boolean }> {
  if (!PUSH_SUPPORTED) return { revoked: true };
  return policy.disable(uid);
}
/** Called while signing out; bounded in time and never throws, so signing out cannot hang or fail. */
export async function disablePushForSignOut(uid: string | undefined): Promise<void> {
  if (!PUSH_SUPPORTED || !uid) return;
  await policy.disableForSignOut(uid).catch(() => undefined);
}
/** Retries token revocations that could not be completed offline. */
export async function flushPendingPush(): Promise<void> {
  if (!PUSH_SUPPORTED) return;
  await policy.flushPending().catch(() => undefined);
}

let lastOpened: string | null = null;

/** Opens the right screen when the user taps a notification (also when the tap is what launched the app). */
export function listenForTaps(open: (data: Record<string, unknown>) => void): () => void {
  if (!PUSH_SUPPORTED) return () => undefined;
  const N = load();
  const handle = (r: import('expo-notifications').NotificationResponse) => {
    const id = r.notification.request.identifier;
    if (id === lastOpened) return; // the same tap is reported again after a remount
    lastOpened = id;
    open((r.notification.request.content.data ?? {}) as Record<string, unknown>);
  };
  const sub = N.addNotificationResponseReceivedListener(handle);
  N.getLastNotificationResponseAsync().then(r => { if (r) handle(r); }).catch(() => undefined);
  return () => sub.remove();
}
