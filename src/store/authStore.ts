import { create } from 'zustand'
import { supabase } from '../api/supabase'
import { ensureUserProfile } from '../api/profile'
import { logger } from '../utils/logger'

type Role = 'STUDENT' | 'CR' | 'LR' | 'admin' | null

export type AuthStep =
  | 'UNAUTHENTICATED'
  | 'OTP_VERIFIED'
  | 'PASSWORD_SET'
  | 'ONBOARDED'

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
  profileComplete: boolean
  authStep: AuthStep
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
  profileComplete: false,
  authStep: 'UNAUTHENTICATED',

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
      profileComplete: false,
      authStep: 'UNAUTHENTICATED',
    }),
}))

export async function hydrateAuthState() {
  try {
    logger.log(
      'hydrate start',
      useAuthStore.getState().isLoading,
      useAuthStore.getState().isAuthenticated
    )

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.user) {
      logger.log('hydrateAuthState: no valid session', sessionError)
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
        .select('name, role_global, mobile_number')
        .eq('id', userId)
        .maybeSingle()

      userRow = res.data ?? null
    } catch (e) {
      logger.log('users load failed', e)
    }

    const isAdmin = userRow?.role_global === 'admin'

    if (!isAdmin) {
      try {
        const { data: members, error } = await supabase
          .from('class_members')
          .select(
            'class_id, roll_number, role, class_groups(branch, year, semester, section)'
          )
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(2)

        if (error) throw error

        if ((members?.length ?? 0) > 1) {
          logger.log('Duplicate active class_members rows', members)
        }

        member = members?.[0] ?? null
      } catch (e) {
        logger.log('class_members load failed', e)
      }
    }

    const cg = member?.class_groups as any
const existing = useAuthStore.getState()
const profileComplete = !!userRow?.name

const resolvedRole: Role = isAdmin
  ? 'admin'
  : profileComplete
    ? ((member?.role ?? 'STUDENT') as Role)
    : null

const classNotSetUp =
  !isAdmin && profileComplete && resolvedRole === 'STUDENT' && !member

let authStep: AuthStep = 'OTP_VERIFIED'
if (profileComplete) authStep = 'ONBOARDED'

const payload: Partial<AuthState> = {
  userId,
  email,
  name: userRow?.name ?? session.user.user_metadata?.name ?? existing.name ?? null,
  role: resolvedRole,
  branch: cg?.branch ?? null,
  year: cg?.year ?? null,
  semester: cg?.semester ?? null,
  section: cg?.section ?? null,
  classId: member?.class_id ?? null,
  rollNumber: member?.roll_number ?? existing.rollNumber ?? null,
  mobileNumber: userRow?.mobile_number ?? existing.mobileNumber ?? null,
  isAuthenticated: true,
  isLoading: false,
  classNotSetUp,
  profileComplete,
  authStep,
}

    logger.log('hydrate payload', payload)
    useAuthStore.getState().setUser(payload)
    logger.log('hydrate end', useAuthStore.getState())

    if (!isAdmin && payload.authStep === 'ONBOARDED' && resolvedRole) {
      try {
        const studentRole = resolvedRole as 'STUDENT' | 'CR' | 'LR'
        await ensureUserProfile({
          id: userId,
          name: payload.name ?? null,
          email,
          role: studentRole,
          mobile_number: payload.mobileNumber,
        })
      } catch (e) {
        logger.log('ensureUserProfile failed', e)
      }
    }
  } catch (e) {
    logger.log('hydrateAuthState crashed', e)
    useAuthStore.getState().reset()
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  logger.log('auth event', event, !!session?.user)

  if (event === 'SIGNED_OUT') {
    useAuthStore.getState().reset()
    return
  }

  if (
    event === 'INITIAL_SESSION' ||
    event === 'SIGNED_IN' ||
    event === 'TOKEN_REFRESHED' ||
    event === 'USER_UPDATED'
  ) {
    if (session?.user) {
      useAuthStore.getState().setUser({ isLoading: true })
      hydrateAuthState()
    } else {
      useAuthStore.getState().reset()
    }
  }
})