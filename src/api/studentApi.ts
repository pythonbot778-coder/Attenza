import { supabase } from './supabase'

export interface StudentSubjectRow {
  subject_id: string
  subject_name: string
  faculty_name: string
  subject_type: 'CLASS' | 'LAB'
  sessions_total: number
  present_count: number
  absent_count: number
  percent: number
  last_session_date: string | null
}

export interface StudentDashboardData {
  combinedPercent: number
  totalPresent: number
  totalAbsent: number
  totalSessions: number
  subjects: StudentSubjectRow[]
}

function calcPct(present: number, total: number): number {
  return total > 0 ? Math.round((present / total) * 100) : 0
}

function rollToNum(roll: string): number {
  const n = parseInt((roll ?? '').replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : -1
}

export async function getStudentDashboard(userId: string): Promise<StudentDashboardData> {
  const { data: member, error: memberError } = await supabase
    .from('class_members')
    .select('id, class_id, roll_number')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (memberError) throw memberError
  if (!member?.class_id) throw new Error('No active class found')
  if (!member?.roll_number) throw new Error('No roll number found for student')

  const { data: subjects, error: subjectError } = await supabase
    .from('subjects')
    .select('id, name, faculty_name, type')
    .eq('class_id', member.class_id)
    .order('created_at', { ascending: true })

  if (subjectError) throw subjectError

  const { data: labBatches, error: batchError } = await supabase
    .from('lab_batches')
    .select('id, subject_id, batch_name, start_roll, end_roll')

  if (batchError) throw batchError

  const { data: sessions, error: sessionsError } = await supabase
    .from('attendance_sessions')
    .select(`
      id,
      subject_id,
      date_selected,
      batch_name,
      attendance_records ( status, class_member_id )
    `)
    .eq('class_id', member.class_id)

  if (sessionsError) throw sessionsError

  const subjectsList = subjects ?? []
  const sessionsList = sessions ?? []
  const batchesList = labBatches ?? []
  const myRollNum = rollToNum(member.roll_number)

  function getStudentBatchName(subjectId: string): string | null {
    const batch = batchesList.find((b: any) => {
      if (b.subject_id !== subjectId) return false
      const start = rollToNum(b.start_roll)
      const end = rollToNum(b.end_roll)
      return myRollNum >= start && myRollNum <= end
    })
    return batch?.batch_name ?? null
  }

  const subjectStats: StudentSubjectRow[] = subjectsList.map((s: any) => {
    const isLab = s.type === 'LAB'
    const myBatchName = isLab ? getStudentBatchName(s.id) : null

    const relatedSessions = sessionsList.filter((se: any) => {
      if (se.subject_id !== s.id) return false
      if (!isLab) return true
      return se.batch_name === myBatchName
    })

    let present = 0
    let total = 0
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
      subject_id: s.id,
      subject_name: s.name,
      faculty_name: s.faculty_name,
      subject_type: s.type,
      sessions_total: relatedSessions.length,
      present_count: present,
      absent_count: total - present,
      percent: calcPct(present, total),
      last_session_date: lastDate,
    }
  })

  const totalPresent = subjectStats.reduce((sum, s) => sum + s.present_count, 0)
  const totalAbsent = subjectStats.reduce((sum, s) => sum + s.absent_count, 0)
  const totalSessions = subjectStats.reduce((sum, s) => sum + s.sessions_total, 0)

  return {
    combinedPercent: calcPct(totalPresent, totalPresent + totalAbsent),
    totalPresent,
    totalAbsent,
    totalSessions,
    subjects: subjectStats,
  }
}