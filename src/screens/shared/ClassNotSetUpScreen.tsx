import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native'
import { supabase } from '../../api/supabase'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'
import { COLORS } from '../../constants/colors'
import { logger } from '../../utils/logger'
import { validateName, validateRollNumber, validateMobile, check } from '../../utils/validation'

export function ClassNotSetUpScreen() {
  const {
    userId,
    email,
    name,
    rollNumber,
    mobileNumber,
    isLoading,
  } = useAuthStore()

  const [syncing, setSyncing] = useState(false)
  const [listening, setListening] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  const [editingName, setEditingName] = useState(false)
  const [editingContact, setEditingContact] = useState(false)

  const [draftName, setDraftName] = useState(name ?? '')
  const [draftRollNumber, setDraftRollNumber] = useState(rollNumber ?? '')
  const [draftMobileNumber, setDraftMobileNumber] = useState(mobileNumber ?? '')

  const normalizedName = useMemo(() => draftName.trim(), [draftName])
  const normalizedRollNumber = useMemo(
    () => draftRollNumber.trim().toUpperCase(),
    [draftRollNumber]
  )
  const normalizedMobileNumber = useMemo(
    () => draftMobileNumber.trim(),
    [draftMobileNumber]
  )

  useEffect(() => {
    setDraftName(name ?? '')
  }, [name])

  useEffect(() => {
    setDraftRollNumber(rollNumber ?? '')
  }, [rollNumber])

  useEffect(() => {
    setDraftMobileNumber(mobileNumber ?? '')
  }, [mobileNumber])

  async function claimStudentRow(explicitRoll?: string) {
    const activeRoll = (explicitRoll ?? useAuthStore.getState().rollNumber ?? '').trim().toUpperCase()

    if (!userId) throw new Error('No session user found')
    if (!activeRoll) throw new Error('Roll number missing')

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    const { error: claimError } = await supabase.rpc('find_and_claim_student_row', {
      p_roll_number: activeRoll,
      p_user_id: userId,
      p_name: userRow?.name ?? null,
    })

    if (claimError) throw claimError

    await hydrateAuthState()
  }

  async function handleRetry() {
    try {
      setSyncing(true)
      await claimStudentRow()
    } catch (e: any) {
      logger.log('ClassNotSetUp retry failed', e)
      Alert.alert('Retry Failed', e?.message ?? 'Unable to sync class right now.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSaveName() {
    if (!userId) {
      Alert.alert('Error', 'No user session found.')
      return
    }

    if (!check(validateName(normalizedName))) return

    try {
      setSavingProfile(true)

      const { error } = await supabase
        .from('users')
        .update({ name: normalizedName })
        .eq('id', userId)

      if (error) throw error

      useAuthStore.getState().setUser({ name: normalizedName })
      setEditingName(false)
      Alert.alert('Saved', 'Name updated successfully.')
    } catch (e: any) {
      logger.log('Name update failed', e)
      Alert.alert('Save Failed', e?.message ?? 'Unable to update your name right now.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSaveContact() {
    if (!userId) {
      Alert.alert('Error', 'No user session found.')
      return
    }

    if (!check(validateRollNumber(normalizedRollNumber))) return
    if (!check(validateMobile(normalizedMobileNumber))) return

    try {
      setSavingProfile(true)

      const { error } = await supabase
        .from('users')
        .update({
          mobile_number: normalizedMobileNumber || null,
        })
        .eq('id', userId)

      if (error) throw error

      useAuthStore.getState().setUser({
        rollNumber: normalizedRollNumber,
        mobileNumber: normalizedMobileNumber || null,
      })

      setEditingContact(false)

      try {
        setSyncing(true)
        await claimStudentRow(normalizedRollNumber)
      } catch (claimErr) {
        logger.log('Claim after contact save did not complete immediately', claimErr)
      } finally {
        setSyncing(false)
      }

      Alert.alert('Saved', 'Roll number and mobile number updated.')
    } catch (e: any) {
      logger.log('Contact update failed', e)
      Alert.alert('Save Failed', e?.message ?? 'Unable to update your details right now.')
    } finally {
      setSavingProfile(false)
    }
  }

  function cancelNameEdit() {
    setDraftName(name ?? '')
    setEditingName(false)
  }

  function cancelContactEdit() {
    setDraftRollNumber(rollNumber ?? '')
    setDraftMobileNumber(mobileNumber ?? '')
    setEditingContact(false)
  }

  useEffect(() => {
    const activeRoll = (useAuthStore.getState().rollNumber ?? '').trim().toUpperCase()

    if (!activeRoll || !userId) return

    setListening(true)

    const channel = supabase
      .channel(`class-members-${userId}-${activeRoll}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_members',
          filter: `roll_number=eq.${activeRoll}`,
        },
        async (payload) => {
          logger.log('Class membership change detected', payload)
          try {
            await claimStudentRow(activeRoll)
          } catch (e) {
            logger.log('Auto sync claim failed', e)
          }
        }
      )
      .subscribe((status) => {
        logger.log('ClassNotSetUp realtime status', status)
      })

    return () => {
      setListening(false)
      supabase.removeChannel(channel)
    }
  }, [userId, rollNumber])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.icon}>🕐</Text>
      <Text style={styles.title}>Waiting for Class Setup</Text>
      <Text style={styles.body}>
        Your CR/LR hasn&apos;t created the class yet. Once they do, your account will sync automatically.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Student Details</Text>

        <Text style={styles.cardLabel}>Name</Text>
        {editingName ? (
          <>
            <TextInput
              style={styles.input}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Your full name"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
              maxLength={80}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.secondaryBtn, savingProfile && styles.btnDisabled]}
                onPress={cancelNameEdit}
                disabled={savingProfile}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, savingProfile && styles.btnDisabled]}
                onPress={handleSaveName}
                disabled={savingProfile}
                activeOpacity={0.85}
              >
                {savingProfile ? (
                  <ActivityIndicator color={COLORS.textOnPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Save Name</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.inlineRow}>
            <Text style={styles.cardValue}>{name ?? '—'}</Text>
            <TouchableOpacity
              onPress={() => setEditingName(true)}
              style={styles.editBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.editBtnText}>✏️</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.cardLabel}>Email</Text>
        <Text style={styles.cardValue}>{email ?? '—'}</Text>
        <Text style={styles.cardHint}>Email cannot be changed here.</Text>

        <Text style={styles.cardLabel}>Roll Number</Text>
        {editingContact ? (
          <TextInput
            style={styles.input}
            value={draftRollNumber}
            onChangeText={(t) => setDraftRollNumber(t.toUpperCase())}
            placeholder="e.g. 25ECE04178"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
            maxLength={15}
          />
        ) : (
          <View style={styles.inlineRow}>
            <Text style={styles.cardValue}>{rollNumber ?? '—'}</Text>
            {!editingName ? (
              <TouchableOpacity
                onPress={() => setEditingContact(true)}
                style={styles.editBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.editBtnText}>✏️</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <Text style={styles.cardLabel}>Mobile Number</Text>
        {editingContact ? (
          <>
            <TextInput
              style={styles.input}
              value={draftMobileNumber}
              onChangeText={setDraftMobileNumber}
              placeholder="10-digit number"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.secondaryBtn, savingProfile && styles.btnDisabled]}
                onPress={cancelContactEdit}
                disabled={savingProfile}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, savingProfile && styles.btnDisabled]}
                onPress={handleSaveContact}
                disabled={savingProfile}
                activeOpacity={0.85}
              >
                {savingProfile ? (
                  <ActivityIndicator color={COLORS.textOnPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Save Details</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.cardValue}>{mobileNumber ?? '—'}</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.retryBtn, (syncing || isLoading || savingProfile) && styles.btnDisabled]}
        onPress={handleRetry}
        disabled={syncing || isLoading || savingProfile}
        activeOpacity={0.85}
      >
        {syncing ? (
          <ActivityIndicator color={COLORS.textOnPrimary} />
        ) : (
          <Text style={styles.retryText}>Retry Sync</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>
        Auto-sync is {listening ? 'enabled' : 'starting'} for roll number {useAuthStore.getState().rollNumber ?? '—'}.
      </Text>

      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={async () => {
          try {
            await supabase.auth.signOut({ scope: 'global' })
          } catch (e) {
            logger.log('Sign out failed', e)
          }
          useAuthStore.getState().reset()
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 32,
    flexGrow: 1,
    justifyContent: 'center',
  },
  icon: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  cardHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  editBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editBtnText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  retryBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  retryText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 18,
  },
  signOutBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  signOutText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
})