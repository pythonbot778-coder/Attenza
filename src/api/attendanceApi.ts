import { supabase } from './supabase'
import { isRollInRange } from '../utils/rollNumberUtils'

export interface ClassMember {
    id: string
    roll_number: string
    name: string | null
}

export interface SaveAttendancePayload {
    subjectId: string
    classId: string
    batchName: string | null
    dateSelected: string
    takenBy: string
    records: { classMemberId: string; status: 'present' | 'absent' }[]
}

export async function getMembersForClass(classId: string): Promise<ClassMember[]> {
    const { data, error } = await supabase
        .from('class_members')
        .select('id, roll_number, name')
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('roll_number', { ascending: true })

    if (error) throw error
    return data ?? []
}

export async function getMembersForBatch(
    classId: string,
    startRoll: string,
    endRoll: string
): Promise<ClassMember[]> {
    const all = await getMembersForClass(classId)
    return all.filter((m) => isRollInRange(m.roll_number, startRoll, endRoll))
}

export async function saveAttendanceSession(payload: SaveAttendancePayload) {
    const { subjectId, classId, batchName = null, dateSelected, takenBy, records } = payload

    const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .upsert(
            {
                subject_id: subjectId,
                class_id: classId,
                batch_name: batchName,
                date_selected: dateSelected,
                taken_by: takenBy,
                taken_at: new Date().toISOString(),
            },
            { onConflict: 'class_id,subject_id,date_selected,batch_name' }
        )
        .select('id, taken_at')
        .single()

    if (sessionError) throw sessionError

    // Delete existing records for this session (re-save flow)
    await supabase
        .from('attendance_records')
        .delete()
        .eq('session_id', session.id)

    // Insert fresh records
    const rows = records.map((r) => ({
        session_id: session.id,
        class_member_id: r.classMemberId,
        status: r.status,
    }))

    const { error: recError } = await supabase
        .from('attendance_records')
        .insert(rows)

    if (recError) throw recError
    return session
}

export async function getAttendanceHistory(classId: string) {
    const { data, error } = await supabase
        .from('attendance_sessions')
        .select(`
      id, date_selected, batch_name,
      subjects ( id, name, faculty_name, type ),
      attendance_records ( id, status, class_member_id,
        class_members ( roll_number, name )
      )
    `)
        .eq('class_id', classId)
        .order('date_selected', { ascending: false })

    if (error) throw error
    return data ?? []
}