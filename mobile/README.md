# Maak Native Mobile

This directory is the real Android/iOS client for Maak. It is a React Native + Expo application; it does not render the existing Vite site inside a WebView.

## Stack

- Expo SDK 57 / React Native 0.86
- Expo Router 57 with native navigation
- Supabase Auth with SecureStore session persistence
- Existing Maak Worker API via `EXPO_PUBLIC_API_URL`

## Local development

```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

For a device build:

```bash
npx expo run:android
npx expo run:ios
```

For EAS:

```bash
npx eas build --profile preview --platform android
npx eas build --profile production --platform all
```

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are client-safe values. Never place the Supabase service-role key in this app.

## Architecture boundary

`/` at the repository root remains the existing web application. `mobile/` is the native application source of truth for Android/iOS. They share the Supabase backend and Worker contract but do not share the browser DOM/CSS shell.
