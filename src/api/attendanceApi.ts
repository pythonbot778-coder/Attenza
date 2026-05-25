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
    semesterLabel: string  // "Y1S1" — stamps which semester this session belongs to
    records: { classMemberId: string; status: 'present' | 'absent' }[]
}

/** Build the canonical semester label used to tag attendance sessions. */
export function semesterLabel(year: number, semester: number): string {
    return `Y${year}S${semester}`
}

export async function getMembersForClass(classId: string): Promise<ClassMember[]> {
    const { data, error } = await supabase
        .from('class_members')
        .select('id, roll_number, name')
        .eq('class_id', classId)
        .in('status', ['active', 'inactive'])  // ✅ include placeholder students
        .order('roll_number', { ascending: true })

    if (error) throw error
    return data ?? []
}

export async function getMembersForBatch(
    classId: string,
    batchId: string | null,
    startRoll: string,
    endRoll: string
): Promise<ClassMember[]> {
    const all = await getMembersForClass(classId)

    // Range-based members
    const inRange = all.filter((m) => isRollInRange(m.roll_number, startRoll, endRoll))

    // No batch id (legacy callers) — return range-only result
    if (!batchId) return inRange

    // Manual additions (members assigned to this batch outside the range)
    const { data: manual, error } = await supabase
        .from('lab_batch_members')
        .select('class_member_id')
        .eq('lab_batch_id', batchId)
    if (error) throw error

    const manualIds = new Set((manual ?? []).map((r: any) => r.class_member_id as string))
    if (manualIds.size === 0) return inRange

    // Union: range members + manual members (de-duplicated)
    const seen = new Set(inRange.map((m) => m.id))
    const extras = all.filter((m) => manualIds.has(m.id) && !seen.has(m.id))
    return [...inRange, ...extras].sort((a, b) =>
        a.roll_number.localeCompare(b.roll_number)
    )
}

export async function saveAttendanceSession(payload: SaveAttendancePayload) {
    const { subjectId, classId, batchName = null, dateSelected, takenBy, semesterLabel: semLabel, records } = payload

    const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .upsert(
            {
                subject_id:     subjectId,
                class_id:       classId,
                batch_name:     batchName,
                date_selected:  dateSelected,
                taken_by:       takenBy,
                taken_at:       new Date().toISOString(),
                semester_label: semLabel,
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
        session_id:      session.id,
        class_member_id: r.classMemberId,
        status:          r.status,
    }))

    const { error: recError } = await supabase
        .from('attendance_records')
        .insert(rows)

    if (recError) throw recError
    return session
}

export async function getAttendanceHistory(classId: string, currentSemesterLabel?: string) {
    let q = supabase
        .from('attendance_sessions')
        .select(`
            id, date_selected, batch_name, semester_label,
            subjects ( id, name, faculty_name, type ),
            attendance_records ( id, status, class_member_id,
                class_members ( roll_number, name )
            )
        `)
        .eq('class_id', classId)
        .order('date_selected', { ascending: false })

    // When a semester label is provided, restrict to that semester (archived rows hidden).
    if (currentSemesterLabel) {
        q = q.eq('semester_label', currentSemesterLabel)
    }

    const { data, error } = await q
    if (error) throw error
    return data ?? []
}

/** Lists distinct semester labels that have attendance for the class, sorted oldest → newest. */
export async function getArchivedSemesters(classId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('attendance_sessions')
        .select('semester_label')
        .eq('class_id', classId)
        .not('semester_label', 'is', null)

    if (error) throw error
    const labels = new Set<string>()
    ;(data ?? []).forEach((r: any) => {
        if (r.semester_label) labels.add(r.semester_label)
    })
    // Sort by Y then S
    return Array.from(labels).sort((a, b) => {
        const ay = parseInt(a.match(/Y(\d+)/)?.[1] ?? '0', 10)
        const by = parseInt(b.match(/Y(\d+)/)?.[1] ?? '0', 10)
        if (ay !== by) return ay - by
        const as = parseInt(a.match(/S(\d+)/)?.[1] ?? '0', 10)
        const bs = parseInt(b.match(/S(\d+)/)?.[1] ?? '0', 10)
        return as - bs
    })
}

export interface SemesterCsvSubject {
    id: string
    name: string
    faculty_name: string
    type: 'CLASS' | 'LAB'
}

export interface SemesterCsvSessionRow {
    id: string
    date_selected: string
    subject_id: string
    batch_name: string | null
    records: { class_member_id: string; status: 'present' | 'absent' }[]
}

export interface SemesterCsvData {
    members: { id: string; roll_number: string; name: string | null }[]
    subjects: SemesterCsvSubject[]
    sessions: SemesterCsvSessionRow[]
}

/**
 * Fetch all data needed to build a semester CSV: members, subjects, and every
 * attendance session + record stamped with the given semester_label.
 */
export async function getSemesterCsvData(
    classId: string,
    semLabel: string,
): Promise<SemesterCsvData> {
    const [membersRes, subjectsRes, sessionsRes] = await Promise.all([
        supabase
            .from('class_members')
            .select('id, roll_number, name')
            .eq('class_id', classId)
            .in('status', ['active', 'inactive'])
            .order('roll_number', { ascending: true }),
        supabase
            .from('subjects')
            .select('id, name, faculty_name, type')
            .eq('class_id', classId)
            .order('name', { ascending: true }),
        supabase
            .from('attendance_sessions')
            .select(`
                id, date_selected, subject_id, batch_name,
                attendance_records ( class_member_id, status )
            `)
            .eq('class_id', classId)
            .eq('semester_label', semLabel)
            .order('date_selected', { ascending: true }),
    ])

    if (membersRes.error) throw membersRes.error
    if (subjectsRes.error) throw subjectsRes.error
    if (sessionsRes.error) throw sessionsRes.error

    const sessions: SemesterCsvSessionRow[] = (sessionsRes.data ?? []).map((s: any) => ({
        id: s.id,
        date_selected: s.date_selected,
        subject_id: s.subject_id,
        batch_name: s.batch_name ?? null,
        records: (s.attendance_records ?? []).map((r: any) => ({
            class_member_id: r.class_member_id,
            status: r.status,
        })),
    }))

    return {
        members: membersRes.data ?? [],
        subjects: subjectsRes.data ?? [],
        sessions,
    }
}