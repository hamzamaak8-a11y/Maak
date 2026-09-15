import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel="Maak">
      <View style={[styles.mark, compact && styles.markCompact]}><Text style={styles.markText}>م</Text></View>
      <Text style={[styles.name, compact && styles.nameCompact]}>Maak</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  markCompact: { width: 32, height: 32, borderRadius: 10 },
  markText: { color: '#151A1F', fontSize: 20, fontWeight: '900' },
  name: { color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  nameCompact: { fontSize: 21 },
});
