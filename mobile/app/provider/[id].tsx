import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../../constants/theme';
import { fetchProvider, type NativeProvider } from '../../lib/api';

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [provider, setProvider] = useState<NativeProvider | null>(null);
  useEffect(() => { if (id) void fetchProvider(id).then(setProvider).catch(() => setProvider(null)); }, [id]);
  if (!provider) return <View style={styles.loading}><ActivityIndicator color={colors.goldDeep} /></View>;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ headerShown: true, title: provider.name, headerTintColor: colors.ink, headerStyle: { backgroundColor: colors.surface } }} />
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{provider.name[0] ?? 'م'}</Text></View>
        <Text selectable style={styles.name}>{provider.name}</Text>
        <Text selectable style={styles.job}>{provider.job}</Text>
        <Text selectable style={styles.meta}>{provider.city}{provider.rating ? ` · ★ ${provider.rating}` : ''}{provider.reviews ? ` · ${provider.reviews} تقييم` : ''}</Text>
      </View>
      <View style={styles.card}><Text selectable style={styles.title}>الخدمات</Text><View style={styles.services}>{provider.services.map((service) => <View style={styles.chip} key={service}><Text selectable style={styles.chipText}>{service}</Text></View>)}</View></View>
      {provider.intro ? <View style={styles.card}><Text selectable style={styles.title}>نبذة</Text><Text selectable style={styles.body}>{provider.intro}</Text></View> : null}
      <Pressable style={styles.cta} onPress={() => router.push('/(tabs)/bookings')}><Text style={styles.ctaText}>ابدأ الحجز</Text></Pressable>
    </ScrollView>
  );
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background }, content: { padding: 18, paddingBottom: 30, gap: 14 }, loading: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }, hero: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: 26 }, avatar: { width: 92, height: 92, borderRadius: 30, backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: colors.ink, fontWeight: '900', fontSize: 34 }, name: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 15 }, job: { color: colors.muted, marginTop: 4 }, meta: { color: colors.goldDeep, fontWeight: '800', marginTop: 8 }, card: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 18 }, title: { color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right' }, body: { color: colors.muted, lineHeight: 23, textAlign: 'right', marginTop: 8 }, services: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginTop: 12 }, chip: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 8 }, chipText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, cta: { minHeight: 56, borderRadius: radii.md, backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center' }, ctaText: { color: colors.ink, fontSize: 16, fontWeight: '900' }, });
