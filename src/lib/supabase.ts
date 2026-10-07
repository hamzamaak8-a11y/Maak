import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config/env';

// A placeholder URL keeps the app renderable (showing a configuration notice) when env vars are missing.
export const supabase = createClient(SUPABASE_URL || 'https://not-configured.invalid', SUPABASE_KEY || 'not-configured', {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});
