import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronIcon } from './ui';

type IconName = keyof typeof Ionicons.glyphMap;

export function StatTile({ icon, label, value, hint, color, onPress, wide }: { icon: IconName; label: string; value: string | number; hint?: string; color: string; onPress?: () => void; wide?: boolean }) {
  const { colors, isDark } = useTheme();
  const body = (
    <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 10, minHeight: 132, overflow: 'hidden', boxShadow: isDark ? '0 1px 2px rgba(0,0,0,.4)' : '0 1px 2px rgba(15,23,42,.05), 0 6px 18px rgba(15,23,42,.06)' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: -34, end: -34, width: 110, height: 110, borderRadius: 55, backgroundColor: color + '14' }} />
      <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.8 }}>{value}</Text>
      <View>
        <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '700' }}>{label}</Text>
        {hint ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
      </View>
    </View>
  );
  return (
    <View style={{ flexBasis: wide ? '23%' : '47%', flexGrow: 1, minWidth: 150 }}>
      {onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>{body}</Pressable> : body}
    </View>
  );
}

export function AttentionRow({ icon, label, count, tone, onPress }: { icon: IconName; label: string; count: number; tone: 'warning' | 'error' | 'info' | 'success'; onPress: () => void }) {
  const { colors } = useTheme();
  const fg = colors[tone];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: fg + '1F', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={22} color={fg} /></View>
      <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' }}>{label}</Text>
      <View style={{ minWidth: 34, height: 30, borderRadius: 15, backgroundColor: count > 0 ? fg : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }}>
        <Text style={{ color: count > 0 ? '#fff' : colors.textMuted, fontWeight: '900', fontSize: 14 }}>{count}</Text>
      </View>
      <ChevronIcon />
    </Pressable>
  );
}

export function ActionTile({ icon, label, onPress, color }: { icon: IconName; label: string; onPress: () => void; color: string }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flexBasis: '31%', flexGrow: 1, minWidth: 130, alignItems: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.surfaceAlt : colors.surface })}>
      <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={24} color={color} /></View>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

/** Tiny dependency-free bar chart for the last N days. */
export function MiniBars({ data, color, labelFor }: { data: Array<{ key: string; value: number }>; color: string; labelFor?: (key: string) => string }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 110 }}>
        {data.map(d => (
          <View key={d.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 2 }}>{d.value > 0 ? d.value : ''}</Text>
            <LinearGradient colors={d.value > 0 ? [color, color + '99'] : [colors.surfaceAlt, colors.surfaceAlt]} style={{ width: '100%', maxWidth: 22, height: Math.max(4, (d.value / max) * 84), borderRadius: 8 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {data.map((d, i) => <Text key={d.key} numberOfLines={1} style={{ flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 10 }}>{i % 2 === 0 ? (labelFor ? labelFor(d.key) : d.key) : ''}</Text>)}
      </View>
    </View>
  );
}
