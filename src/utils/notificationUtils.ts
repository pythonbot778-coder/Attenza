import * as Notifications from 'expo-notifications'
import * as Device         from 'expo-device'
import { Platform }        from 'react-native'
import { registerPushToken, logNotification } from '../api/notificationApi'
import { navigateTo } from '../navigation/navigationRef'
import { useNotificationBannerStore } from '../store/notificationBannerStore'

// ── CRITICAL: Must be called before ANY component renders ────
// Controls how notifications appear when the app is FOREGROUND
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,  // allow OS alert where possible
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
})

// ─────────────────────────────────────────────────────────────
// Token registration
// ─────────────────────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Notifications] Skipping — not a physical device')
    return null
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission denied')
    return null
  }

  // Android notification channel — importance HIGH = heads-up popup (when allowed by OEM)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('attenza', {
      name:             'Attenza',
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#4F46E5',
      sound:            'default',
      enableVibrate:    true,
      showBadge:        true,
    })
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'afda8a63-2555-4f78-96a7-d306ded825dc',
    })
    const token    = tokenData.data
    const platform = Platform.OS === 'ios' ? 'ios' : 'android'

    await registerPushToken(token, platform)
    console.log('[Notifications] Token registered:', token)
    return token
  } catch (e: any) {
    console.error('[Notifications] Token fetch failed:', e.message)
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// Send push via Expo Push API
// ─────────────────────────────────────────────────────────────

export interface PushPayload {
  title:   string
  body:    string
  classId: string
  type:    'attendance' | 'broadcast'
  tokens:  string[]
  data?:   Record<string, any>
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const CHUNK_SIZE    = 100

export async function sendPushNotifications(payload: PushPayload): Promise<number> {
  const { title, body, tokens, data, classId, type } = payload
  const valid = tokens.filter(t => t.startsWith('ExponentPushToken['))
  if (valid.length === 0) return 0

  let sentCount = 0

  for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
    const chunk    = valid.slice(i, i + CHUNK_SIZE)
    const messages = chunk.map(to => ({
      to,
      title,
      body,
      data:             data ?? {},
      sound:            'default',
      priority:         'high',
      channelId:        'attenza',   // must match channel name above
      android: {
        channelId:  'attenza',
        priority:   'high',
        sound:      'default',
      },
    }))

    console.log('[Notifications] Sending messages:', JSON.stringify(messages, null, 2))

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(messages),
      })

      if (res.ok) {
        const json = await res.json()
        console.log('[Notifications] Expo response:', JSON.stringify(json, null, 2))
        const ok   = (json.data ?? []).filter((r: any) => r.status === 'ok').length
        sentCount += ok
      }
    } catch (e) {
      console.log('[Notifications] Chunk send failed:', e)
    }
  }

  try {
    await logNotification(classId, type, title, body, sentCount)
  } catch (e) {
    console.log('[Notifications] Log failed (non-critical):', e)
  }

  return sentCount
}

// ─────────────────────────────────────────────────────────────
// Notification listeners
// ─────────────────────────────────────────────────────────────

export function setupNotificationListeners() {
  // Fired when notification arrives while app is FOREGROUND
  const receivedSub = Notifications.addNotificationReceivedListener(notification => {
    const content = notification.request.content
    console.log('[Notifications] Received in foreground (listener):', content)

    // Show custom in-app banner
    useNotificationBannerStore.getState().showBanner({
      title: content.title ?? 'Notification',
      body:  content.body ?? '',
    })
  })

  // Fired when user TAPS a notification (from tray or popup)
  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as any
    console.log('[Notifications] Tapped, data:', data)

    try {
      navigateTo('Notifications')
    } catch (e) {
      console.log('[Notifications] Navigation failed:', e)
    }
  })

  return () => {
    receivedSub.remove()
    responseSub.remove()
  }
}

// ─────────────────────────────────────────────────────────────
// Handle notification that LAUNCHED the app from killed state
// Call this once on app start
// ─────────────────────────────────────────────────────────────

export async function handleInitialNotification() {
  const response = await Notifications.getLastNotificationResponseAsync()
  if (response) {
    console.log('[Notifications] App opened from notification:', response.notification.request.content.title)
    setTimeout(() => {
      try { navigateTo('Notifications') } catch (e) {}
    }, 1000)
  }
}