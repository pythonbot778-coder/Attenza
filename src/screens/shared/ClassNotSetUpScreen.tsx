import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../api/supabase'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'
import { COLORS } from '../../constants/colors'
import { logger } from '../../utils/logger'
import { validateName, validateRollNumber, validateMobile } from '../../utils/validation'
import { VyndraFooter } from '../../components/VyndraFooter'
import {
  showErrorDialog,
  showSuccessDialog,
} from '../../store/dialogStore'

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
  const [syncError, setSyncError] = useState<string | null>(null)

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
      setSyncError(null)
      await claimStudentRow()
      setSyncError(null)
    } catch (e: any) {
      const msg = e?.message ?? 'Unable to sync class right now.'
      logger.log('ClassNotSetUp retry failed', e)
      setSyncError(msg)
      showErrorDialog('Sync Retry Failed', msg)
    } finally {
      setSyncing(false)
    }
  }

  async function handleSaveName() {
    if (!userId) {
      showErrorDialog('Session Error', 'No active session found. Please login again.')
      return
    }

    const v = validateName(normalizedName)
    if (!v.valid) {
      showErrorDialog('Invalid Name', v.error ?? 'Please check your name.')
      return
    }

    try {
      setSavingProfile(true)

      const { error } = await supabase
        .from('users')
        .update({ name: normalizedName })
        .eq('id', userId)

      if (error) throw error

      useAuthStore.getState().setUser({ name: normalizedName })
      setEditingName(false)
      showSuccessDialog('Name Updated', 'Your name has been updated successfully.')
    } catch (e: any) {
      logger.log('Name update failed', e)
      showErrorDialog('Save Failed', e?.message ?? 'Unable to update your name right now.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSaveContact() {
    if (!userId) {
      showErrorDialog('Session Error', 'No user session found. Please login again.')
      return
    }

    const vRoll = validateRollNumber(normalizedRollNumber)
    if (!vRoll.valid) {
      showErrorDialog('Invalid Roll Number', vRoll.error ?? 'Please check your roll number.')
      return
    }

    const vMobile = validateMobile(normalizedMobileNumber)
    if (!vMobile.valid) {
      showErrorDialog('Invalid Mobile', vMobile.error ?? 'Please check your mobile number.')
      return
    }

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

      showSuccessDialog('Details Saved', 'Roll number and mobile number updated successfully.')
    } catch (e: any) {
      logger.log('Contact update failed', e)
      showErrorDialog('Save Failed', e?.message ?? 'Unable to update your details right now.')
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
            setSyncError(null)
          } catch (e: any) {
            const msg = e?.message ?? 'Auto-sync claim failed.'
            logger.log('Auto sync claim failed', e)
            setSyncError(msg)
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
      {/* Waiting Status Hero */}
      <View style={styles.heroSection}>
        <View style={styles.iconRing}>
          <View style={styles.iconCircle}>
            <Ionicons name="hourglass-outline" size={38} color={COLORS.primary} />
          </View>
        </View>

        <Text style={styles.title}>Waiting for Class Setup</Text>
        <Text style={styles.body}>
          Your class representative (CR/LR) has not initiated this class yet. Once they set up the roster, your student account will automatically sync.
        </Text>

        <View style={styles.syncStatusPill}>
          <View style={[styles.statusDot, { backgroundColor: listening ? COLORS.success : COLORS.warning }]} />
          <Text style={styles.syncStatusText}>
            Auto-sync {listening ? 'active' : 'connecting'} for {rollNumber ?? '—'}
          </Text>
        </View>
      </View>

      {/* Student Details Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Your Registered Info</Text>
          <Text style={styles.cardHeaderHint}>Ensure your roll number is accurate</Text>
        </View>

        {/* Name Field */}
        <View style={styles.fieldBlock}>
          <Text style={styles.cardLabel}>Full Name</Text>
          {editingName ? (
            <View style={styles.editWrap}>
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
                  activeOpacity={0.8}
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
                    <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.inlineRow}>
              <Text style={styles.cardValue}>{name ?? '—'}</Text>
              <TouchableOpacity
                onPress={() => setEditingName(true)}
                style={styles.editBtn}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Email Field (Read-only) */}
        <View style={styles.fieldBlock}>
          <Text style={styles.cardLabel}>College Email</Text>
          <View style={styles.inlineRow}>
            <Text style={styles.cardValue}>{email ?? '—'}</Text>
            <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMuted} />
          </View>
        </View>

        {/* Roll Number Field */}
        <View style={styles.fieldBlock}>
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
              <Text style={[styles.cardValue, styles.rollNumberValue]}>{rollNumber ?? '—'}</Text>
              {!editingName && (
                <TouchableOpacity
                  onPress={() => setEditingContact(true)}
                  style={styles.editBtn}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="pencil" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Mobile Number Field */}
        <View style={[styles.fieldBlock, { borderBottomWidth: 0 }]}>
          <Text style={styles.cardLabel}>Mobile Number</Text>
          {editingContact ? (
            <View style={styles.editWrap}>
              <TextInput
                style={styles.input}
                value={draftMobileNumber}
                onChangeText={setDraftMobileNumber}
                placeholder="10-digit phone number"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, savingProfile && styles.btnDisabled]}
                  onPress={cancelContactEdit}
                  disabled={savingProfile}
                  activeOpacity={0.8}
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
                    <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.cardValue}>{mobileNumber ?? '—'}</Text>
          )}
        </View>
      </View>

      {/* Manual Retry Sync Action Button */}
      <TouchableOpacity
        style={[
          styles.retryBtn,
          (syncing || isLoading || savingProfile) && styles.btnDisabled,
        ]}
        onPress={handleRetry}
        disabled={syncing || isLoading || savingProfile}
        activeOpacity={0.85}
      >
        {syncing ? (
          <ActivityIndicator color={COLORS.textOnPrimary} />
        ) : (
          <View style={styles.retryBtnInner}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.retryText}>Check Class Setup Now</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Sync Error / Feedback Strip */}
      {syncError && (
        <View style={styles.errorNotice}>
          <Ionicons name="alert-circle" size={16} color={COLORS.absent} />
          <Text style={styles.errorNoticeText}>
            Auto-sync check: {syncError}. Tap button above to retry.
          </Text>
        </View>
      )}

      {/* Sign Out Button */}
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
        <Ionicons name="log-out-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <VyndraFooter style={{ marginTop: 28 }} />
      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 32,
    flexGrow: 1,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: COLORS.primary + '25',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  syncStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  cardHeaderHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  fieldBlock: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  rollNumberValue: {
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 0.5,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editWrap: {
    marginTop: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  retryBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  retryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.absent + '10',
    borderWidth: 1,
    borderColor: COLORS.absent + '30',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorNoticeText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.absent,
    fontWeight: '600',
  },
  signOutBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  signOutText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
})
