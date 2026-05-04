import { supabase } from './supabase'

export interface CreateSubjectPayload {
  classId:     string
  name:        string
  facultyName: string
  type:        'CLASS' | 'LAB'
  batches?: {
    batchName: string
    startRoll: string
    endRoll:   string
  }[]
}

export async function createSubject(payload: CreateSubjectPayload) {
  const { classId, name, facultyName, type, batches } = payload

  // Insert subject
  const { data: subject, error } = await supabase
    .from('subjects')
    .insert({
      class_id:     classId,
      name:         name.trim(),
      faculty_name: facultyName.trim(),
      type,
    })
    .select('id')
    .single()

  if (error) throw error

  // Insert lab batches if LAB type
  if (type === 'LAB' && batches && batches.length > 0) {
    const batchRows = batches.map((b) => ({
      subject_id: subject.id,
      batch_name: b.batchName,
      start_roll: b.startRoll.trim().toUpperCase(),
      end_roll:   b.endRoll.trim().toUpperCase(),
    }))

    const { error: batchError } = await supabase
      .from('lab_batches')
      .insert(batchRows)

    if (batchError) throw batchError
  }

  return subject
}

export async function getSubjectsByClass(classId: string) {
  const { data, error } = await supabase
    .from('subjects')
    .select(`
      id, name, faculty_name, type, created_at,
      lab_batches ( id, batch_name, start_roll, end_roll )
    `)
    .eq('class_id', classId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function deleteSubject(subjectId: string) {
  const { error } = await supabase
    .from('subjects')
    .delete()
    .eq('id', subjectId)

  if (error) throw error
}
export async function updateSubject(
  subjectId: string,
  name: string,
  facultyName: string
) {
  const { error } = await supabase
    .from('subjects')
    .update({ name: name.trim(), faculty_name: facultyName.trim() })
    .eq('id', subjectId)

  if (error) throw error
}