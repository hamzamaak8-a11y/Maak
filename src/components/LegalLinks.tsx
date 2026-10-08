import React from 'react';
import { Linking, Text } from 'react-native';
import { legalUrl } from '../config/env';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

/** "By continuing you agree to the Terms of use and the Privacy policy" with tappable links. */
export function LegalLinks({ prefix = true }: { prefix?: boolean }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const link = { color: colors.primary, fontWeight: '700' as const };
  return (
    <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
      {prefix ? `${t('legal.agree')} ` : ''}
      <Text style={link} onPress={() => Linking.openURL(legalUrl('terms'))}>{t('legal.terms')}</Text>
      {` ${t('legal.and')} `}
      <Text style={link} onPress={() => Linking.openURL(legalUrl('privacy'))}>{t('legal.privacy')}</Text>
    </Text>
  );
}
