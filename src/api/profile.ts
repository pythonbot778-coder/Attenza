import { supabase } from './supabase'

type Role = 'STUDENT' | 'CR' | 'LR'

export interface UserProfile {
  id: string
  name: string | null
  email: string | null
  role: Role
}

export async function ensureUserProfile(profile: UserProfile) {
  const { error } = await supabase
    .from('users')
    .upsert(
      {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
      },
      { onConflict: 'id' }
    )

  if (error) throw error
}