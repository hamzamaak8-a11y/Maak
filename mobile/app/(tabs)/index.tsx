import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Brand } from '../../components/Brand';
import { colors, radii, spacing } from '../../constants/theme';
import { fetchProviders, type NativeProvider } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

function ProviderCard({ item }: { item: NativeProvider }) {
  return <Pressable onPress={() => router.push(`/provider/${item.id}`)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.trim().charAt(0) || 'م'}</Text></View>
    <View style={styles.cardBody}><Text style={styles.name}>{item.name}</Text><Text style={styles.job}>{item.job}</Text><Text style={styles.meta}>{item.city}{item.rating ? ` · ★ ${item.rating}` : ''}</Text></View>
    {item.available ? <View style={styles.online}><View style={styles.dot} /><Text style={styles.onlineText}>متاح</Text></View> : null}
  </Pressable>;
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const [providers, setProviders] = useState<NativeProvider[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try { setProviders(await fetchProviders()); } catch { setProviders([]); }
  }
  useEffect(() => { void load(); }, []);
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  return <FlatList
    style={styles.root}
    contentContainerStyle={styles.content}
    data={providers.slice(0, 12)}
    keyExtractor={(item) => String(item.id)}
    renderItem={({ item }) => <ProviderCard item={item} />}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.goldDeep} />}
    ListHeaderComponent={<>
      <View style={styles.header}><Brand compact /><Pressable onPress={() => router.push('/account')} style={styles.profile}><Text style={styles.profileText}>{(profile?.full_name ?? 'م').charAt(0).toUpperCase()}</Text></Pressable></View>
      <View style={styles.hero}><Text style={styles.eyebrow}>MAAK</Text><Text style={styles.title}>{profile?.full_name ? `شنو بغيتي اليوم، ${profile.full_name.split(' ')[0]}؟` : 'شنو بغيتي اليوم؟'}</Text><Text style={styles.subtitle}>اختار الخدمة وخلي علينا نلقاو ليك الشخص المناسب.</Text><Pressable onPress={() => router.push('/discover')} style={styles.search}><Text style={styles.searchText}>ابحث عن سباك، كهربائي، تنظيف...</Text><Text style={styles.searchIcon}>⌕</Text></Pressable></View>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>مقدمو خدمات موثوقون</Text><Pressable onPress={() => router.push('/discover')}><Text style={styles.link}>الكل</Text></Pressable></View>
    </>}
    ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>اكتشف خدمات Maak</Text><Text style={styles.emptyText}>جميع الخدمات ستظهر هنا بمجرد ربط Worker API في إعدادات التطبيق.</Text><Pressable onPress={() => router.push('/discover')} style={styles.emptyButton}><Text style={styles.emptyButtonText}>استكشف الآن</Text></Pressable></View>}
    ListFooterComponent={<View style={{ height: 18 }} />}
  />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 28, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  profile: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  profileText: { color: colors.ink, fontWeight: '900' },
  hero: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 20, borderWidth: 1, borderColor: colors.line, marginBottom: 20 },
  eyebrow: { color: colors.goldDeep, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textAlign: 'right' },
  title: { color: colors.ink, fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 5, textAlign: 'right' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 8, textAlign: 'right' },
  search: { marginTop: 18, minHeight: 54, borderRadius: radii.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  searchText: { flex: 1, color: colors.muted, fontSize: 14, textAlign: 'right' },
  searchIcon: { fontSize: 25, color: colors.goldDeep, marginLeft: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  sectionTitle: { color: colors.ink, fontWeight: '900', fontSize: 18, textAlign: 'right', flex: 1 },
  link: { color: colors.goldDeep, fontWeight: '900', fontSize: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 13, gap: 11 },
  cardBody: { flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.goldDeep, fontWeight: '900', fontSize: 20 },
  name: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  job: { color: colors.muted, fontSize: 12, marginTop: 2, textAlign: 'right' },
  meta: { color: colors.muted, fontSize: 11, marginTop: 5, textAlign: 'right' },
  online: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 9, backgroundColor: colors.success },
  onlineText: { color: colors.success, fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  empty: { padding: 24, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontWeight: '900', fontSize: 18 },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  emptyButton: { marginTop: 16, backgroundColor: colors.gold, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radii.md },
  emptyButtonText: { color: colors.ink, fontWeight: '900' },
});
