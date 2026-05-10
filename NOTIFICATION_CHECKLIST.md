# 📢 Attenza Notification Health Checklist

This document outlines all verification steps for maintaining notification reliability across Expo, Firebase, and your app codebase.

---

## A. Manual Checks (Web UIs)

These checks require human verification in dashboards. Do them once per account/environment change.

### ✓ Firebase Android App Correctness

**Where:** [Firebase Console](https://console.firebase.google.com/) → Your Project → Project Settings → Apps

- [ ] Android app exists with package exactly: `com.vindra.attenza`
- [ ] `google-services.json` downloaded from this app
  - Verify inside the JSON: `"package_name": "com.vindra.attenza"`
- [ ] Firebase Cloud Messaging (FCM) is **Enabled** under APIs
  - Navigate to: APIs & Services → Enabled APIs & services → Search "Cloud Messaging"

**Reference:** [Firebase Admin SDK Documentation](https://firebase.google.com/docs/projects/learn-more#fcm-enabled)

---

### ✓ Expo Project Identity

**Where:** [expo.dev](https://expo.dev/) → Logged in as `python778`

- [ ] Project with `projectId = afda8a63-2555-4f78-96a7-d306ded825dc` exists
- [ ] Android Application ID is `com.vindra.attenza`
  - Path: Project Settings → Android → Application ID
- [ ] Owner is `python778` (should match logged-in user)
  - Verify in [app.json](app.json): `"owner": "python778"`

---

### ✓ FCM Server Credentials in Expo

**Where:** [expo.dev](https://expo.dev/) → Your Project → Credentials → Android

- [ ] FCM section shows one of:
  - ✅ Uploaded service account JSON (Firebase Admin SDK key)
  - ✅ Legacy Server Key (if still using FCM HTTP)
- [ ] The credential belongs to the **same Firebase project** as `google-services.json`
  - Cross-check: Firebase Project ID in the credential should match

**How to upload Firebase credentials:**
1. In Firebase Console → Project Settings → Service Accounts
2. Generate new private key (if needed) → Downloads `[project-name]-[hash].json`
3. In Expo → Credentials → Android → FCM → Upload that JSON

**Reference:** [Expo Push Notifications with FCM](https://docs.expo.dev/push-notifications/setup/)

---

### ✓ Expo Notifications Tool Smoke Test

**What:** End-to-end test of push delivery.

**Tools:**
- Latest APK installed and running on device/emulator
- [Expo Notifications Tool](https://expo.dev/notifications)

**Steps:**
1. Install latest APK; open app once
2. Open device logs; copy `ExponentPushToken[...]` from Attenza logs
3. Go to Expo Notifications Tool
4. Enter:
   - **Token:** `ExponentPushToken[...]` (from step 2)
   - **Title:** "Test Notification"
   - **Body:** "If you see this, notifications work!"
   - **Android Channel ID:** `attenza` (must match your channel name)
5. Send
6. Verify:
   - ✅ Notification appears while app is **foreground** (via custom banner or system alert)
   - ✅ Notification appears while app is **background** (via system tray)
   - ✅ Tapping notification navigates to Notifications screen

---

## B. Codebase Automated Checks

These can be verified by running code scans. Most are now automated.

### ✓ Run Configuration Consistency Check

```bash
npm run check-notifications
```

**What it verifies:**
- ✅ `app.json` Android package, EAS project ID, Expo owner
- ✅ `notificationUtils.ts` uses the correct project ID
- ✅ Channel ID is consistent (`attenza` everywhere)
- ✅ Notification importance is `HIGH`
- ✅ Sound and vibration are properly configured

**Example output:**
```
✅ All checks passed!
```

---

### ✓ Manual Code Review Checklist

If you want to review these manually:

#### In [app.json](app.json)

- [ ] `expo.android.package` = `"com.vindra.attenza"`
- [ ] `expo.android.googleServicesFile` = `"./google-services.json"`
- [ ] `expo.extra.eas.projectId` = `"afda8a63-2555-4f78-96a7-d306ded825dc"`
- [ ] `expo.owner` = `"python778"`
- [ ] `expo-notifications` present in `plugins`
- [ ] `expo.android.permissions` includes `"android.permission.POST_NOTIFICATIONS"`

#### In [src/utils/notificationUtils.ts](src/utils/notificationUtils.ts)

- [ ] `Notifications.setNotificationHandler({})` called at module level (not inside components)
- [ ] `setNotificationChannelAsync('attenza', { ... })` creates channel with:
  - `importance: Notifications.AndroidImportance.HIGH`
  - `sound: 'default'`
  - `enableVibrate: true`
  - `showBadge: true`
- [ ] `getExpoPushTokenAsync({ projectId: 'afda8a63-2555-4f78-96a7-d306ded825dc' })`
- [ ] All push messages use:
  - `channelId: 'attenza'`
  - `android: { channelId: 'attenza', ... }`
- [ ] Tokens are filtered: `.filter(t => t.startsWith('ExponentPushToken['))`

#### In [App.tsx](App.tsx)

- [ ] `setupNotificationListeners()` called once in a top-level `useEffect`
- [ ] `handleInitialNotification()` called on app start
- [ ] `NotificationBanner` component is rendered at the root level

#### In notification API responses

- [ ] All messages include required fields:
  ```json
  {
    "to": "ExponentPushToken[...]",
    "title": "...",
    "body": "...",
    "sound": "default",
    "priority": "high",
    "channelId": "attenza",
    "android": { "channelId": "attenza", "priority": "high", "sound": "default" }
  }
  ```

---

## C. Integration Script Checklist

### Before Building for Production

```bash
# 1. Check configuration consistency
npm run check-notifications

# 2. Build
eas build --platform android

# 3. Smoke test on device/emulator
# (manual — see A.4 above)
```

---

## Common Issues & Troubleshooting

### "ExponentPushToken is null or empty"
- [ ] Device is physical (not emulator for iOS)
- [ ] Notification permissions granted in app
- [ ] App is running on latest APK build
- [ ] Check logs for `[Notifications] Token registered: ExponentPushToken[...]`

### "Notification doesn't show in foreground"
- [ ] Verify `setNotificationHandler({ shouldShowAlert: true })` is in [notificationUtils.ts](src/utils/notificationUtils.ts#L12)
- [ ] Verify `NotificationBanner` is rendered in [App.tsx](App.tsx)
- [ ] Check that `setupNotificationListeners()` is wired in App.tsx

### "Notification doesn't show in background"
- [ ] Verify FCM server key is uploaded to Expo (see A.3)
- [ ] Verify `channelId: 'attenza'` in all messages
- [ ] Verify Android notification channel exists with `importance: HIGH`
- [ ] Check Firebase Console → Cloud Messaging → Topic Management (no delivery issues)

### "Token mismatch or projectId wrong"
- [ ] Run `npm run check-notifications` — it will show mismatches
- [ ] Regenerate token if necessary: clear app cache → reinstall APK
- [ ] Verify [app.json](app.json) matches [notificationUtils.ts](src/utils/notificationUtils.ts)

---

## When to Re-Check

- ✅ After changing Expo account
- ✅ After changing Firebase project
- ✅ After changing app package name
- ✅ Before submitting to Google Play / App Store
- ✅ After rotating Firebase service account keys
- ✅ After upgrading `expo-notifications` or Firebase packages
- ✅ When starting a new development environment

---

## References

- [Expo Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
- [Expo Notifications with FCM](https://docs.expo.dev/push-notifications/setup/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Android Notification Channels](https://developer.android.com/training/notify-user/channels)
