import { supabase } from './supabase'

type Role = 'STUDENT' | 'CR' | 'LR'

export interface UserProfile {
  id: string
  name: string | null
  email: string | null
  role: Role
  mobile_number?: string | null
}

export async function ensureUserProfile(profile: UserProfile) {
  const { error } = await supabase
    .from('users')
    .upsert(
      {
        id:            profile.id,
        name:          profile.name,
        email:         profile.email,
        mobile_number: profile.mobile_number ?? null,
      },
      { onConflict: 'id' }  // conflict on primary key only
    )

  // Silently ignore any remaining duplicate — user already exists
  if (error && error.code !== '23505') throw error
}