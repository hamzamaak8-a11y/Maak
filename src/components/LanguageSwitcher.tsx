import React from 'react';
import { Row, Chip } from './ui';
import { useLanguage } from '../contexts/LanguageContext';
import type { Lang } from '../types';

const LABELS: Record<Lang, string> = { ar: 'العربية', fr: 'Français', en: 'English' };

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useLanguage();
  return (
    <Row gap={compact ? 6 : 8} style={{ flexWrap: 'wrap' }}>
      {(['ar', 'fr', 'en'] as Lang[]).map(l => <Chip key={l} label={LABELS[l]} selected={lang === l} onPress={() => setLang(l)} />)}
    </Row>
  );
}
