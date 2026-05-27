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
    manualMemberIds?: string[]
  }[]
}

export interface AddLabBatchMembersResult {
  added: number
  skipped_already_in_batch: number
  skipped_other_batch: number
  other_batch_conflicts: string[]
  skipped_wrong_class: number
}

export interface CreateSubjectResult {
  id: string
  /** Per-batch outcome of the manual member attachment step. Empty when type=CLASS. */
  manualAddIssues: { batchName: string; error: string }[]
}

export async function createSubject(payload: CreateSubjectPayload): Promise<CreateSubjectResult> {
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

  const manualAddIssues: { batchName: string; error: string }[] = []

  // Insert lab batches if LAB type
  if (type === 'LAB' && batches && batches.length > 0) {
    const batchRows = batches.map((b) => ({
      subject_id: subject.id,
      batch_name: b.batchName,
      start_roll: b.startRoll.trim().toUpperCase(),
      end_roll:   b.endRoll.trim().toUpperCase(),
    }))

    const { data: insertedBatches, error: batchError } = await supabase
      .from('lab_batches')
      .insert(batchRows)
      .select('id, batch_name')

    if (batchError) throw batchError

    // Attach manual members to each batch — best-effort, but report failures so
    // the caller can surface them instead of pretending everything succeeded.
    if (insertedBatches) {
      for (let i = 0; i < batches.length; i++) {
        const manualIds = batches[i].manualMemberIds ?? []
        if (manualIds.length === 0) continue
        const matchedBatch = insertedBatches.find(
          (b: any) => b.batch_name === batches[i].batchName
        )
        if (!matchedBatch) {
          manualAddIssues.push({ batchName: batches[i].batchName, error: 'Batch row not found after insert' })
          continue
        }
        try {
          await addLabBatchMembers(matchedBatch.id, manualIds)
        } catch (e: any) {
          // Subject + batches are saved; the caller decides whether to alert.
          manualAddIssues.push({
            batchName: batches[i].batchName,
            error: e?.message ?? 'Could not attach manual members',
          })
        }
      }
    }
  }

  return { id: subject.id, manualAddIssues }
}

export async function getLabBatchManualMembers(batchId: string) {
  const { data, error } = await supabase
    .from('lab_batch_members')
    .select('class_member_id, class_members(id, roll_number, name, status)')
    .eq('lab_batch_id', batchId)

  if (error) throw error
  return data ?? []
}

export async function addLabBatchMembers(
  batchId: string,
  classMemberIds: string[]
): Promise<AddLabBatchMembersResult> {
  const { data, error } = await supabase.rpc('add_lab_batch_members', {
    p_lab_batch_id: batchId,
    p_class_member_ids: classMemberIds,
  })
  if (error) throw error
  return data as AddLabBatchMembersResult
}

export async function removeLabBatchMember(
  batchId: string,
  classMemberId: string
): Promise<void> {
  const { error } = await supabase.rpc('remove_lab_batch_member', {
    p_lab_batch_id: batchId,
    p_class_member_id: classMemberId,
  })
  if (error) throw error
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