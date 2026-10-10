import type { ExpoConfig } from 'expo/config';

// GitHub Pages (or any sub-path host) needs EXPO_BASE_URL=/Maak at export time.
const baseUrl = process.env.EXPO_BASE_URL || undefined;

const config: ExpoConfig = {
  name: 'Maak',
  slug: 'maak',
  // Official Expo account (hamzamaak8) and EAS project "MAAK" — created under hamzamaak8@gmail.com.
  owner: 'hamzamaak8',
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
      backgroundColor: '#04112F',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Optional: set GOOGLE_SERVICES_JSON (an EAS file variable) to the Firebase google-services.json to enable Android push.
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
    // Session tokens must not leak into cloud/ADB backups.
    allowBackup: false,
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW'],
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single' },
  plugins: [
    'expo-font',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 160, resizeMode: 'contain', backgroundColor: '#04112F', dark: { backgroundColor: '#04112F' } }],
    'expo-localization',
    'expo-web-browser',
    // Push notifications for a closed app. Android needs the owner's free Firebase file (see docs/PUSH_NOTIFICATIONS.md).
    ['expo-notifications', { color: '#1D5FE0', defaultChannel: 'default' }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Maak needs access to your photos so you can upload your profile picture, documents and work samples.',
        cameraPermission: 'Maak needs the camera so you can take a photo of your documents or your work.',
      },
    ],
  ],
  extra: { eas: { projectId: '0ad7c4c2-3fcf-4bb4-b37b-281e0e34c97c' } },
  experiments: baseUrl ? { baseUrl } : undefined,
};

export default config;
