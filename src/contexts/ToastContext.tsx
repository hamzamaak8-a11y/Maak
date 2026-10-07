import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from './ThemeContext';

type ToastKind = 'success' | 'error' | 'info';
type ToastValue = { show: (message: string, kind?: ToastKind) => void };
const ToastContext = createContext<ToastValue>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const value = useMemo(() => ({ show }), [show]);
  const bg = toast?.kind === 'error' ? colors.error : toast?.kind === 'success' ? colors.success : colors.text;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={styles.wrap}>
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Text style={[styles.text, { color: colors.surface }]}>{toast.message}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 16, end: 16, bottom: 96, alignItems: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, maxWidth: 520 },
  text: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

export const useToast = () => useContext(ToastContext);
