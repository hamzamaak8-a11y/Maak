import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { addFavorite, listFavoriteIds, removeFavorite } from '../api/favorites';

type FavoritesValue = { ids: Set<number>; isFavorite: (id: number) => boolean; toggle: (id: number) => Promise<void>; reload: () => Promise<void> };
const FavoritesContext = createContext<FavoritesValue>({ ids: new Set(), isFavorite: () => false, toggle: async () => {}, reload: async () => {} });

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [ids, setIds] = useState<Set<number>>(new Set());

  const reload = useCallback(async () => {
    if (!uid) { setIds(new Set()); return; }
    try { setIds(new Set(await listFavoriteIds(uid))); } catch { /* favourites are optional; keep the previous state */ }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const toggle = useCallback(async (id: number) => {
    if (!uid) return;
    const had = ids.has(id);
    setIds(prev => { const n = new Set(prev); if (had) n.delete(id); else n.add(id); return n; });
    try {
      if (had) await removeFavorite(uid, id); else await addFavorite(uid, id);
    } catch (e) {
      setIds(prev => { const n = new Set(prev); if (had) n.add(id); else n.delete(id); return n; });
      throw e;
    }
  }, [uid, ids]);

  const value = useMemo(() => ({ ids, isFavorite: (id: number) => ids.has(id), toggle, reload }), [ids, toggle, reload]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export const useFavorites = () => useContext(FavoritesContext);
