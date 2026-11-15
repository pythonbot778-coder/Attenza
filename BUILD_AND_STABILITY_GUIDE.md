# Attenza — Build & Stability Reference Guide

This document captures critical architectural rules, build configurations, and troubleshooting solutions discovered during EAS APK compilation and production stabilization. Follow these rules to avoid regressions in future builds.

---

## 1. Android Native Build & Compile SDK (Expo SDK 58 / React Native 0.88)

### Problem
- Gradle build failed during `checkReleaseAarMetadata` with errors:
  - `Dependency 'androidx.core:core:1.17.0' requires libraries and applications to compile against version 36 or later.`
  - `Dependency 'host.exp.exponent:expo.modules.*' requires version 37 or later of the Android APIs.`
  - Project was pinned to `compileSdkVersion: 35` in `app.json`.

### Solution
- In `app.json`, under `expo-build-properties`:
  ```json
  [
    "expo-build-properties",
    {
      "android": {
        "compileSdkVersion": 37,
        "targetSdkVersion": 35
      },
      "ios": {
        "deploymentTarget": "16.4"
      }
    }
  ]
  ```
- **Rule:** Do not manually pin `buildToolsVersion` unless strictly required; allow Android Gradle Plugin (AGP) to choose the matching tools for SDK 37.

---

## 2. Environment Variables & Startup Crash Prevention

### Problem
- The standalone APK opened and closed immediately upon launch.
- Cause: `.env` is gitignored. When EAS Build runs in the cloud, `process.env.EXPO_PUBLIC_SUPABASE_URL` and `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY` were `undefined`.
- In `src/api/supabase.ts`, `createClient('', '')` threw `Error: supabaseUrl is required.` at top-level module evaluation time. Because this executed before React mounted, the app crashed on boot without showing any error boundary.

### Solution
- In `src/api/supabase.ts`:
  ```typescript
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Attenza] Missing Supabase credentials. Ensure .env or build environment variables are set.')
  }

  // Fallback to placeholder strings so createClient never throws during module load
  export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
    {
      auth: {
        storage: ChunkedSecureStore,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }
  )
  ```
- Keep real credentials in local `.env` and local `eas.json`.
- **Git Security Rule:** Never commit raw API keys or tokens into `app.json`, `src/`, or git-tracked files. Keep `eas.json` and `.env` in `.gitignore`, and use `eas.json.example` for repository templates.

---

## 3. Entry Point & Native Gesture Handler

### Problem
- On Android native builds, gestures and navigation can crash native activities on launch if `react-native-gesture-handler` is not loaded first.

### Solution
- Always ensure `import 'react-native-gesture-handler';` is the very first line of `index.ts`:
  ```typescript
  import 'react-native-gesture-handler';
  import { registerRootComponent } from 'expo';
  import App from './App';

  registerRootComponent(App);
  ```

---

## 4. Native Splash Screen Lifecycle

### Problem
- When `expo-splash-screen` is installed, the native Android activity can freeze or timeout if the native splash screen is never told to hide.

### Solution
- In `App.tsx`, always invoke `SplashScreen.hideAsync().catch(() => {})` inside `useEffect` during startup:
  ```typescript
  import * as SplashScreen from 'expo-splash-screen'

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {})
    hydrateAuthState()
  }, [])
  ```

---

## 5. Summary Checklist Before Triggering EAS Builds
1. [x] Run `npx expo-doctor` (must pass 20/20 checks).
2. [x] Run `npx tsc --noEmit` (0 TypeScript errors).
3. [x] Verify `eas.json` has `buildType: "apk"` under `preview` profile and valid credentials in `env`.
4. [x] Verify `.env` and `eas.json` remain gitignored so secrets are never pushed to the remote repository.
