// src/store/cacheStore.ts
import { create } from 'zustand'

export interface CachedSubject {
  id: string
  name: string
  faculty_name: string
  type: 'CLASS' | 'LAB'
  lab_batches: { id: string; batch_name: string }[]
}

export interface CachedSessionSummary {
  id: string
  date_selected: string
  taken_at: string
  present_count: number
  absent_count: number
  total_count: number
  is_edited: boolean
  subject: {
    id: string
    name: string
    type: 'CLASS' | 'LAB'
    faculty_name: string
  }
  batch_name?: string | null
}

interface CacheState {
  // Local in-memory caches
  subjects: Record<string, CachedSubject[]>
  sessions: Record<string, CachedSessionSummary[]>

  // Invalidation dirty flags
  historyStale: boolean
  subjectsStale: boolean

  // Actions
  setSubjects: (classId: string, data: CachedSubject[]) => void
  setSessions: (cacheKey: string, data: CachedSessionSummary[]) => void

  invalidateHistory: () => void
  invalidateSubjects: () => void
  clearAllCache: () => void
}

export const useCacheStore = create<CacheState>((set) => ({
  subjects: {},
  sessions: {},
  historyStale: false,
  subjectsStale: false,

  setSubjects: (classId, data) =>
    set((state) => ({
      subjects: { ...state.subjects, [classId]: data },
      subjectsStale: false,
    })),

  setSessions: (cacheKey, data) =>
    set((state) => ({
      sessions: { ...state.sessions, [cacheKey]: data },
      historyStale: false,
    })),

  invalidateHistory: () => set({ historyStale: true }),
  invalidateSubjects: () => set({ subjectsStale: true }),

  clearAllCache: () =>
    set({
      subjects: {},
      sessions: {},
      historyStale: true,
      subjectsStale: true,
    }),
}))
