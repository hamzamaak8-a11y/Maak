import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export default function BookingsScreen() {
  const { user } = useAuth();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Text selectable style={styles.title}>حجوزاتي</Text>
      <Text selectable style={styles.subtitle}>كل المواعيد والخدمات ديالك في مكان واحد.</Text>
      <View style={styles.card}>
        <Text style={styles.icon}>✓</Text>
        <Text selectable style={styles.cardTitle}>{user ? 'ما عندك حتى حجز جديد' : 'سجّل الدخول لمتابعة الحجوزات'}</Text>
        <Text selectable style={styles.cardText}>{user ? 'منين تدير أول حجز، غادي يظهر هنا مع الحالة والموعد ومعلومات مقدم الخدمة.' : 'الدخول كيسمح لك بمتابعة المواعيد، الحالات، والإشعارات ديالك.'}</Text>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, gap: 0 }, title: { color: colors.ink, fontSize: 30, fontWeight: '900', textAlign: 'right', marginTop: 10 }, subtitle: { color: colors.muted, textAlign: 'right', marginTop: 5, marginBottom: 22 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: 25, alignItems: 'center' }, icon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E8F3EE', color: colors.success, textAlign: 'center', lineHeight: 60, fontSize: 28, fontWeight: '900' }, cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 16, textAlign: 'center' }, cardText: { color: colors.muted, textAlign: 'center', lineHeight: 22, marginTop: 8 }, });
