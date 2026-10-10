import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, Intent } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { errorKey } from '../lib/errors';

export function GoogleButton({ intent }: { intent: Intent }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { signInWithGoogle } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const press = async () => {
    setBusy(true);
    try { await signInWithGoogle(intent); }
    catch (e) { const k = errorKey(e); if (k !== 'err.oauthCancelled') toast.show(t(k), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <Pressable onPress={press} disabled={busy} accessibilityRole="button"
      style={{ flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', minHeight: 54, paddingVertical: 12, borderRadius: 16, borderWidth: 1.2, borderColor: colors.border, backgroundColor: colors.surfaceAlt, opacity: busy ? 0.6 : 1 }}>
      {busy ? <ActivityIndicator color={colors.primary} size="small" /> : <Ionicons name="logo-google" size={18} color="#EA4335" />}
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t('auth.google')}</Text>
    </Pressable>
  );
}
