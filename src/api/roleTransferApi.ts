import { supabase } from './supabase'

export type RoleTransfer = {
  id:           string
  class_id:     string
  from_user_id: string
  to_user_id:   string
  role:         'CR' | 'LR'
  status:       'pending' | 'accepted' | 'rejected'
  requested_at: string      // actual column name in DB
  accepted_at:  string | null  // actual column name in DB
}

/** CR/LR calls this to initiate a role transfer to a class member */
export async function initiateRoleTransfer({
  classId,
  fromUserId,
  toUserId,
  role,
}: {
  classId:    string
  fromUserId: string
  toUserId:   string
  role:       'CR' | 'LR'
}): Promise<void> {
  const { error } = await supabase.from('role_transfers').insert({
    class_id:     classId,
    from_user_id: fromUserId,
    to_user_id:   toUserId,
    role,
    status: 'pending',
  })
  if (error) throw error
}

/** Check if current user has a pending incoming transfer */
export async function getPendingTransferForUser(
  userId: string
): Promise<RoleTransfer | null> {
  const { data, error } = await supabase
    .from('role_transfers')
    .select('*')
    .eq('to_user_id', userId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })  // ← correct column
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

/** Accept transfer — promotes new user, demotes old one in class_members only */
export async function acceptRoleTransfer(transfer: RoleTransfer): Promise<void> {
  const { id, class_id, from_user_id, to_user_id, role } = transfer

  // 1. Demote previous holder to STUDENT
  const { error: demoteError } = await supabase
    .from('class_members')
    .update({ role: 'STUDENT' })
    .eq('class_id', class_id)
    .eq('user_id', from_user_id)

  if (demoteError) throw demoteError

  // 2. Promote new holder
  const { error: promoteError } = await supabase
    .from('class_members')
    .update({ role })
    .eq('class_id', class_id)
    .eq('user_id', to_user_id)

  if (promoteError) throw promoteError

  // 3. Mark accepted — use accepted_at (actual column name)
  const { error } = await supabase
    .from('role_transfers')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

/** Reject transfer — no role changes */
export async function rejectRoleTransfer(transferId: string): Promise<void> {
  const { error } = await supabase
    .from('role_transfers')
    .update({ status: 'rejected', accepted_at: new Date().toISOString() })
    .eq('id', transferId)

  if (error) throw error
}