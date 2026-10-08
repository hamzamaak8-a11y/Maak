import React, { useEffect, useState } from 'react';
import { Image, StyleProp, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { categoryDef } from '../constants/categories';
import { fetchPortfolio } from '../api/providers';
import type { Provider } from '../types';

const covers = new Map<number, Promise<string | null>>();

/** First portfolio photo of a provider (cached, one request per provider). */
function loadCover(id: number): Promise<string | null> {
  let p = covers.get(id);
  if (!p) {
    p = fetchPortfolio(id).then(list => list[0]?.url ?? null).catch(() => null);
    covers.set(id, p);
  }
  return p;
}

export function useCover(provider: Pick<Provider, 'id' | 'image'>): string | null {
  const [url, setUrl] = useState<string | null>(provider.image);
  useEffect(() => {
    let alive = true;
    loadCover(provider.id).then(u => { if (alive && u) setUrl(u); });
    return () => { alive = false; };
  }, [provider.id]);
  return url;
}

const GRADIENTS: Array<[string, string]> = [['#0B2F7A', '#1D8FE0'], ['#9A3412', '#FF9A3C'], ['#0F766E', '#34D3A6'], ['#4C1D95', '#8B5CF6'], ['#1E293B', '#475569']];

/** Big cover: the photo if there is one, otherwise a branded gradient with the category icon. */
export function CoverPhoto({ provider, uri, height, style, children }: { provider: Pick<Provider, 'id' | 'category' | 'name'>; uri?: string | null; height: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const def = categoryDef(provider.category);
  const g = GRADIENTS[provider.id % GRADIENTS.length] ?? GRADIENTS[0]!;
  const [failed, setFailed] = useState(false);
  const show = uri && !failed;
  return (
    <View style={[{ height, width: '100%', overflow: 'hidden', backgroundColor: g[0] }, style]}>
      {show ? <Image source={{ uri }} resizeMode="cover" onError={() => setFailed(true)} style={{ position: 'absolute', width: '100%', height: '100%' }} /> : (
        <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={def?.icon ?? 'construct'} size={Math.min(110, height * 0.42)} color="rgba(255,255,255,0.88)" />
          <Text style={{ color: 'rgba(255,255,255,0.0)', fontSize: 1 }}>{provider.name}</Text>
        </LinearGradient>
      )}
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']} locations={[0, 0.45, 1]} style={{ position: 'absolute', width: '100%', height: '100%' }} />
      {children}
    </View>
  );
}
