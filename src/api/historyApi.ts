import { supabase } from './supabase'

export interface SessionSummary {
    id: string
    date_selected: string
    batch_name: string | null
    taken_at: string
    is_edited: boolean
    edited_at: string | null
    present_count: number
    absent_count: number
    total_count: number
    subject: {
        id: string
        name: string
        faculty_name: string
        type: 'CLASS' | 'LAB'
    }
}

export async function getSessionHistory(
    classId: string,
    currentSemesterLabel?: string,
): Promise<SessionSummary[]> {
    let q = supabase
        .from('attendance_sessions')
        .select(`
      id, date_selected, batch_name, taken_at, is_edited, edited_at,
      subjects ( id, name, faculty_name, type ),
      attendance_records ( id, status )
    `)
        .eq('class_id', classId)
        .order('date_selected', { ascending: false })

    // When passed, restrict to the active semester — archived sessions are hidden.
    if (currentSemesterLabel) q = q.eq('semester_label', currentSemesterLabel)

    const { data, error } = await q

    if (error) throw error

    return (data ?? []).map((s: any) => {
        const records = s.attendance_records ?? []
        const present = records.filter((r: any) => r.status === 'present').length
        const total = records.length
        return {
            id: s.id,
            date_selected: s.date_selected,
            batch_name: s.batch_name,
            taken_at: s.taken_at,
            is_edited: s.is_edited ?? false,
            edited_at: s.edited_at ?? null,
            present_count: present,
            absent_count: total - present,
            total_count: total,
            subject: s.subjects,
        }
    })
}

export async function getSessionDetail(sessionId: string) {
    const { data, error } = await supabase
        .from('attendance_records')
        .select(`
      id, status,
      class_members ( id, roll_number, name )
    `)
        .eq('session_id', sessionId)

    if (error) throw error
    return data ?? []
}

export async function deleteSession(sessionId: string) {
    // Records cascade delete automatically if FK is set
    const { error } = await supabase
        .from('attendance_sessions')
        .delete()
        .eq('id', sessionId)

    if (error) throw error
}

export async function saveEditedSession(
    sessionId: string,
    records: { classMemberId: string; status: 'present' | 'absent' }[]
) {
    // Single transactional RPC: marks session as edited, deletes old records,
    // inserts new ones — atomically. Prevents the data-loss window where the
    // delete succeeded but the insert failed (which left a session with zero records).
    const { error } = await supabase.rpc('save_edited_session', {
        p_session_id: sessionId,
        p_records: records.map((r) => ({
            class_member_id: r.classMemberId,
            status: r.status,
        })),
    })
    if (error) throw error
}