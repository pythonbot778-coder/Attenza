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
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../api/supabase'
import { validateName, check } from '../../utils/validation'
import { useNavigation } from '@react-navigation/native'

export function StudentProfileScreen() {
  const {
    userId,
    name,
    email,
    role,
    branch,
    year,
    semester,
    section,
    rollNumber,
    reset,
  } = useAuthStore()

  const [signingOut, setSigningOut] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [draftName, setDraftName] = useState(name ?? '')
  const navigation = useNavigation<any>()

  useEffect(() => {
    setDraftName(name ?? '')
  }, [name])

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

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          await supabase.auth.signOut()
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSub}>Your account details</Text>
      </View>

      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>

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
          <Text style={styles.rolePillText}>{role ?? 'STUDENT'}</Text>
        </View>
      </View>

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
          value={`Year ${year} • SEM ${semester}`}
        />
        <View style={styles.divider} />
        <InfoRow
          icon="people-outline"
          label="Section"
          value={`Section ${section}`}
        />
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.supportRow}
          onPress={() =>
            navigation.navigate('Profile', {
              screen: 'SupportSuggestions',
            })
          }
          activeOpacity={0.85}
        >
          <View style={styles.supportLeft}>
            <View style={styles.supportIconWrap}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color={COLORS.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Support & Suggestions</Text>
              <Text style={styles.supportSub}>
                Report app issues or share your ideas
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

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

  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
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
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  nameActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  nameCancelBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  nameCancelText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  nameSaveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  nameSaveText: {
    color: '#fff',
    fontWeight: '700',
  },

  rolePill: {
    marginTop: 8,
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  rolePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  supportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  supportIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  supportSub: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  signOutBtn: {
    marginHorizontal: 24,
    marginTop: 8,
    backgroundColor: COLORS.absent,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
})