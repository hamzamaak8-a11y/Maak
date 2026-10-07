export type ThemeColors = {
  background: string; surface: string; surfaceAlt: string; border: string; text: string; textSecondary: string; textMuted: string;
  primary: string; primaryDark: string; primaryLight: string; onPrimary: string; accent: string; accentLight: string;
  success: string; successLight: string; error: string; errorLight: string; warning: string; warningLight: string; info: string; infoLight: string;
  overlay: string; shadow: string;
};

export const lightColors: ThemeColors = {
  background: '#F8FAFC', surface: '#FFFFFF', surfaceAlt: '#F1F5F9', border: '#E2E8F0',
  text: '#0F172A', textSecondary: '#64748B', textMuted: '#94A3B8',
  primary: '#0D9488', primaryDark: '#115E59', primaryLight: '#CCFBF1', onPrimary: '#FFFFFF',
  accent: '#F97316', accentLight: '#FFEDD5',
  success: '#10B981', successLight: '#D1FAE5', error: '#EF4444', errorLight: '#FEE2E2',
  warning: '#B45309', warningLight: '#FEF3C7', info: '#3B82F6', infoLight: '#DBEAFE',
  overlay: 'rgba(0,0,0,0.4)', shadow: 'rgba(0,0,0,0.08)',
};

export const darkColors: ThemeColors = {
  background: '#020617', surface: '#0F172A', surfaceAlt: '#1E293B', border: '#334155',
  text: '#F8FAFC', textSecondary: '#94A3B8', textMuted: '#64748B',
  primary: '#2DD4BF', primaryDark: '#0D9488', primaryLight: '#134E4A', onPrimary: '#042F2E',
  accent: '#FB923C', accentLight: '#431407',
  success: '#34D399', successLight: '#064E3B', error: '#F87171', errorLight: '#450A0A',
  warning: '#FBBF24', warningLight: '#451A03', info: '#60A5FA', infoLight: '#172554',
  overlay: 'rgba(0,0,0,0.7)', shadow: 'rgba(0,0,0,0.5)',
};
