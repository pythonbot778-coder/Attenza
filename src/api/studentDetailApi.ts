import { supabase } from './supabase'

export interface StudentSubjectSession {
  id: string
  date_selected: string
  batch_name: string | null
  status: 'present' | 'absent'
  is_edited: boolean
}

function rollToNum(roll: string): number {
  const n = parseInt((roll ?? '').replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : -1
}

export async function getStudentSubjectSessions(
  userId: string,
  subjectId: string
): Promise<StudentSubjectSession[]> {
  const { data: member, error: memberError } = await supabase
    .from('class_members')
    .select('id, class_id, roll_number')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (memberError) throw memberError
  if (!member) throw new Error('Member not found')

  const { data: subject, error: subjectError } = await supabase
    .from('subjects')
    .select('id, type')
    .eq('id', subjectId)
    .maybeSingle()

  if (subjectError) throw subjectError
  if (!subject) throw new Error('Subject not found')

  let myBatchName: string | null = null

  if (subject.type === 'LAB') {
    if (!member.roll_number) throw new Error('Roll number not found for student')

    const { data: labBatches, error: batchError } = await supabase
      .from('lab_batches')
      .select('id, subject_id, batch_name, start_roll, end_roll')
      .eq('subject_id', subjectId)

    if (batchError) throw batchError

    const batches = labBatches ?? []
    const batchIds = batches.map((b: any) => b.id)

    // Manual membership for THIS subject's batches
    let manualBatchId: string | null = null
    if (batchIds.length > 0) {
      const { data: manual, error: manualError } = await supabase
        .from('lab_batch_members')
        .select('lab_batch_id')
        .eq('class_member_id', member.id)
        .in('lab_batch_id', batchIds)
        .maybeSingle()
      if (manualError) throw manualError
      manualBatchId = (manual as any)?.lab_batch_id ?? null
    }

    if (manualBatchId) {
      const manualBatch = batches.find((b: any) => b.id === manualBatchId)
      myBatchName = manualBatch?.batch_name ?? null
    } else {
      const myRollNum = rollToNum(member.roll_number)
      const myBatch = batches.find((b: any) => {
        const start = rollToNum(b.start_roll)
        const end = rollToNum(b.end_roll)
        return myRollNum >= start && myRollNum <= end
      })
      myBatchName = myBatch?.batch_name ?? null
    }
  }

  // Current semester label of the class — keep archived sessions out of student views
  const { data: cg } = await supabase
    .from('class_groups')
    .select('year, semester')
    .eq('id', member.class_id)
    .maybeSingle()
  const currentSemLabel = cg ? `Y${cg.year}S${cg.semester}` : null

  let sessionsQuery = supabase
    .from('attendance_sessions')
    .select(`
      id,
      date_selected,
      batch_name,
      is_edited,
      attendance_records ( status, class_member_id )
    `)
    .eq('class_id', member.class_id)
    .eq('subject_id', subjectId)
    .order('date_selected', { ascending: false })

  if (currentSemLabel) {
    sessionsQuery = sessionsQuery.eq('semester_label', currentSemLabel)
  }

  const { data, error } = await sessionsQuery

  if (error) throw error

  const filteredSessions = (data ?? []).filter((s: any) => {
    if (subject.type !== 'LAB') return true
    return s.batch_name === myBatchName
  })

  return filteredSessions
    .map((s: any) => {
      const myRecord = (s.attendance_records ?? []).find(
        (r: any) => r.class_member_id === member.id
      )

      if (!myRecord) return null

      return {
        id: s.id,
        date_selected: s.date_selected,
        batch_name: s.batch_name,
        status: myRecord.status as 'present' | 'absent',
        is_edited: s.is_edited ?? false,
      }
    })
    .filter(Boolean) as StudentSubjectSession[]
}