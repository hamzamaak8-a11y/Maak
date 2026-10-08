export type ThemeColors = {
  background: string; surface: string; surfaceAlt: string; border: string; text: string; textSecondary: string; textMuted: string;
  primary: string; primaryDark: string; primaryLight: string; onPrimary: string; accent: string; accentLight: string;
  success: string; successLight: string; error: string; errorLight: string; warning: string; warningLight: string; info: string; infoLight: string;
  overlay: string; shadow: string;
};

export const lightColors: ThemeColors = {
  background: '#F3F6F9', surface: '#FFFFFF', surfaceAlt: '#EAF0F5', border: '#D5DEE8',
  text: '#0B1220', textSecondary: '#475569', textMuted: '#64748B',
  primary: '#1D5FE0', primaryDark: '#173F9A', primaryLight: '#DCE8FF', onPrimary: '#FFFFFF',
  accent: '#F97316', accentLight: '#FFEDD5',
  success: '#10B981', successLight: '#D1FAE5', error: '#EF4444', errorLight: '#FEE2E2',
  warning: '#B45309', warningLight: '#FEF3C7', info: '#3B82F6', infoLight: '#DBEAFE',
  overlay: 'rgba(0,0,0,0.4)', shadow: 'rgba(0,0,0,0.08)',
};

export const darkColors: ThemeColors = {
  background: '#050B18', surface: '#0F1A2E', surfaceAlt: '#1A2740', border: '#2B3B55',
  text: '#F8FAFC', textSecondary: '#B6C2D2', textMuted: '#8A99AD',
  primary: '#4DA3FF', primaryDark: '#2563EB', primaryLight: '#10285C', onPrimary: '#04132E',
  accent: '#FB923C', accentLight: '#431407',
  success: '#34D399', successLight: '#064E3B', error: '#F87171', errorLight: '#450A0A',
  warning: '#FBBF24', warningLight: '#451A03', info: '#60A5FA', infoLight: '#172554',
  overlay: 'rgba(0,0,0,0.7)', shadow: 'rgba(0,0,0,0.5)',
};

/** Dark, glassy palette used by the sign-in / welcome screens (matches the brand login design). */
export const authColors: ThemeColors = {
  background: '#050B1F', surface: 'rgba(8,20,44,0.72)', surfaceAlt: 'rgba(255,255,255,0.06)', border: 'rgba(110,170,210,0.30)',
  text: '#F4F8FF', textSecondary: '#AAB9D0', textMuted: '#7F90AB',
  primary: '#4DA3FF', primaryDark: '#2F7CF0', primaryLight: 'rgba(77,163,255,0.16)', onPrimary: '#04132E',
  accent: '#F0A64A', accentLight: 'rgba(240,166,74,0.16)',
  success: '#3DD6A0', successLight: 'rgba(61,214,160,0.16)', error: '#FF8A80', errorLight: 'rgba(255,138,128,0.16)',
  warning: '#F1B84E', warningLight: 'rgba(241,184,78,0.16)', info: '#7AA2F7', infoLight: 'rgba(122,162,247,0.16)',
  overlay: 'rgba(0,0,0,0.7)', shadow: 'rgba(0,0,0,0.5)',
};
