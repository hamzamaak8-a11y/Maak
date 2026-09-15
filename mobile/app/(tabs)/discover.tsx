import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii } from '../../constants/theme';
import { fetchProviders, type NativeProvider } from '../../lib/api';

export default function DiscoverScreen() {
  const [all, setAll] = useState<NativeProvider[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => { void fetchProviders().then(setAll).catch(() => setAll([])); }, []);
  const data = useMemo(() => { const q = query.trim().toLowerCase(); if (!q) return all; return all.filter((p) => `${p.name} ${p.job} ${p.city} ${p.services.join(' ')}`.toLowerCase().includes(q)); }, [all, query]);
  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(`/provider/${item.id}`)}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{item.name[0] ?? 'م'}</Text></View>
          <View style={styles.body}><Text selectable style={styles.name}>{item.name}</Text><Text selectable style={styles.job}>{item.job}</Text><Text selectable style={styles.meta}>{item.city}{item.rating ? ` · ★ ${item.rating}` : ''}</Text></View>
        </Pressable>
      )}
      ListHeaderComponent={<View><Text selectable style={styles.title}>اكتشف</Text><Text selectable style={styles.subtitle}>قلب المدينة واختار الشخص المناسب.</Text><TextInput value={query} onChangeText={setQuery} placeholder="ابحث عن خدمة أو مدينة" placeholderTextColor={colors.muted} returnKeyType="search" clearButtonMode="while-editing" style={styles.input} /><View style={styles.chips}>{['السباكة','الكهرباء','التنظيف','الصباغة','النقل'].map((c) => <Pressable key={c} onPress={() => setQuery(c)} style={styles.chip}><Text style={styles.chipText}>{c}</Text></Pressable>)}</View></View>}
      ListEmptyComponent={<View style={styles.empty}><Text selectable style={styles.emptyTitle}>لا توجد نتائج</Text><Text selectable style={styles.emptyText}>غيّر البحث أو أعد المحاولة.</Text></View>}
    />
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 28 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', textAlign: 'right', marginTop: 10 },
  subtitle: { color: colors.muted, textAlign: 'right', marginTop: 5, marginBottom: 18 },
  input: { minHeight: 54, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: 15, color: colors.ink, fontSize: 15, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginVertical: 14 },
  chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingHorizontal: 13, paddingVertical: 9 },
  chipText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, marginBottom: 10, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  avatar: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.goldDeep, fontSize: 20, fontWeight: '900' },
  body: { flex: 1 },
  name: { color: colors.ink, fontWeight: '900', textAlign: 'right' },
  job: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 2 },
  meta: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 4 },
  empty: { marginTop: 20, padding: 28, backgroundColor: colors.surface, borderRadius: radii.lg, alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  emptyText: { color: colors.muted, marginTop: 7 },
});
