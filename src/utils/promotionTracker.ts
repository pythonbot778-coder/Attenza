import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Tracks promotion events per class so the CR/LR home screen can prompt
 * users to download the previous semester's CSV before the reminder expires.
 *
 * Storage shape (per class):
 *   {
 *     lastSeenLabel: "Y1S1",
 *     pendingArchive: {
 *       label: "Y1S1",          // semester that just got archived
 *       since: "<iso date>",    // when we detected the promotion
 *       csvDownloaded: false,
 *     } | null
 *   }
 */

const KEY_PREFIX = 'attenza:promotionTracker:'
const REMINDER_DAYS = 3

interface PendingArchive {
  label: string
  since: string
  csvDownloaded: boolean
}

interface ClassState {
  lastSeenLabel: string | null
  pendingArchive: PendingArchive | null
}

function key(classId: string) {
  return `${KEY_PREFIX}${classId}`
}

async function readState(classId: string): Promise<ClassState> {
  try {
    const raw = await AsyncStorage.getItem(key(classId))
    if (!raw) return { lastSeenLabel: null, pendingArchive: null }
    return JSON.parse(raw) as ClassState
  } catch {
    return { lastSeenLabel: null, pendingArchive: null }
  }
}

async function writeState(classId: string, state: ClassState): Promise<void> {
  try {
    await AsyncStorage.setItem(key(classId), JSON.stringify(state))
  } catch {
    // non-critical
  }
}

/**
 * Call on home-screen mount with the class's current semester label.
 * If the label has changed since last seen, archive the previous label
 * and start a 3-day reminder window.
 *
 * Returns the pending reminder (if any) for the caller to render.
 */
export async function syncPromotionState(
  classId: string,
  currentLabel: string,
): Promise<PendingArchive | null> {
  if (!classId || !currentLabel) return null

  const state = await readState(classId)

  // First time seeing this class — just remember the current label, no reminder.
  if (!state.lastSeenLabel) {
    await writeState(classId, { lastSeenLabel: currentLabel, pendingArchive: null })
    return null
  }

  // Label changed — promotion (or demotion) occurred.
  if (state.lastSeenLabel !== currentLabel) {
    const next: ClassState = {
      lastSeenLabel: currentLabel,
      pendingArchive: {
        label: state.lastSeenLabel,
        since: new Date().toISOString(),
        csvDownloaded: false,
      },
    }
    await writeState(classId, next)
    return next.pendingArchive
  }

  // Same label — return existing reminder if still active.
  return activeReminder(state.pendingArchive)
}

/** Returns the pending reminder if it hasn't expired or been satisfied. */
function activeReminder(pending: PendingArchive | null): PendingArchive | null {
  if (!pending) return null
  if (pending.csvDownloaded) return null
  const sinceMs = new Date(pending.since).getTime()
  if (Number.isNaN(sinceMs)) return null
  const ageMs = Date.now() - sinceMs
  if (ageMs > REMINDER_DAYS * 24 * 60 * 60 * 1000) return null
  return pending
}

/** Mark the CSV as downloaded — suppresses the reminder. */
export async function markCsvDownloaded(classId: string, label: string): Promise<void> {
  const state = await readState(classId)
  if (!state.pendingArchive || state.pendingArchive.label !== label) return
  state.pendingArchive.csvDownloaded = true
  await writeState(classId, state)
}

/** Force-dismiss the reminder (e.g., user closed it manually). Optional. */
export async function dismissReminder(classId: string): Promise<void> {
  const state = await readState(classId)
  if (!state.pendingArchive) return
  state.pendingArchive.csvDownloaded = true
  await writeState(classId, state)
}

/** Read whatever pending reminder is currently active without mutating state. */
export async function getActiveReminder(classId: string): Promise<PendingArchive | null> {
  const state = await readState(classId)
  return activeReminder(state.pendingArchive)
}
