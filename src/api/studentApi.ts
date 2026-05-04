import { supabase } from './supabase'

export interface StudentSubjectRow {
  subject_id:        string
  subject_name:      string
  faculty_name:      string
  subject_type:      'CLASS' | 'LAB'
  sessions_total:    number
  present_count:     number
  absent_count:      number
  percent:           number
  last_session_date: string | null
}

export interface StudentDashboardData {
  combinedPercent: number
  totalPresent:    number
  totalAbsent:     number
  totalSessions:   number
  subjects:        StudentSubjectRow[]
}

function calcPct(present: number, total: number): number {
  return total > 0 ? Math.round((present / total) * 100) : 0
}

export async function getStudentDashboard(userId: string): Promise<StudentDashboardData> {
  // Get the member's class
  const { data: member, error: memberError } = await supabase
    .from('class_members')
    .select('id, class_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (memberError) throw memberError
  if (!member?.class_id) throw new Error('No active class found')

  // Get all subjects in this class
  const { data: subjects, error: subjectError } = await supabase
    .from('subjects')
    .select('id, name, faculty_name, type')
    .eq('class_id', member.class_id)
    .order('created_at', { ascending: true })

  if (subjectError) throw subjectError

  // Get all sessions + this member's records
  const { data: sessions, error: sessionsError } = await supabase
    .from('attendance_sessions')
    .select(`
      id, subject_id, date_selected,
      attendance_records ( status, class_member_id )
    `)
    .eq('class_id', member.class_id)

  if (sessionsError) throw sessionsError

  const subjectsList = subjects ?? []
  const sessionsList = sessions ?? []

  const subjectStats: StudentSubjectRow[] = subjectsList.map((s: any) => {
    const relatedSessions = sessionsList.filter((se: any) => se.subject_id === s.id)
    let present = 0
    let total   = 0
    let lastDate: string | null = null

    relatedSessions.forEach((se: any) => {
      if (!lastDate || se.date_selected > lastDate) lastDate = se.date_selected
      const myRecord = (se.attendance_records ?? []).find(
        (r: any) => r.class_member_id === member.id
      )
      if (myRecord) {
        total++
        if (myRecord.status === 'present') present++
      }
    })

    return {
      subject_id:        s.id,
      subject_name:      s.name,
      faculty_name:      s.faculty_name,
      subject_type:      s.type,
      sessions_total:    relatedSessions.length,
      present_count:     present,
      absent_count:      total - present,
      percent:           calcPct(present, total),
      last_session_date: lastDate,
    }
  })

  const totalPresent = subjectStats.reduce((sum, s) => sum + s.present_count, 0)
  const totalAbsent  = subjectStats.reduce((sum, s) => sum + s.absent_count, 0)

  return {
    combinedPercent: calcPct(totalPresent, totalPresent + totalAbsent),
    totalPresent,
    totalAbsent,
    totalSessions:   sessionsList.length,
    subjects:        subjectStats,
  }
}