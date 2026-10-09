import React, { useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Lang } from '../types';

// Official flags (flag-icons, MIT), rendered as round images.
const FLAGS: Record<Lang, number> = {
  ar: require('../../assets/flags/ma.png'),
  fr: require('../../assets/flags/fr.png'),
  en: require('../../assets/flags/gb.png'),
};
const LABELS: Record<Lang, string> = { ar: 'العربية', fr: 'Français', en: 'English' };
const ORDER: Lang[] = ['ar', 'fr', 'en'];

function Flag({ lang, size }: { lang: Lang; size: number }) {
  return <Image source={FLAGS[lang]} accessibilityIgnoresInvertColors style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: 'rgba(128,128,128,0.35)' }} />;
}

// The language menu stays hidden behind one round flag; tapping it opens the list.
export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { lang, setLang, t } = useLanguage();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const label = `${t('settings.language')}: ${LABELS[lang]}`;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
        style={compact
          ? { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }
          : { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <Flag lang={lang} size={compact ? 26 : 30} />
        {compact ? null : <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' }}>{LABELS[lang]}</Text>}
        <Ionicons name="chevron-down" size={compact ? 14 : 18} color={compact ? '#F4F8FF' : colors.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} accessibilityLabel={t('common.close')} style={{ flex: 1, backgroundColor: 'rgba(3,10,28,0.55)', justifyContent: 'center', padding: 24 }}>
          <View accessibilityRole="menu" style={{ alignSelf: 'center', width: '100%', maxWidth: 340, backgroundColor: colors.background, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 8, gap: 2 }}>
            {ORDER.map(l => {
              const on = l === lang;
              return (
                <Pressable key={l} accessibilityRole="menuitem" accessibilityState={{ selected: on }} accessibilityLabel={LABELS[l]}
                  onPress={() => { setLang(l); setOpen(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 14, borderRadius: 14, backgroundColor: on ? colors.primaryLight : 'transparent' }}>
                  <Flag lang={l} size={34} />
                  <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: on ? '800' : '600' }}>{LABELS[l]}</Text>
                  {on ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
