import type { ExpoConfig } from 'expo/config';

// GitHub Pages (or any sub-path host) needs EXPO_BASE_URL=/Maak at export time.
const baseUrl = process.env.EXPO_BASE_URL || undefined;

const config: ExpoConfig = {
  name: 'Maak',
  slug: 'maak',
  scheme: 'maak',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.maak.app',
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: 'com.maak.app',
    adaptiveIcon: {
      backgroundColor: '#0E6B55',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single' },
  plugins: [
    'expo-font',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 160, resizeMode: 'contain', backgroundColor: '#F7F6F1', dark: { backgroundColor: '#0D1411' } }],
    'expo-localization',
    'expo-web-browser',
    [
      'expo-image-picker',
      {
        photosPermission: 'Maak needs access to your photos so you can upload your profile picture, documents and work samples.',
        cameraPermission: 'Maak needs the camera so you can take a photo of your documents or your work.',
      },
    ],
  ],
  experiments: baseUrl ? { baseUrl } : undefined,
};

export default config;
