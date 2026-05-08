import { supabase } from './supabase'

export interface StudentSubjectSession {
  id:            string
  date_selected: string
  batch_name:    string | null
  status:        'present' | 'absent'
  is_edited:     boolean
}

export async function getStudentSubjectSessions(
  userId:    string,
  subjectId: string
): Promise<StudentSubjectSession[]> {
  // Step 1: resolve this user's class_member record
  const { data: member, error: memberError } = await supabase
    .from('class_members')
    .select('id, class_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (memberError) throw memberError
  if (!member)     throw new Error('Member not found')

  // Step 2: fetch sessions for this subject + this class
  // is_edited column now exists (added by ChatGPT migration)
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select(`
      id, date_selected, batch_name, is_edited,
      attendance_records ( status, class_member_id )
    `)
    .eq('class_id', member.class_id)
    .eq('subject_id', subjectId)
    .order('date_selected', { ascending: false })

  if (error) throw error

  return (data ?? []).map((s: any) => {
    const myRecord = (s.attendance_records ?? []).find(
      (r: any) => r.class_member_id === member.id
    )
    return {
      id:            s.id,
      date_selected: s.date_selected,
      batch_name:    s.batch_name,
      status:        (myRecord?.status ?? 'absent') as 'present' | 'absent',
      is_edited:     s.is_edited ?? false,
    }
  })
}