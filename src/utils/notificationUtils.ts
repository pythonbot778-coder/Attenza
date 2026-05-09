import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { registerPushToken, logNotification } from '../api/notificationApi'


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
})


export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('attenza-alerts', {  // ← new channel ID
      name:                'Attenza Alerts',
      importance:          Notifications.AndroidImportance.MAX,           // ← HIGH → MAX
      vibrationPattern:    [0, 250, 250, 250],
      lightColor:          '#4F46E5',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge:           true,
    })
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '3a04ba9e-0d30-4743-8e60-f735894d2922',
    })
    const token    = tokenData.data
    const platform = Platform.OS === 'ios' ? 'ios' : 'android'
    await registerPushToken(token, platform)
    return token
  } catch (e) {
    console.log('[Notifications] Token fetch failed:', e)
    return null
  }
}


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
      data:      data ?? {},
      sound:     'default',
      priority:  'high',
      channelId: 'attenza-alerts',   // ← ADD — links message to MAX importance channel
      ttl:       0,                  // ← ADD — deliver immediately, no delay
    }))
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(messages),
      })
      if (res.ok) {
        const json = await res.json()
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


export function setupNotificationListeners() {
  const receivedSub = Notifications.addNotificationReceivedListener(n => {
    console.log('[Notifications] Received:', n)
  })
  const responseSub = Notifications.addNotificationResponseReceivedListener(r => {
    console.log('[Notifications] Tapped:', r)
  })
  return () => { receivedSub.remove(); responseSub.remove() }
}