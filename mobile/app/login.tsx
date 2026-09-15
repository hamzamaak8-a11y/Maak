import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Brand } from '../components/Brand';
import { colors, radii, spacing } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { user, signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) return <Redirect href="/(tabs)" />;

  async function submit() {
    setError(null);
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.error) setError(result.error);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Brand />
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MAAK</Text>
          <Text style={styles.title}>خدماتك المحلية،{`\n`}في تطبيق حقيقي.</Text>
          <Text style={styles.subtitle}>اكتشف مقدمي الخدمات الموثوقين، احجز، وتابع كل شيء من تجربة مصممة للموبايل أولًا.</Text>
        </View>

        <View style={styles.form}>
          <TextInput value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={styles.input} />
          <TextInput value={password} onChangeText={setPassword} placeholder="كلمة المرور" placeholderTextColor={colors.muted} secureTextEntry autoComplete="password" style={styles.input} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={() => void submit()} disabled={busy}>
            {busy ? <ActivityIndicator color="#151A1F" /> : <Text style={styles.buttonText}>دخول</Text>}
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)')}><Text style={styles.demo}>تصفح التطبيق بدون تسجيل الدخول</Text></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 24 },
  hero: { marginTop: 54, marginBottom: 30 },
  eyebrow: { color: colors.goldDeep, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 8, textAlign: 'right' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 25, marginTop: 14, textAlign: 'right' },
  form: { gap: 12 },
  input: { minHeight: 56, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, color: colors.ink, textAlign: 'right', fontSize: 16 },
  button: { minHeight: 56, borderRadius: radii.md, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  demo: { color: colors.goldDeep, textAlign: 'center', fontSize: 13, fontWeight: '800', marginTop: 8 },
});
