import { supabase } from './supabase'

export interface SubjectStats {
  totalSessions:   number
  totalPresent:    number
  totalAbsent:     number
  totalStrength:   number
  avgAttendance:   number
  sessions: {
    id:            string
    date_selected: string
    batch_name:    string | null
    present:       number
    absent:        number
    total:         number
    percent:       number
    is_edited:     boolean
  }[]
  studentStats: {
    roll_number:   string
    name:          string | null
    presentCount:  number
    absentCount:   number
    totalSessions: number
    percent:       number
  }[]
}

export async function getSubjectStats(
  subjectId: string,
  batchName?: string | null,
  currentSemesterLabel?: string,
): Promise<SubjectStats> {
  let query = supabase
    .from('attendance_sessions')
    .select(`
      id, date_selected, batch_name, is_edited,
      attendance_records (
        id, status,
        class_members ( id, roll_number, name )
      )
    `)
    .eq('subject_id', subjectId)
    .order('date_selected', { ascending: true })

  if (batchName) query = query.eq('batch_name', batchName)
  // Restrict to the active semester so archived data doesn't inflate stats.
  if (currentSemesterLabel) query = query.eq('semester_label', currentSemesterLabel)

  const { data, error } = await query
  if (error) throw error

  const sessions = (data ?? []).map((s: any) => {
    const records = s.attendance_records ?? []
    const present = records.filter((r: any) => r.status === 'present').length
    const total   = records.length
    return {
      id:            s.id,
      date_selected: s.date_selected,
      batch_name:    s.batch_name,
      present,
      absent:        total - present,
      total,
      percent:       total > 0 ? Math.round((present / total) * 100) : 0,
      is_edited:     s.is_edited ?? false,
      records,
    }
  })

  // Per-student aggregation — only counts records from sessions that were fetched
  // (already batch-filtered above), so students outside this batch are never included
  const studentMap: Record<string, {
    roll_number: string
    name: string | null
    present: number
    absent:  number
    total:   number
  }> = {}

  sessions.forEach((s) => {
    s.records.forEach((r: any) => {
      const m  = r.class_members
      const id = m.roll_number
      if (!studentMap[id]) {
        studentMap[id] = { roll_number: id, name: m.name, present: 0, absent: 0, total: 0 }
      }
      studentMap[id].total++
      if (r.status === 'present') studentMap[id].present++
      else studentMap[id].absent++
    })
  })

  const studentStats = Object.values(studentMap)
    .map((s) => ({
      ...s,
      presentCount:  s.present,
      absentCount:   s.absent,
      totalSessions: s.total,
      percent:       s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
    }))
    .sort((a, b) => a.roll_number.localeCompare(b.roll_number))

  const totalPresent  = sessions.reduce((sum, s) => sum + s.present, 0)
  const totalAll      = sessions.reduce((sum, s) => sum + s.total, 0)

  // ✅ Fix: use max total across sessions (not just first session)
  const totalStrength = sessions.length > 0
    ? Math.max(...sessions.map(s => s.total))
    : 0

  return {
    totalSessions:  sessions.length,
    totalPresent,
    totalAbsent:    totalAll - totalPresent,
    totalStrength,
    avgAttendance:  totalAll > 0 ? Math.round((totalPresent / totalAll) * 100) : 0,
    sessions:       sessions.map(({ records: _, ...rest }) => rest),
    studentStats,
  }
}