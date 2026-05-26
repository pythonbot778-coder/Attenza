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
  // Only active members — inactive rows are historical (e.g. removed students,
  // promotion archive) and shouldn't appear in CR/LR member lists or pickers.
  const { data, error } = await supabase
    .from('class_members')
    .select('id, user_id, roll_number, name, role, status')
    .eq('class_id', classId)
    .eq('status', 'active')
    .order('roll_number', { ascending: true })

  if (error) throw error
  return (data ?? []) as ClassMemberRow[]
}

export interface AddMembersResult {
  added: number
  skipped_same_class: number
  skipped_other_class: number
  other_class_conflicts: string[]
}

export async function addCustomClassMembers(
  classId: string,
  rollNumbers: string[]
): Promise<AddMembersResult> {
  const { data, error } = await supabase.rpc('add_custom_class_members', {
    p_class_id: classId,
    p_roll_numbers: rollNumbers,
  })
  if (error) throw error
  return data as AddMembersResult
}