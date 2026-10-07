import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORT_EMAIL } from '../../config/env';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Card, Header, Page, Screen } from '../../components/ui';
import type { TKey } from '../../i18n/en';

const FAQ: Array<[TKey, TKey]> = [
  ['help.q1', 'help.a1'], ['help.q2', 'help.a2'], ['help.q3', 'help.a3'], ['help.q4', 'help.a4'], ['help.q5', 'help.a5'], ['help.q6', 'help.a6'],
];

export function HelpScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen>
      <Header title={t('help.title')} />
      <Page>
        <View style={{ gap: 10 }}>
          {FAQ.map(([q, a], i) => (
            <Card key={q} onPress={() => setOpen(open === i ? null : i)} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ flex: 1, color: colors.text, fontWeight: '800', fontSize: 15 }}>{t(q)}</Text>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </View>
              {open === i ? <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>{t(a)}</Text> : null}
            </Card>
          ))}
        </View>
        {SUPPORT_EMAIL ? <Button title={t('help.contact')} icon="mail-outline" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} /> : null}
      </Page>
    </Screen>
  );
}
