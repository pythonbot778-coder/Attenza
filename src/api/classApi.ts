import { supabase } from './supabase'
import { generateRollRange } from '../utils/rollNumberUtils'

export interface CreateClassPayload {
  userId:    string
  branch:    string
  year:      number
  semester:  number
  section:   string
  startRoll: string
  endRoll:   string
  role:      'CR' | 'LR'
  userName:  string
  userRoll:  string
}

export async function createClassWithMembers(payload: CreateClassPayload) {
  const {
    userId, branch, year, semester, section,
    startRoll, endRoll, role, userName, userRoll,
  } = payload

  // Step 1 — Check if ClassGroup already exists
  const { data: existing } = await supabase
    .from('class_groups')
    .select('id, start_roll, end_roll')
    .eq('branch',   branch)
    .eq('year',     year)
    .eq('semester', semester)
    .eq('section',  section)
    .maybeSingle()

  let classId: string

  if (existing) {
    classId = existing.id

    // Block if CR already claimed and this user is also trying CR
    if (role === 'CR') {
      const { data: existingCR } = await supabase
        .from('class_members')
        .select('id')
        .eq('class_id', classId)
        .eq('role', 'CR')
        .not('user_id', 'is', null)
        .maybeSingle()

      if (existingCR) {
        return {
          error: 'CR_EXISTS',
          classId,
          message: 'A CR already exists for this class.',
        }
      }
    }
  } else {
    // Step 2 — Create ClassGroup
    const { data: newClass, error: classError } = await supabase
      .from('class_groups')
      .insert({
        branch, year, semester, section,
        start_roll: startRoll,
        end_roll:   endRoll,
        created_by: userId,
      })
      .select('id')
      .single()

    if (classError) throw classError
    classId = newClass.id

    // Step 3 — Bulk insert all ClassMembers as STUDENT with user_id = null
    const rolls   = generateRollRange(startRoll, endRoll)
    const members = rolls.map((roll) => ({
      class_id:    classId,
      roll_number: roll,
      name:        null,
      role:        'STUDENT',
      status:      'active',
      user_id:     null,
    }))

    const { error: membersError } = await supabase
      .from('class_members')
      .insert(members)

    if (membersError) throw membersError
  }

  // Step 4 — Claim the CR/LR's own row by roll number
  // First try to update the existing unclaimed row
  const { data: memberRow, error: fetchError } = await supabase
    .from('class_members')
    .select('id')
    .eq('class_id',    classId)
    .eq('roll_number', userRoll)
    .maybeSingle()

  if (fetchError) throw fetchError

  if (memberRow) {
    // Row exists — update it to claim as CR/LR
    const { error: updateError } = await supabase
      .from('class_members')
      .update({
        user_id: userId,
        name:    userName,
        role:    role,
        status:  'active',
      })
      .eq('id', memberRow.id)

    if (updateError) throw updateError
  } else {
    // Roll number was not in the range — insert a new CR/LR row
    const { error: insertError } = await supabase
      .from('class_members')
      .insert({
        class_id:    classId,
        roll_number: userRoll,
        user_id:     userId,
        name:        userName,
        role:        role,
        status:      'active',
      })

    if (insertError) throw insertError
  }

  return { error: null, classId, message: 'success' }
}

export async function getClassByUser(userId: string) {
  const { data, error } = await supabase
    .from('class_members')
    .select(`
      id,
      role,
      class_id,
      roll_number,
      class_groups (
        id, branch, year, semester, section, start_roll, end_roll
      )
    `)
    .eq('user_id', userId)
    .eq('status',  'active')
    .maybeSingle()

  if (error) throw error
  return data
}