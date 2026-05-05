import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'pref_show_names_in_attendance'

/** Returns stored preference. Defaults to true (show names) if never set. */
export async function getShowNames(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEY)
    return val === null ? true : val === 'true'
  } catch {
    return true
  }
}

/** Persists the preference. */
export async function setShowNames(show: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, String(show))
  } catch {
    // silent — non-critical preference
  }
}