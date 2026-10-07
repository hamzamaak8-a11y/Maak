import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { en, TKey } from '../i18n/en';
import { ar } from '../i18n/ar';
import { fr } from '../i18n/fr';
import type { Lang } from '../types';

const KEY = 'maak.lang';
const DICTS: Record<Lang, Record<TKey, string>> = { en, ar, fr };

type Vars = Record<string, string | number>;
type LangValue = { lang: Lang; isRTL: boolean; ready: boolean; setLang: (l: Lang) => void; t: (key: TKey, vars?: Vars) => string };

function deviceLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode;
    if (code === 'ar' || code === 'fr' || code === 'en') return code;
  } catch { /* fall through */ }
  return 'ar';
}

const LanguageContext = createContext<LangValue>({ lang: 'ar', isRTL: true, ready: false, setLang: () => {}, t: k => k });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLang);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(v => { if (v === 'ar' || v === 'fr' || v === 'en') setLangState(v); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const isRTL = lang === 'ar';

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    }
  }, [lang, isRTL]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const t = useCallback((key: TKey, vars?: Vars) => {
    let s = DICTS[lang][key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, isRTL, ready, setLang, t }), [lang, isRTL, ready, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
