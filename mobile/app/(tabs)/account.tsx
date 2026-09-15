import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Brand } from '../../components/Brand';
import { colors, radii } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export default function AccountScreen() {
  const { user, profile, signOut } = useAuth();
  async function logout() { await signOut(); router.replace('/login'); }
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}><Brand compact /></View>
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(profile?.full_name ?? user?.email ?? 'م').charAt(0).toUpperCase()}</Text></View>
        <Text selectable style={styles.name}>{profile?.full_name ?? 'حساب Maak'}</Text>
        <Text selectable style={styles.email}>{user?.email ?? 'غير مسجل الدخول'}</Text>
        {profile?.city ? <Text selectable style={styles.city}>{profile.city}</Text> : null}
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.action}><Text selectable style={styles.actionText}>اللغة · العربية</Text></Pressable>
        <Pressable style={styles.action}><Text selectable style={styles.actionText}>الإشعارات</Text></Pressable>
        <Pressable style={[styles.action, styles.logout]} onPress={() => Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [{ text: 'إلغاء', style: 'cancel' }, { text: 'خروج', style: 'destructive', onPress: () => void logout() }])}><Text style={styles.logoutText}>تسجيل الخروج</Text></Pressable>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background }, content: { padding: 20 }, header: { alignItems: 'flex-end', marginTop: 8, marginBottom: 24 }, profileCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: 28 }, avatar: { width: 76, height: 76, borderRadius: 25, backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: colors.ink, fontSize: 28, fontWeight: '900' }, name: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 15 }, email: { color: colors.muted, marginTop: 5 }, city: { color: colors.goldDeep, fontWeight: '800', marginTop: 6 }, actions: { gap: 10, marginTop: 18 }, action: { minHeight: 52, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', paddingHorizontal: 16 }, actionText: { color: colors.ink, fontWeight: '800', textAlign: 'right' }, logout: { backgroundColor: '#FFF1EF', borderColor: '#F0C7C2' }, logoutText: { color: colors.danger, fontWeight: '900', textAlign: 'right' }, });
