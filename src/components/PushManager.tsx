import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PUSH_SUPPORTED, listenForTaps, refreshPush } from '../lib/push';
import { navRef } from '../navigation/ref';

/** Invisible. Keeps this phone's push registration fresh and opens the right screen when a notification is tapped. */
export function PushManager() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const uid = user?.id;

  useEffect(() => {
    if (!PUSH_SUPPORTED || !uid) return;
    refreshPush(lang).catch(() => undefined);
  }, [uid, lang]);

  useEffect(() => {
    if (!PUSH_SUPPORTED || !uid) return;
    const go = (data: Record<string, unknown>, tries = 0) => {
      if (!navRef.isReady()) { if (tries < 20) setTimeout(() => go(data, tries + 1), 250); return; }
      const nav = navRef.navigate as unknown as (name: string, params?: object) => void;
      if (typeof data.conversation_id === 'string') nav('Chat', { conversationId: data.conversation_id, title: '' });
      else if (typeof data.booking_id === 'string') nav('BookingDetail', { id: data.booking_id });
      else nav('Notifications');
    };
    return listenForTaps(d => go(d));
  }, [uid]);

  return null;
}
