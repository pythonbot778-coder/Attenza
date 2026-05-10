import { supabase } from './supabase'

export interface ClassNotification {
  id:           string
  type:         'attendance' | 'broadcast'
  title:        string
  body:         string
  sent_count:   number
  created_at:   string
  sent_by_name: string | null
}

export interface AdminNotification extends ClassNotification {
  class_id: string
  branch:   string
  year:     number
  semester: number
  section:  string
}

async function rpc<T>(fn: string, params: Record<string, any> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params)
  if (error) throw error
  return (data ?? []) as T
}

export async function registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  return rpc('register_push_token', { p_token: token, p_platform: platform })
}

export async function getClassPushTokens(classId: string): Promise<string[]> {
  const data = await rpc<string[] | null>('get_class_push_tokens', { p_class_id: classId })
  console.log('[Notifications] getClassPushTokens for class', classId, '→', data)
  return data ?? []
}

export async function logNotification(
  classId: string, type: 'attendance' | 'broadcast',
  title: string, body: string, sentCount: number
): Promise<string> {
  return rpc<string>('log_notification', {
    p_class_id: classId, p_type: type,
    p_title: title, p_body: body, p_sent_count: sentCount,
  })
}

export async function getClassNotifications(classId: string, limit = 50): Promise<ClassNotification[]> {
  const data = await rpc<ClassNotification[] | null>('get_class_notifications', {
    p_class_id: classId, p_limit: limit,
  })
  return data ?? []
}

export async function adminGetAllNotifications(limit = 100): Promise<AdminNotification[]> {
  const data = await rpc<AdminNotification[] | null>('admin_get_all_notifications', { p_limit: limit })
  return data ?? []
}