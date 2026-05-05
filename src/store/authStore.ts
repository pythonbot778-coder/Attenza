import { create } from 'zustand'
import { supabase } from '../api/supabase'
import { ensureUserProfile } from '../api/profile'

type Role = 'STUDENT' | 'CR' | 'LR' | 'admin' | null

type AuthState = {
  userId: string | null
  email: string | null
  name: string | null
  role: Role
  branch: string | null
  year: string | null
  semester: string | null
  section: string | null
  classId: string | null
  rollNumber: string | null
  mobileNumber: string | null
  isAuthenticated: boolean
  isLoading: boolean
  classNotSetUp: boolean
  setUser: (u: Partial<AuthState>) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null, email: null, name: null, role: null,
  branch: null, year: null, semester: null, section: null,
  classId: null, rollNumber: null, mobileNumber: null,
  isAuthenticated: false, isLoading: true, classNotSetUp: false,
  setUser: (u) => set((s) => ({ ...s, ...u })),
  reset: () => set({
    userId: null, email: null, name: null, role: null,
    branch: null, year: null, semester: null, section: null,
    classId: null, rollNumber: null, mobileNumber: null,
    isAuthenticated: false, isLoading: false, classNotSetUp: false,
  }),
}))

export async function hydrateAuthState() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) { useAuthStore.getState().reset(); return }

  const userId = session.user.id
  const email = session.user.email ?? null
  let userRow: any = null
  let member: any = null

  try {
    const res = await supabase
      .from('users')
      .select('name, role_global, mobile_number')
      .eq('id', userId)
      .maybeSingle()
    userRow = res.data ?? null
  } catch (e) { console.log('users load failed', e) }

  // Admin check — skip class_members lookup for admins
  const isAdmin = userRow?.role_global === 'admin'

  if (!isAdmin) {
    try {
      const res = await supabase
        .from('class_members')
        .select('class_id, roll_number, role, class_groups(branch, year, semester, section)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      member = res.data ?? null
    } catch (e) { console.log('class_members load failed', e) }
  }

  const cg = member?.class_groups as any
  const resolvedRole: Role = isAdmin ? 'admin' : ((member?.role ?? 'STUDENT') as Role)
  const classNotSetUp = !isAdmin && resolvedRole === 'STUDENT' && !member

  const payload: Partial<AuthState> = {
    userId, email,
    name: userRow?.name ?? session.user.user_metadata?.name ?? null,
    role: resolvedRole,
    branch: cg?.branch ?? null,
    year: cg?.year ?? null,
    semester: cg?.semester ?? null,
    section: cg?.section ?? null,
    classId: member?.class_id ?? null,
    rollNumber: member?.roll_number ?? null,
    mobileNumber: userRow?.mobile_number ?? null,
    isAuthenticated: true,
    isLoading: false,
    classNotSetUp,
  }

  useAuthStore.getState().setUser(payload)

  if (!isAdmin) {
    try {
      await ensureUserProfile({ id: userId, name: payload.name ?? null, email, role: resolvedRole ?? 'STUDENT' })
    } catch (e) { console.log('ensureUserProfile failed', e) }
  }
}
