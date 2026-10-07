import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth, PendingAction } from '../contexts/AuthContext';
import type { Nav } from '../navigation/types';

/**
 * Guests may browse everything, but any action that needs an account goes through this guard:
 * it remembers where the guest was heading, sends them to Login, and the navigator replays it afterwards.
 */
export function useRequireAuth() {
  const { user, setPending } = useAuth();
  const nav = useNavigation<Nav>();
  return useCallback((action?: PendingAction): boolean => {
    if (user) return true;
    if (action) setPending(action);
    nav.navigate('Login');
    return false;
  }, [user, setPending, nav]);
}
