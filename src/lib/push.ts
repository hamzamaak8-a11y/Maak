import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import type { Lang } from '../types';

/**
 * Push notifications for a closed app (Android through Expo Push + FCM; free). Nothing is requested at start-up: the user
 * switches it on in Settings, which is when the system permission dialog appears. The module is only loaded on devices.
 */
export const PUSH_SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios';
export type PushState = 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on';

type NotificationsModule = typeof import('expo-notifications');
const load = (): NotificationsModule => require('expo-notifications') as NotificationsModule;
const device = () => (require('expo-device') as typeof import('expo-device'));

const projectId = (): string | undefined => {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
};

let handlerInstalled = false;
function installHandler(N: NotificationsModule) {
  if (handlerInstalled) return;
  handlerInstalled = true;
  N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
}

async function ensureChannel(N: NotificationsModule) {
  if (Platform.OS === 'android') await N.setNotificationChannelAsync('default', { name: 'Maak', importance: N.AndroidImportance.MAX, vibrationPattern: [0, 200, 100, 200], lightColor: '#1D5FE0' });
}

async function currentToken(N: NotificationsModule): Promise<string | null> {
  const id = projectId();
  if (!id) return null;
  return (await N.getExpoPushTokenAsync({ projectId: id })).data;
}

async function registerToken(token: string, lang: Lang) {
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS, p_lang: lang });
  if (error) throw error;
}

export async function pushState(): Promise<PushState> {
  if (!PUSH_SUPPORTED) return 'unsupported';
  try {
    if (!device().isDevice || !projectId()) return 'unavailable';
    const N = load();
    const p = await N.getPermissionsAsync();
    if (p.status === 'granted') return 'on';
    return p.canAskAgain === false ? 'denied' : 'off';
  } catch { return 'unavailable'; }
}

/** Asks for permission (system dialog), then registers this device. Returns the resulting state. */
export async function enablePush(lang: Lang): Promise<PushState> {
  if (!PUSH_SUPPORTED) return 'unsupported';
  const N = load();
  if (!device().isDevice || !projectId()) return 'unavailable';
  installHandler(N);
  await ensureChannel(N);
  let p = await N.getPermissionsAsync();
  if (p.status !== 'granted') p = await N.requestPermissionsAsync();
  if (p.status !== 'granted') return p.canAskAgain === false ? 'denied' : 'off';
  const token = await currentToken(N);
  if (!token) return 'unavailable';
  await registerToken(token, lang);
  return 'on';
}

/** After sign-in / language change: refresh the registration, but only when the user already allowed notifications. */
export async function refreshPush(lang: Lang): Promise<void> {
  if ((await pushState()) !== 'on') return;
  const N = load();
  installHandler(N);
  await ensureChannel(N);
  const token = await currentToken(N);
  if (token) await registerToken(token, lang);
}

/** Before sign-out (and from Settings): this device stops receiving this account's notifications. */
export async function disablePush(): Promise<void> {
  if (!PUSH_SUPPORTED) return;
  try {
    if (!device().isDevice || !projectId()) return;
    const token = await currentToken(load());
    if (token) await supabase.rpc('unregister_push_token', { p_token: token });
  } catch { /* offline or not registered: nothing to undo */ }
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
