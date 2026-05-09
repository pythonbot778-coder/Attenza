import { supabase } from './supabase'

type Role = 'STUDENT' | 'CR' | 'LR'

export interface UserProfile {
  id: string
  name: string | null
  email: string | null
  role: Role
  mobile_number?: string | null
  avatar_url?: string | null
}

export async function ensureUserProfile(profile: UserProfile) {
  const { error } = await supabase
    .from('users')
    .upsert(
      {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        mobile_number: profile.mobile_number ?? null,
        avatar_url: profile.avatar_url ?? null,
      },
      { onConflict: 'id' }
    )

  if (error && error.code !== '23505') throw error
}