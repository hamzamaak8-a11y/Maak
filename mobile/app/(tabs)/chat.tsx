import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../../constants/theme';

export default function ChatScreen() {
  return <View style={styles.root}>
    <Text style={styles.title}>المحادثات</Text>
    <Text style={styles.subtitle}>تواصل مباشرة مع مقدمي الخدمات.</Text>
    <View style={styles.card}><Text style={styles.badge}>MAAK CHAT</Text><Text style={styles.cardTitle}>المحادثة أصلية داخل التطبيق</Text><Text style={styles.cardText}>هذه الشاشة مبنية كـNative screen داخل React Native، وليست صفحة ويب أو iframe.</Text></View>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background, padding: 20 }, title: { color: colors.ink, fontSize: 30, fontWeight: '900', textAlign: 'right', marginTop: 10 }, subtitle: { color: colors.muted, textAlign: 'right', marginTop: 5, marginBottom: 22 }, card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.lg, padding: 24 }, badge: { alignSelf: 'flex-end', color: colors.goldDeep, fontWeight: '900', fontSize: 11, letterSpacing: 1.3 }, cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'right', marginTop: 18 }, cardText: { color: colors.muted, lineHeight: 22, textAlign: 'right', marginTop: 8 }, });
