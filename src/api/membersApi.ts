import { supabase } from './supabase'

export interface ClassMemberRow {
  id:          string
  user_id:     string | null
  roll_number: string
  name:        string | null
  role:        'CR' | 'LR' | 'STUDENT'
  status:      'active' | 'inactive'
}

export async function getClassMembers(classId: string): Promise<ClassMemberRow[]> {
  const { data, error } = await supabase
    .from('class_members')
    .select('id, user_id, roll_number, name, role, status')
    .eq('class_id', classId)
    .order('roll_number', { ascending: true })

  if (error) throw error
  return (data ?? []) as ClassMemberRow[]
}