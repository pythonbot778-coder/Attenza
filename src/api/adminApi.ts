import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────

export interface AdminStats {
  total_users:       number
  total_classes:     number
  total_members:     number
  sessions_today:    number
  pending_sync:      number
  pending_transfers: number
}

export interface AdminUser {
  id:            string
  email:         string
  name:          string | null
  role_global:   'admin' | 'user'
  mobile_number: string | null
  created_at:    string
}

export interface AdminClass {
  id:           string
  branch:       string
  year:         number
  semester:     number
  section:      string
  start_roll:   string
  end_roll:     string
  created_at:   string
  member_count: number
  joined_count: number
}

export interface AdminClassMember {
  id:          string
  user_id:     string | null
  roll_number: string
  name:        string | null
  role:        'CR' | 'LR' | 'STUDENT'
  status:      'active' | 'inactive'
}

export interface AdminSubject {
  id:           string
  name:         string
  faculty_name: string
  type:         'CLASS' | 'LAB'
  created_at:   string
}

export interface AdminSession {
  id:           string
  date_selected: string
  batch_name:   string | null
  is_edited:    boolean
  created_at:   string
  subject_name: string
  subject_type: 'CLASS' | 'LAB'
  record_count: number
  present_count: number
}

export interface AdminTransfer {
  id:           string
  role:         'CR' | 'LR'
  status:       'pending' | 'accepted' | 'rejected' | 'approved'
  requested_at: string
  accepted_at:  string | null
  class_id:     string
  branch:       string
  year:         number
  semester:     number
  section:      string
  from_name:    string | null
  from_email:   string | null
  to_name:      string | null
  to_email:     string | null
}

export interface AdminLog {
  id:          string
  action_type: string
  description: string | null
  created_at:  string
  target_id:   string | null
  admin_name:  string | null
  admin_email: string | null
}

// ─── Base caller ──────────────────────────────────────────────

async function rpc<T>(fn: string, params: Record<string, any> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params)
  if (error) throw error
  return (data ?? []) as T
}

// ─── Read ─────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<AdminStats> {
  return rpc<AdminStats>('get_dashboard_stats')
}

export async function getAllUsers(): Promise<AdminUser[]> {
  return (await rpc<AdminUser[] | null>('admin_get_all_users')) ?? []
}

export async function getAllClasses(): Promise<AdminClass[]> {
  return (await rpc<AdminClass[] | null>('admin_get_all_classes')) ?? []
}

export async function getClassMembers(classId: string): Promise<AdminClassMember[]> {
  return (await rpc<AdminClassMember[] | null>('admin_get_class_members', { p_class_id: classId })) ?? []
}

export async function getClassSubjects(classId: string): Promise<AdminSubject[]> {
  return (await rpc<AdminSubject[] | null>('admin_get_class_subjects', { p_class_id: classId })) ?? []
}

export async function getClassSessions(classId: string): Promise<AdminSession[]> {
  return (await rpc<AdminSession[] | null>('admin_get_class_sessions', { p_class_id: classId })) ?? []
}

export async function getAllTransfers(): Promise<AdminTransfer[]> {
  return (await rpc<AdminTransfer[] | null>('admin_get_all_transfers')) ?? []
}

export async function getAdminLogs(limit = 200): Promise<AdminLog[]> {
  return (await rpc<AdminLog[] | null>('admin_get_logs', { p_limit: limit })) ?? []
}

// ─── Write ────────────────────────────────────────────────────

export async function adminChangeRole(
  classId:  string,
  memberId: string,
  newRole:  'CR' | 'LR' | 'STUDENT'
): Promise<void> {
  return rpc('change_class_role', { p_class_id: classId, p_member_id: memberId, p_new_role: newRole })
}

export async function adminUpdateClass(
  classId: string, branch: string, year: number, semester: number, section: string
): Promise<void> {
  return rpc('update_class', { p_class_id: classId, p_branch: branch, p_year: year, p_semester: semester, p_section: section })
}

export async function adminDeleteClass(classId: string): Promise<void> {
  return rpc('admin_delete_class', { p_class_id: classId })
}

export async function adminDeleteMember(memberId: string): Promise<void> {
  return rpc('admin_delete_member', { p_member_id: memberId })
}

export async function adminApproveTransfer(transferId: string): Promise<void> {
  return rpc('approve_role_transfer', { p_transfer_id: transferId })
}

export async function adminEditAttendance(
  sessionId: string, memberId: string, status: 'present' | 'absent'
): Promise<void> {
  return rpc('edit_attendance_record', { p_session_id: sessionId, p_member_id: memberId, p_status: status })
}

export async function adminDeleteSession(sessionId: string): Promise<void> {
  return rpc('delete_attendance_session', { p_session_id: sessionId })
}

export async function adminRetrySync(syncId: string): Promise<void> {
  return rpc('retry_sync', { p_sync_id: syncId })
}