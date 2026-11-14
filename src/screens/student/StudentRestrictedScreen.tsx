import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'
import { supabase } from '../../api/supabase'
import { validateName, check } from '../../utils/validation'
import { VyndraFooter } from '../../components/VyndraFooter'
import { RoleTransfer, getPendingTransferForUser } from '../../api/roleTransferApi'

interface Props {
  onCheckTransfer?: () => void
}

export function StudentRestrictedScreen({ onCheckTransfer }: Props) {
  const {
    userId,
    name,
    email,
    branch,
    year,
    semester,
    section,
    rollNumber,
    avatarUrl,
    reset,
  } = useAuthStore()

  const [signingOut, setSigningOut] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [draftName, setDraftName] = useState(name ?? '')
  const [pendingTransfer, setPendingTransfer] = useState<RoleTransfer | null>(null)
  const [checkingTransfer, setCheckingTransfer] = useState(false)

  useEffect(() => {
    setDraftName(name ?? '')
  }, [name])

  useEffect(() => {
    if (!userId) return
    checkPendingRoleTransfer()
  }, [userId])

  async function checkPendingRoleTransfer() {
    if (!userId) return
    try {
      setCheckingTransfer(true)
      const transfer = await getPendingTransferForUser(userId)
      setPendingTransfer(transfer)
    } catch {
      setPendingTransfer(null)
    } finally {
      setCheckingTransfer(false)
    }
  }

  async function handleSaveName() {
    const normalizedName = draftName.trim()
    if (!check(validateName(normalizedName))) return
    if (!userId) return Alert.alert('Error', 'No user session found.')

    try {
      setSavingName(true)
      const { error } = await supabase
        .from('users')
        .update({ name: normalizedName })
        .eq('id', userId)

      if (error) throw error

      useAuthStore.getState().setUser({ name: normalizedName })
      setEditingName(false)
      Alert.alert('Saved', 'Name updated successfully.')
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message ?? 'Unable to update name.')
    } finally {
      setSavingName(false)
    }
  }

  async function handlePickAvatar() {
    if (!userId) {
      Alert.alert('Error', 'No user session found.')
      return
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow gallery access to upload a profile photo.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      })

      if (result.canceled || !result.assets?.length) return

      const asset = result.assets[0]
      if (!asset.base64) {
        Alert.alert('Upload Failed', 'Could not read selected image.')
        return
      }

      setUploadingAvatar(true)

      const ext =
        asset.mimeType?.includes('png') ? 'png' :
        asset.mimeType?.includes('webp') ? 'webp' : 'jpg'

      const filePath = `${userId}/avatar_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('profilepics')
        .upload(filePath, decode(asset.base64), {
          contentType: asset.mimeType ?? 'image/jpeg',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('profilepics')
        .getPublicUrl(filePath)

      const publicUrl = publicUrlData.publicUrl

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)

      if (updateError) throw updateError

      useAuthStore.getState().setUser({ avatarUrl: publicUrl })
      Alert.alert('Success', 'Profile photo updated successfully.')
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message ?? 'Unable to upload profile photo.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          try {
            await supabase.auth.signOut({ scope: 'global' })
          } catch {
            // best-effort
          }
          reset()
          setSigningOut(false)
        },
      },
    ])
  }

  function InfoRow({
    icon,
    label,
    value,
  }: {
    icon: keyof typeof Ionicons.glyphMap
    label: string
    value: string | null | undefined
  }) {
    return (
      <View style={styles.infoRow}>
        <View style={styles.infoIcon}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value ?? '—'}</Text>
        </View>
      </View>
    )
  }

  const initials =
    name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '?'

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attenza</Text>
        <Text style={styles.headerSub}>Student Portal &bull; Attendance Management</Text>
      </View>

      {/* Scope notice banner */}
      <View style={styles.noticeBanner}>
        <View style={styles.noticeIconWrap}>
          <Ionicons name="information-circle" size={24} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>Representative Access Only</Text>
          <Text style={styles.noticeBody}>
            Attendance taking and viewing are currently restricted to authorized Class Representatives (CR/LR).
          </Text>
        </View>
      </View>

      {/* Pending Role Transfer Action Banner */}
      {pendingTransfer && (
        <View style={styles.transferBanner}>
          <View style={styles.transferIconWrap}>
            <Ionicons name="swap-horizontal" size={24} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.transferTitle}>Pending Role Transfer</Text>
            <Text style={styles.transferBody}>
              You have been invited to become a {pendingTransfer.role} for your class.
            </Text>
            <TouchableOpacity
              style={styles.transferBtn}
              onPress={() => {
                if (onCheckTransfer) {
                  onCheckTransfer()
                } else {
                  hydrateAuthState()
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.transferBtnText}>Review Transfer</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Avatar & Profile Identity */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={handlePickAvatar}
          activeOpacity={0.85}
          disabled={uploadingAvatar}
        >
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>

          <View style={styles.cameraBadge}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={14} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        <Text style={styles.avatarHint}>Tap photo to change</Text>

        {editingName ? (
          <View style={styles.nameEditWrap}>
            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
              maxLength={80}
            />
            <View style={styles.nameActions}>
              <TouchableOpacity
                style={styles.nameCancelBtn}
                onPress={() => {
                  setDraftName(name ?? '')
                  setEditingName(false)
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.nameCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nameSaveBtn}
                onPress={handleSaveName}
                disabled={savingName}
                activeOpacity={0.85}
              >
                {savingName ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.nameSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text style={styles.avatarName}>{name ?? '—'}</Text>
            <TouchableOpacity
              onPress={() => setEditingName(true)}
              style={styles.editBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="pencil" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>STUDENT ACCOUNT</Text>
        </View>
      </View>

      {/* Account Details Card */}
      <View style={styles.card}>
        <InfoRow icon="mail-outline" label="Email" value={email} />
        <View style={styles.divider} />
        <InfoRow icon="card-outline" label="Roll Number" value={rollNumber} />
        <View style={styles.divider} />
        <InfoRow icon="school-outline" label="Branch" value={branch} />
        <View style={styles.divider} />
        <InfoRow
          icon="layers-outline"
          label="Year / SEM"
          value={year && semester ? `Year ${year} • SEM ${semester}` : '—'}
        />
        <View style={styles.divider} />
        <InfoRow
          icon="people-outline"
          label="Section"
          value={section ? `Section ${section}` : '—'}
        />
      </View>

      {/* Refresh Status Button */}
      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={async () => {
          await checkPendingRoleTransfer()
          await hydrateAuthState()
        }}
        disabled={checkingTransfer}
        activeOpacity={0.85}
      >
        {checkingTransfer ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <>
            <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
            <Text style={styles.refreshBtnText}>Check Role Updates</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Sign Out Button */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={handleSignOut}
        disabled={signingOut}
        activeOpacity={0.85}
      >
        {signingOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </>
        )}
      </TouchableOpacity>

      <VyndraFooter showLogo style={{ marginTop: 24, marginBottom: 24 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 32 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  noticeBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  noticeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  transferBanner: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  transferIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  transferBody: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
    marginBottom: 10,
  },
  transferBtn: {
    backgroundColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  transferBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  avatarHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  editBtn: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primary + '15',
  },

  nameEditWrap: {
    width: '88%',
    gap: 10,
    alignItems: 'center',
  },
  nameInput: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameActions: {
    flexDirection: 'row',
    gap: 10,
  },
  nameCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  nameCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  nameSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  nameSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  rolePill: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: COLORS.border,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },

  card: {
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },

  refreshBtn: {
    marginHorizontal: 16,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },

  signOutBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#EF4444',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
})
