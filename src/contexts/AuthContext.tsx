import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../api/profile';
import { fetchProviderProfile } from '../api/provider';
import { disablePush } from '../lib/push';
import type { Profile, ProviderProfile } from '../types';

WebBrowser.maybeCompleteAuthSession();

const INTENT_KEY = 'maak.intent';
export type Intent = 'customer' | 'provider';
export type AppRole = 'guest' | 'customer' | 'provider' | 'admin' | 'suspended';
export type PendingAction = { name: string; params?: Record<string, unknown> };

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  providerProfile: ProviderProfile | null;
  role: AppRole;
  /** True until the first session restore (and profile load) has finished. */
  loading: boolean;
  /** The user asked to become a provider and has not submitted an application yet. */
  wantsProvider: boolean;
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; fullName: string; intent: Intent }) => Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle: (intent: Intent) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearIntent: () => Promise<void>;
  setPending: (a: PendingAction | null) => void;
  takePending: () => PendingAction | null;
};

const AuthContext = createContext<AuthValue | null>(null);

function redirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.href.split(/[?#]/)[0];
  return Linking.createURL('auth-callback');
}

function parseParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const grab = (s: string) => new URLSearchParams(s).forEach((v, k) => { out[k] = v; });
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  if (q >= 0) grab(url.slice(q + 1, h > q ? h : undefined));
  if (h >= 0) grab(url.slice(h + 1));
  return out;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [booting, setBooting] = useState(true);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [storedIntent, setStoredIntent] = useState<Intent | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const pending = useRef<PendingAction | null>(null);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  const loadAccount = useCallback(async (id: string) => {
    let p = await fetchProfile(id);
    if (!p) { await new Promise(r => setTimeout(r, 700)); p = await fetchProfile(id); }
    setProfile(p);
    try { setProviderProfile(await fetchProviderProfile(id)); } catch { setProviderProfile(null); }
  }, []);

  const handleAuthUrl = useCallback(async (url: string) => {
    const params = parseParams(url);
    if (params.error_description) throw new Error(params.error_description);
    if (params.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) throw error;
    } else if (params.access_token && params.refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
      if (error) throw error;
    }
    if (params.type === 'recovery') setPasswordRecovery(true);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(INTENT_KEY).then(v => { if (v === 'provider' || v === 'customer') setStoredIntent(v); }).catch(() => {});
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => {}).finally(() => setBooting(false));
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') { setProfile(null); setProviderProfile(null); setPasswordRecovery(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Deep links (native): OAuth callback, email confirmation, password recovery.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const onUrl = (url: string | null) => { if (url && /code=|access_token=|error_description=/.test(url)) handleAuthUrl(url).catch(() => {}); };
    Linking.getInitialURL().then(onUrl).catch(() => {});
    const sub = Linking.addEventListener('url', e => onUrl(e.url));
    return () => sub.remove();
  }, [handleAuthUrl]);

  useEffect(() => {
    if (!userId) { setProfile(null); setProviderProfile(null); setLoadedFor(null); return; }
    let active = true;
    loadAccount(userId).catch(() => {}).finally(() => { if (active) setLoadedFor(userId); });
    return () => { active = false; };
  }, [userId, loadAccount]);

  const refresh = useCallback(async () => { if (userId) await loadAccount(userId); }, [userId, loadAccount]);

  const rememberIntent = useCallback(async (intent: Intent) => {
    setStoredIntent(intent);
    await AsyncStorage.setItem(INTENT_KEY, intent).catch(() => {});
  }, []);

  const clearIntent = useCallback(async () => {
    setStoredIntent(null);
    await AsyncStorage.removeItem(INTENT_KEY).catch(() => {});
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async ({ email, password, fullName, intent }: { email: string; password: string; fullName: string; intent: Intent }) => {
    await rememberIntent(intent);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), intent }, emailRedirectTo: redirectUrl() },
    });
    if (error) throw error;
    // With email confirmation on, Supabase returns a user but no session until the link is opened.
    // An obfuscated duplicate sign-up returns a user with no identities.
    if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error('user_already_exists');
    return { needsConfirmation: !data.session };
  }, [rememberIntent]);

  const signInWithGoogle = useCallback(async (intent: Intent) => {
    await rememberIntent(intent);
    const redirectTo = redirectUrl();
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) throw error;
      return;
    }
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
    if (error) throw error;
    if (!data.url) throw new Error('err.generic');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') throw new Error('err.oauthCancelled');
    try {
      await handleAuthUrl(result.url);
    } catch (e) {
      // The deep-link listener may have exchanged the same code first; only fail when no session exists.
      const { data: current } = await supabase.auth.getSession();
      if (!current.session) throw e;
    }
  }, [handleAuthUrl, rememberIntent]);

  const signOut = useCallback(async () => {
    await disablePush(); // this phone must stop receiving the account's notifications (needs the session, so before sign-out)
    await supabase.auth.signOut();
    setProfile(null);
    setProviderProfile(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() });
    if (error) throw error;
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectUrl() } });
    if (error) throw error;
  }, []);

  const changePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setPasswordRecovery(false);
  }, []);

  const role: AppRole = !user
    ? 'guest'
    : profile?.account_status === 'suspended'
      ? 'suspended'
      : profile?.role === 'admin'
        ? 'admin'
        : profile?.role === 'provider' && providerProfile?.verification_status === 'approved'
          ? 'provider'
          : 'customer';

  const intentIsProvider = storedIntent === 'provider' || user?.user_metadata?.intent === 'provider';
  const wantsProvider = !!user && role === 'customer' && intentIsProvider && (!providerProfile || providerProfile.verification_status === 'draft');

  const value = useMemo<AuthValue>(() => ({
    session, user, profile, providerProfile, role,
    loading: booting || (!!userId && loadedFor !== userId),
    wantsProvider, passwordRecovery,
    signIn, signUp, signInWithGoogle, signOut, sendPasswordReset, resendConfirmation, changePassword, refresh, clearIntent,
    setPending: a => { pending.current = a; },
    takePending: () => { const a = pending.current; pending.current = null; return a; },
  }), [session, user, userId, profile, providerProfile, role, booting, loadedFor, wantsProvider, passwordRecovery,
    signIn, signUp, signInWithGoogle, signOut, sendPasswordReset, resendConfirmation, changePassword, refresh, clearIntent]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
