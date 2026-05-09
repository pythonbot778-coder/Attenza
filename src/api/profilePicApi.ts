import { decode } from 'base64-arraybuffer'
import * as FileSystem from 'expo-file-system'
import { supabase } from './supabase'

const BUCKET = 'profilepics'

function getExt(uri: string) {
  const clean = uri.split('?')[0]
  const parts = clean.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'jpg'
}

function getContentType(ext: string) {
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic' || ext === 'heif') return 'image/heic'
  return 'image/jpeg'
}

export async function uploadProfilePicture(userId: string, uri: string): Promise<string> {
  const ext = getExt(uri)
  const filePath = `${userId}/avatar.${ext}`
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  })

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, decode(base64), {
      contentType: getContentType(ext),
      upsert: true,
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}