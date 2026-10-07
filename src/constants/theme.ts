export type ThemeColors = {
  background: string; surface: string; surfaceAlt: string; border: string; text: string; textSecondary: string; textMuted: string;
  primary: string; primaryDark: string; primaryLight: string; onPrimary: string; accent: string; accentLight: string;
  success: string; successLight: string; error: string; errorLight: string; warning: string; warningLight: string; info: string; infoLight: string;
  overlay: string; shadow: string;
};

export const lightColors: ThemeColors = {
  background: '#F7F6F1', surface: '#FFFFFF', surfaceAlt: '#EFEEE7', border: '#E2E0D6',
  text: '#16211D', textSecondary: '#4F5B56', textMuted: '#85908B',
  primary: '#0E6B55', primaryDark: '#0A5242', primaryLight: '#E1F0EA', onPrimary: '#FFFFFF',
  accent: '#D9892B', accentLight: '#FBEBD3',
  success: '#12805C', successLight: '#D8F1E6', error: '#C2362B', errorLight: '#FBE1DE',
  warning: '#B7791F', warningLight: '#FBEFD2', info: '#2563EB', infoLight: '#DEE8FD',
  overlay: 'rgba(8,16,13,0.45)', shadow: 'rgba(16,33,27,0.10)',
};

export const darkColors: ThemeColors = {
  background: '#0D1411', surface: '#151F1B', surfaceAlt: '#1D2A25', border: '#2A3A34',
  text: '#EEF3F0', textSecondary: '#AEBBB5', textMuted: '#7D8C86',
  primary: '#2FB38F', primaryDark: '#1F8F72', primaryLight: '#123A30', onPrimary: '#06201A',
  accent: '#F0A64A', accentLight: '#3A2A12',
  success: '#3DD6A0', successLight: '#103A2C', error: '#F07468', errorLight: '#40201D',
  warning: '#F1B84E', warningLight: '#3A2C10', info: '#7AA2F7', infoLight: '#17284A',
  overlay: 'rgba(0,0,0,0.65)', shadow: 'rgba(0,0,0,0.5)',
};
