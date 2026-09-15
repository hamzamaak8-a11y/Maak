import 'react-native-url-polyfill/auto';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const storage: SupportedStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

// Safe publishable client values for the isolated Maak Preview environment.
// Production native builds should override these with EXPO_PUBLIC_* values.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://rafoxqcayxzrnqzwtaft.supabase.co';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_JOMVe3gucIt2SKCEnNw1eQ_S6H9ciZo';

export const supabase = createClient(url, key, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
