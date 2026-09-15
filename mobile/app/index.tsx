import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

export default function IndexRoute() {
  const { user, loading } = useAuth();
  if (loading) return <View style={styles.root}><ActivityIndicator color={colors.goldDeep} size="small" /></View>;
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' } });
