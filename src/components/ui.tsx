import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PAGE_MAX_WIDTH } from '../config/env';
import { errorKey } from '../lib/errors';
import type { TKey } from '../i18n/en';

type IconName = keyof typeof Ionicons.glyphMap;

/* ------------------------------------------------------------------ hooks */

export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      if (alive.current) setData(result);
    } catch (e) {
      if (alive.current) setError(e);
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void run(); }, [run]);
  return { data, setData, loading, error, reload: run };
}

/* ----------------------------------------------------------------- layout */

export function Screen({ children, edges = ['top'], style }: { children: React.ReactNode; edges?: Array<'top' | 'bottom' | 'left' | 'right'>; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</SafeAreaView>;
}

export function BackIcon({ size = 24, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  return <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={size} color={color ?? colors.text} />;
}

export function ChevronIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  return <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={size} color={color ?? colors.textMuted} />;
}

export function Header({ title, onBack, right, noBack }: { title: string; onBack?: () => void; right?: React.ReactNode; noBack?: boolean }) {
  const { colors } = useTheme();
  const nav = useNavigation();
  return (
    <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      {noBack ? <View style={styles.headerSide} /> : (
        <Pressable accessibilityRole="button" onPress={onBack ?? (() => (nav.canGoBack() ? nav.goBack() : undefined))} style={styles.headerSide} hitSlop={8}>
          <BackIcon />
        </Pressable>
      )}
      <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function Page({ children, refreshControl, contentStyle }: { children: React.ReactNode; refreshControl?: React.ReactElement<any>; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView refreshControl={refreshControl} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={[{ padding: 18, paddingBottom: 48, gap: 18, width: '100%', maxWidth: PAGE_MAX_WIDTH, alignSelf: 'center' }, contentStyle]}>
      {children}
    </ScrollView>
  );
}

export function Form({ children }: { children: React.ReactNode }) {
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{children}</KeyboardAvoidingView>;
}

export function Card({ children, onPress, style, padded = true }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { colors, isDark } = useTheme();
  const base = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: padded ? 18 : 0, boxShadow: isDark ? '0 1px 2px rgba(0,0,0,.4)' : '0 1px 2px rgba(15,23,42,.05), 0 6px 18px rgba(15,23,42,.07)' }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.92 }]}>{children}</Pressable>;
}

export function Row({ children, style, gap = 8 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {action && onAction ? <Pressable onPress={onAction} hitSlop={8}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{action}</Text></Pressable> : null}
    </Row>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function Muted({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<any>; numberOfLines?: number }) {
  const { colors } = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }, style]}>{children}</Text>;
}

export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<any> }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.text, fontSize: 27, fontWeight: '800', lineHeight: 35, letterSpacing: -0.3 }, style]}>{children}</Text>;
}

export function Body({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<any>; numberOfLines?: number }) {
  const { colors } = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ color: colors.text, fontSize: 16, lineHeight: 24 }, style]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 7 }}>{children}</Text>;
}

/* ---------------------------------------------------------------- controls */

type ButtonProps = {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  loading?: boolean; disabled?: boolean; icon?: IconName; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle>;
  /** Bright teal gradient with a soft glow (primary call-to-action on the sign-in screens). */
  gradient?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, size = 'md', style, gradient }: ButtonProps) {
  const { colors } = useTheme();
  const map = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.primaryLight, fg: colors.primary, border: colors.primaryLight },
    outline: { bg: 'transparent', fg: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', fg: colors.textSecondary, border: 'transparent' },
    danger: { bg: colors.error, fg: '#FFFFFF', border: colors.error },
  }[variant];
  const off = disabled || loading;
  const inner = loading ? <ActivityIndicator color={map.fg} size="small" /> : (
    <>
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 20} color={map.fg} /> : null}
      <Text style={{ color: map.fg, fontWeight: '800', fontSize: size === 'sm' ? 14 : 17 }}>{title}</Text>
    </>
  );
  if (gradient && variant === 'primary') {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={off} onPress={onPress}
        style={({ pressed }) => [{ borderRadius: 16, opacity: off ? 0.55 : pressed ? 0.9 : 1, boxShadow: '0 10px 26px rgba(45,212,191,0.32)' }, style]}>
        <LinearGradient colors={['#34EBD0', '#14B8A6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, paddingHorizontal: 22, borderRadius: 16 }}>
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable accessibilityRole="button" disabled={off} onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: map.bg, borderColor: map.border, minHeight: size === 'sm' ? 40 : 52, paddingVertical: size === 'sm' ? 8 : 13, paddingHorizontal: size === 'sm' ? 16 : 22, opacity: off ? 0.5 : pressed ? 0.88 : 1 }, style]}>
      {inner}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color, label, badge }: { icon: IconName; onPress: () => void; color?: string; label?: string; badge?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name={icon} size={20} color={color ?? colors.text} />
      {badge ? <View style={[styles.badgeDot, { backgroundColor: colors.error }]}><Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label?: string; error?: string | null; icon?: IconName; secure?: boolean; multiline?: boolean; style?: StyleProp<ViewStyle> };

export function TextField({ label, error, icon, secure, multiline, style, ...rest }: FieldProps) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={style}>
      {label ? <Label>{label}</Label> : null}
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: error ? colors.error : colors.border, alignItems: multiline ? 'flex-start' : 'center' }]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} style={multiline ? { marginTop: 12 } : undefined} /> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          multiline={multiline}
          textAlign={isRTL ? 'right' : 'left'}
          {...rest}
          style={[styles.input, { color: colors.text, minHeight: multiline ? 104 : 52, textAlignVertical: multiline ? 'top' : 'center' }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
        />
        {secure ? (
          <Pressable onPress={() => setHidden(h => !h)} hitSlop={8}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={{ color: colors.error, fontSize: 13, marginTop: 5 }}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress}
      style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }]}>
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.onPrimary : colors.textSecondary} /> : null}
      <Text style={{ color: selected ? colors.onPrimary : colors.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export function Tabs<K extends string>({ items, value, onChange }: { items: Array<{ key: K; label: string; count?: number }>; value: K; onChange: (k: K) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0 }}>
      {items.map(i => <Chip key={i.key} selected={i.key === value} onPress={() => onChange(i.key)} label={i.count ? `${i.label} (${i.count})` : i.label} />)}
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- feedback */

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Muted style={{ marginTop: 10 }}>{label}</Muted> : null}
    </View>
  );
}

export function EmptyState({ icon = 'file-tray-outline', title, text, action }: { icon?: IconName; title: string; text?: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { paddingVertical: 48, paddingHorizontal: 24 }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}><Ionicons name={icon} size={30} color={colors.primary} /></View>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 14 }}>{title}</Text>
      {text ? <Muted style={{ textAlign: 'center', marginTop: 6 }}>{text}</Muted> : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useLanguage();
  return <EmptyState icon="cloud-offline-outline" title={t(errorKey(error))} action={onRetry ? <Button title={t('common.retry')} onPress={onRetry} variant="outline" size="sm" /> : undefined} />;
}

export function Banner({ kind = 'info', text }: { kind?: 'info' | 'success' | 'error' | 'warning'; text: string }) {
  const { colors } = useTheme();
  const map = { info: [colors.infoLight, colors.info], success: [colors.successLight, colors.success], error: [colors.errorLight, colors.error], warning: [colors.warningLight, colors.warning] }[kind];
  return <View style={{ backgroundColor: map[0], borderRadius: 12, padding: 12 }}><Text style={{ color: map[1], fontSize: 13, fontWeight: '600', lineHeight: 19 }}>{text}</Text></View>;
}

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'primary' }) {
  const { colors } = useTheme();
  const map = {
    neutral: [colors.surfaceAlt, colors.textSecondary], success: [colors.successLight, colors.success], warning: [colors.warningLight, colors.warning],
    error: [colors.errorLight, colors.error], info: [colors.infoLight, colors.info], primary: [colors.primaryLight, colors.primary],
  }[tone];
  return <View style={[styles.badge, { backgroundColor: map[0] }]}><Text style={{ color: map[1], fontSize: 12, fontWeight: '800' }}>{text}</Text></View>;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary'> = {
  pending: 'warning', accepted: 'info', in_progress: 'primary', completed: 'success', rejected: 'error', cancelled: 'neutral',
  approved: 'success', draft: 'neutral', suspended: 'error', active: 'success', unpaid: 'neutral', paid: 'success', refunded: 'info',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  return <Badge text={t(`status.${status}` as TKey)} tone={STATUS_TONE[status] ?? 'neutral'} />;
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <Row gap={1}>
      {[1, 2, 3, 4, 5].map(i => <Ionicons key={i} name={value >= i - 0.25 ? 'star' : value >= i - 0.75 ? 'star-half' : 'star-outline'} size={size} color={colors.accent} />)}
    </Row>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { colors } = useTheme();
  return (
    <Row gap={6}>
      {[1, 2, 3, 4, 5].map(i => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={4}>
          <Ionicons name={value >= i ? 'star' : 'star-outline'} size={34} color={colors.accent} />
        </Pressable>
      ))}
    </Row>
  );
}

export function Avatar({ name, uri, size = 48 }: { name: string; uri?: string | null; size?: number }) {
  const { colors } = useTheme();
  const initials = (name || '?').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {uri && !failed ? <Image source={{ uri }} style={{ width: size, height: size }} onError={() => setFailed(true)} /> : <Text style={{ color: colors.primary, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>}
    </View>
  );
}

export function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string | null | undefined }) {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <Row gap={10} style={{ alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={18} color={colors.textMuted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{value}</Text>
      </View>
    </Row>
  );
}

/* ------------------------------------------------------------------ sheets */

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={24} color={colors.textSecondary} /></Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 12, maxWidth: 560, width: '100%', alignSelf: 'center' }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Asks for a short text (rejection reason, cancellation reason...). */
export function ReasonSheet({ visible, title, placeholder, confirmLabel, required = true, busy, onClose, onConfirm }: {
  visible: boolean; title: string; placeholder: string; confirmLabel: string; required?: boolean; busy?: boolean; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  useEffect(() => { if (visible) setText(''); }, [visible]);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <TextField value={text} onChangeText={setText} placeholder={placeholder} multiline />
      <Button title={confirmLabel} variant="danger" loading={busy} disabled={required && !text.trim()} onPress={() => onConfirm(text.trim())} />
      <Button title={t('common.cancel')} variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 58 },
  headerSide: { width: 44, height: 40, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1.5 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeDot: { position: 'absolute', top: -3, end: -3, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  field: { flexDirection: 'row', gap: 10, borderWidth: 1.2, borderRadius: 14, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.2 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 4, borderRadius: 100 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' },
});
