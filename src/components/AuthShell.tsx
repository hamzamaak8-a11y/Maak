import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authColors } from '../constants/theme';
import { ForceTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

/** The brand mark and wordmark. */
export function BrandMark({ size = 84, wordmark = true, label }: { size?: number; wordmark?: boolean; label?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Image source={require('../../assets/logo-mark.png')} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="Maak" />
      {wordmark ? <Text style={{ color: '#FFFFFF', fontSize: size * 0.56, fontWeight: '900', letterSpacing: -1, lineHeight: size * 0.66 }}>Maak</Text> : null}
      {label ? <Text style={{ color: authColors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>{label}</Text> : null}
    </View>
  );
}

/** Frosted-glass panel with a soft teal glow. */
export function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.glass, style]}>
      {children}
    </View>
  );
}

/**
 * Full-screen dark branded canvas for welcome / sign-in / sign-up: deep navy gradient, glowing circles,
 * logo, heading and a glass card. Always dark, whatever theme the user picked.
 */
export function AuthShell({ heading, subheading, children, footer, onBack, badge, hideLanguage }: {
  heading: string; subheading?: string; children: React.ReactNode; footer?: React.ReactNode; onBack?: () => void; badge?: string; hideLanguage?: boolean;
}) {
  const { isRTL } = useLanguage();
  return (
    <ForceTheme colors={authColors}>
      <View style={{ flex: 1, backgroundColor: authColors.background, overflow: 'hidden' }}>
        <LinearGradient colors={['#04122B', '#071B3C', '#050B1F']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[styles.circle, { width: 340, height: 340, top: -150, end: -110, borderColor: 'rgba(255,154,60,0.45)', backgroundColor: 'rgba(255,138,31,0.22)' }]} />
        <View pointerEvents="none" style={[styles.circle, { width: 300, height: 300, top: 90, start: -190, borderColor: 'rgba(77,163,255,0.45)', backgroundColor: 'rgba(29,95,224,0.12)' }]} />
        <View pointerEvents="none" style={[styles.circle, { width: 260, height: 260, bottom: -120, end: -100, borderColor: 'rgba(0,198,255,0.30)', backgroundColor: 'rgba(0,198,255,0.06)' }]} />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 22, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
              {onBack ? (
                <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" style={styles.back}>
                  <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#F4F8FF" />
                </Pressable>
              ) : <View style={{ width: 44 }} />}
              {hideLanguage ? <View /> : <LanguageSwitcher compact />}
            </View>
            <View style={{ alignItems: 'center', gap: 14 }}>
              <BrandMark label={badge} />
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 36 }}>{heading}</Text>
                {subheading ? <Text style={{ color: authColors.textSecondary, fontSize: 16, textAlign: 'center', lineHeight: 24 }}>{subheading}</Text> : null}
              </View>
            </View>
            {children}
            {footer}
          </ScrollView>
        </SafeAreaView>
      </View>
    </ForceTheme>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute', borderRadius: 999, borderWidth: 1 },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(110,170,210,0.30)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  glass: {
    backgroundColor: 'rgba(10,24,50,0.78)', borderWidth: 1, borderColor: 'rgba(96,170,215,0.36)', borderRadius: 28, padding: 22, gap: 16,
    boxShadow: '0 0 44px rgba(20,184,166,0.12), 0 18px 40px rgba(0,0,0,0.35)',
  },
});
