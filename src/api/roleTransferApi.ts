import { supabase } from './supabase'

export type RoleTransfer = {
  id: string
  class_id: string
  from_user_id: string
  to_user_id: string
  role: 'CR' | 'LR'
  status: 'pending' | 'accepted' | 'rejected'
  requested_at: string
  accepted_at: string | null
}

export async function initiateRoleTransfer({
  classId,
  fromUserId,
  toUserId,
  role,
}: {
  classId: string
  fromUserId: string
  toUserId: string
  role: 'CR' | 'LR'
}): Promise<void> {
  const { error } = await supabase.from('role_transfers').insert({
    class_id: classId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    role,
    status: 'pending',
  })
  if (error) throw error
}

export async function getPendingTransferForUser(
  userId: string
): Promise<RoleTransfer | null> {
  const { data, error } = await supabase
    .from('role_transfers')
    .select('*')
    .eq('to_user_id', userId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function acceptRoleTransfer(transfer: RoleTransfer): Promise<void> {
  const { error } = await supabase.rpc('accept_role_transfer', {
    p_transfer_id: transfer.id,
  })
  if (error) throw error
}

export async function rejectRoleTransfer(transferId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_role_transfer', {
    p_transfer_id: transferId,
  })
  if (error) throw error
}