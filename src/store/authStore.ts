import { create } from 'zustand'
import { supabase } from '../api/supabase'
import { ensureUserProfile } from '../api/profile'

type Role = 'STUDENT' | 'CR' | 'LR' | null

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
  classNotSetUp: boolean     // student logged in but class doesn't exist yet
  setUser: (u: Partial<AuthState>) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
  name: null,
  role: null,
  branch: null,
  year: null,
  semester: null,
  section: null,
  classId: null,
  rollNumber: null,
  mobileNumber: null,
  isAuthenticated: false,
  isLoading: true,
  classNotSetUp: false,
  setUser: (u) => set((s) => ({ ...s, ...u })),
  reset: () =>
    set({
      userId: null,
      email: null,
      name: null,
      role: null,
      branch: null,
      year: null,
      semester: null,
      section: null,
      classId: null,
      rollNumber: null,
      mobileNumber: null,
      isAuthenticated: false,
      isLoading: false,
      classNotSetUp: false,
    }),
}))

export async function hydrateAuthState() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    useAuthStore.getState().reset()
    return
  }

  const userId = session.user.id
  const email = session.user.email ?? null

  let userRow: any = null
  let member: any = null

  try {
    const res = await supabase
      .from('users')
      .select('name, role, mobile_number')
      .eq('id', userId)
      .maybeSingle()
    userRow = res.data ?? null
  } catch (e) {
    console.log('users load failed', e)
  }

  try {
    const res = await supabase
      .from('class_members')
      .select('class_id, roll_number, role, class_groups(branch, year, semester, section)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    member = res.data ?? null
  } catch (e) {
    console.log('class_members load failed', e)
  }

  const cg = member?.class_groups as any

  // class_members.role is source of truth, users.role is fallback
  const resolvedRole = (member?.role ?? userRow?.role ?? 'STUDENT') as Role

  // classNotSetUp: student has a profile but no class_members row yet
  const classNotSetUp = resolvedRole === 'STUDENT' && !member

  const payload = {
    userId,
    email,
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

  try {
    await ensureUserProfile({
      id: userId,
      name: payload.name,
      email,
      role: resolvedRole ?? 'STUDENT',
    })
  } catch (e) {
    console.log('ensureUserProfile failed', e)
  }
}