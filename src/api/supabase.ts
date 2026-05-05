import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Splits large values into chunks to stay under SecureStore's 2048 byte limit
const CHUNK_SIZE = 1900

const ChunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    // Try to get as single item first (backward compat)
    const single = await SecureStore.getItemAsync(key)
    if (single !== null) return single

    // Try chunked
    const countStr = await SecureStore.getItemAsync(`${key}_count`)
    if (!countStr) return null

    const count = parseInt(countStr, 10)
    const chunks: string[] = []
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`)
      if (chunk === null) return null
      chunks.push(chunk)
    }
    return chunks.join('')
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      // Small enough — store directly, clean up any old chunks
      await SecureStore.setItemAsync(key, value)
      await ChunkedSecureStore.removeChunks(key)
      return
    }

    // Split into chunks
    const chunks: string[] = []
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE))
    }

    // Delete old single-key entry if exists
    await SecureStore.deleteItemAsync(key).catch(() => { })

    // Store chunks
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i])
    }
    await SecureStore.setItemAsync(`${key}_count`, String(chunks.length))
  },

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key).catch(() => { })
    await ChunkedSecureStore.removeChunks(key)
  },

  async removeChunks(key: string): Promise<void> {
    const countStr = await SecureStore.getItemAsync(`${key}_count`)
    if (!countStr) return
    const count = parseInt(countStr, 10)
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => { })
    }
    await SecureStore.deleteItemAsync(`${key}_count`).catch(() => { })
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ChunkedSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})