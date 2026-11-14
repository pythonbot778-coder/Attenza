import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StackNavigationProp } from '@react-navigation/stack'
import { supabase } from '../../api/supabase'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'
import { COLORS } from '../../constants/colors'
import { BRANCHES, type Branch } from '../../constants/branches'
import { SECTIONS, YEARS } from '../../constants/sections'
import { validateName, validateRollNumber, validateMobile, check } from '../../utils/validation'
import { showDialog, showErrorDialog } from '../../store/dialogStore'

export type ProfileStackParams = {
  ProfileSetup: undefined
  RollRangeSetup: {
    branch: string
    year: number
    semester: number
    section: string
    name: string
    rollNumber: string
    role: 'CR' | 'LR'
  }
}

type Props = {
  navigation: StackNavigationProp<ProfileStackParams, 'ProfileSetup'>
}

type ProfileRole = 'CR' | 'LR' | 'STUDENT'

export function ProfileSetupScreen({ navigation }: Props) {
  const [name, setName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [mobile, setMobile] = useState('')
  const [role, setRole] = useState<ProfileRole>('STUDENT')
  const [branch, setBranch] = useState<Branch>(BRANCHES[0])
  const [year, setYear] = useState(1)
  const [semester, setSemester] = useState(1)
  const [section, setSection] = useState('A')
  const [loading, setLoading] = useState(false)

  const isStudent = role === 'STUDENT'

  async function handleSubmit() {
    const normalizedName = name.trim()
    const normalizedRoll = rollNumber.trim().toUpperCase()
    const normalizedMobile = mobile.trim() || null

    if (!check(validateName(normalizedName))) return
    if (!check(validateRollNumber(normalizedRoll))) return
    if (!check(validateMobile(normalizedMobile))) return

    if (role !== 'STUDENT') {
      if (!branch) {
        showErrorDialog('Branch Required', 'Please select your academic branch.')
        return
      }
      if (!year) {
        showErrorDialog('Year Required', 'Please select your academic year.')
        return
      }
      if (!semester) {
        showErrorDialog('Semester Required', 'Please select your semester.')
        return
      }
      if (!section) {
        showErrorDialog('Section Required', 'Please select your class section.')
        return
      }
    }

    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id
      const sessionEmail = session?.user?.email ?? null
      if (!uid) {
        showErrorDialog('Session Expired', 'No active session found. Please log in again.')
        return
      }

      const { error: userError } = await supabase
        .from('users')
        .upsert(
          { id: uid, name: normalizedName, email: sessionEmail, mobile_number: normalizedMobile },
          { onConflict: 'id' }
        )
      if (userError) {
        showErrorDialog('Profile Save Error', userError.message)
        return
      }

      let classGroupId: string | null = null

      if (role !== 'STUDENT') {
        const { data: classGroup, error: cgError } = await supabase
          .from('class_groups')
          .select('id')
          .eq('branch', branch)
          .eq('year', year)
          .eq('semester', semester)
          .eq('section', section)
          .maybeSingle()

        if (cgError) {
          showErrorDialog('Class Group Error', cgError.message)
          return
        }
        classGroupId = classGroup?.id ?? null
      }

      if (role === 'CR' || role === 'LR') {
        if (!classGroupId) {
          useAuthStore.getState().setUser({
            name: normalizedName,
            rollNumber: normalizedRoll,
            mobileNumber: normalizedMobile,
            isLoading: false,
          })
          navigation.navigate('RollRangeSetup', {
            branch,
            year,
            semester,
            section,
            name: normalizedName,
            rollNumber: normalizedRoll,
            role,
          })
          return
        }

        const { data: hasConflict, error: conflictError } = await supabase.rpc('check_role_conflict', {
          p_class_id: classGroupId,
          p_role: role,
        })

        if (conflictError) {
          showErrorDialog('Role Conflict Error', conflictError.message)
          return
        }
        if (hasConflict) {
          showDialog({
            type: 'warning',
            title: `${role} Already Assigned`,
            message: `This class already has a registered ${role}. Please contact your class if this is an error.`,
          })
          return
        }

        // Pre-check: verify roll number is within class range
        const { data: classGroupRange, error: rangeError } = await supabase
          .from('class_groups')
          .select('id, start_roll, end_roll')
          .eq('id', classGroupId)
          .single()

        if (rangeError) {
          showErrorDialog('Class Range Error', rangeError.message)
          return
        }

        const startRoll = String(classGroupRange?.start_roll ?? '').trim().toUpperCase()
        const endRoll = String(classGroupRange?.end_roll ?? '').trim().toUpperCase()

        if (!startRoll || !endRoll) {
          showErrorDialog('Data Missing', 'This class is missing roll range data.')
          return
        }

        if (normalizedRoll < startRoll || normalizedRoll > endRoll) {
          showDialog({
            type: 'warning',
            title: 'Roll Number Mismatch',
            message: `This roll number does not belong to the selected class.\n\nAllowed range: ${startRoll} to ${endRoll}`,
          })
          return
        }

        const { error: claimError } = await supabase.rpc('claim_class_member_row', {
          p_class_id: classGroupId,
          p_roll_number: normalizedRoll,
          p_user_id: uid,
          p_name: normalizedName,
          p_role: role,
        })

        if (claimError) {
          showErrorDialog('Claim Error', claimError.message)
          return
        }

        useAuthStore.getState().setUser({
          name: normalizedName,
          rollNumber: normalizedRoll,
          mobileNumber: normalizedMobile,
          isLoading: true,
        })
        await hydrateAuthState()
        return
      }

      const { data: result, error: claimError } = await supabase.rpc('find_and_claim_student_row', {
        p_roll_number: normalizedRoll,
        p_user_id: uid,
        p_name: normalizedName,
      })

      if (claimError) {
        showErrorDialog('Claim Error', claimError.message)
        return
      }

      useAuthStore.getState().setUser({
        name: normalizedName,
        rollNumber: normalizedRoll,
        mobileNumber: normalizedMobile,
        isLoading: true,
        profileComplete: true,
      })

      if (result === 'not_found') {
        await hydrateAuthState()
        return
      }

      await hydrateAuthState()
    } catch (err: any) {
      showErrorDialog('Error', err?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Ionicons name="person-circle-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Set Up Profile</Text>
            <Text style={styles.subtitle}>Enter your details to configure your account</Text>
          </View>

          {/* Role Selection Card */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Choose Your Role</Text>
            <View style={styles.roleGrid}>
              {(['STUDENT', 'CR', 'LR'] as ProfileRole[]).map((r) => {
                const isSelected = role === r
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleCard, isSelected && styles.roleCardActive]}
                    onPress={() => setRole(r)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.roleIconCircle, isSelected && styles.roleIconCircleActive]}>
                      <Ionicons
                        name={r === 'STUDENT' ? 'school-outline' : 'ribbon-outline'}
                        size={20}
                        color={isSelected ? COLORS.textOnPrimary : COLORS.primary}
                      />
                    </View>
                    <Text style={[styles.roleCardTitle, isSelected && styles.roleCardTitleActive]}>
                      {r === 'STUDENT' ? 'Student' : r === 'CR' ? 'Class Rep' : 'Ladies Rep'}
                    </Text>
                    <Text style={[styles.roleBadge, isSelected && styles.roleBadgeActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Basic Info Card */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Personal Information</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={COLORS.textSecondary}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter full name"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  maxLength={80}
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Roll Number</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="id-card-outline"
                  size={18}
                  color={COLORS.textSecondary}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={styles.input}
                  value={rollNumber}
                  onChangeText={(t) => setRollNumber(t.toUpperCase())}
                  placeholder="e.g. 25ECE04131"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="characters"
                  maxLength={15}
                  editable={!loading}
                />
              </View>
              <Text style={styles.helperText}>5–15 uppercase alphanumeric characters</Text>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Mobile Number</Text>
                <Text style={styles.optionalBadge}>Optional</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={COLORS.textSecondary}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={styles.input}
                  value={mobile}
                  onChangeText={setMobile}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!loading}
                />
              </View>
            </View>
          </View>

          {/* Academic Info Card (CR/LR Only) */}
          {role !== 'STUDENT' && (
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>Class Details</Text>

              {/* Branch */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Branch</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {BRANCHES.map((b: Branch) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.chip, branch === b && styles.chipActive]}
                      onPress={() => setBranch(b)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, branch === b && styles.chipTextActive]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Year */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Academic Year</Text>
                <View style={styles.chipRow}>
                  {YEARS.map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.chip, year === y && styles.chipActive]}
                      onPress={() => setYear(y)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, year === y && styles.chipTextActive]}>
                        Year {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Semester */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Semester</Text>
                <View style={styles.chipRow}>
                  {[1, 2].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, semester === s && styles.chipActive]}
                      onPress={() => setSemester(s)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, semester === s && styles.chipTextActive]}>
                        SEM {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Section */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Section</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {SECTIONS.map((sec) => (
                    <TouchableOpacity
                      key={sec}
                      style={[styles.chip, section === sec && styles.chipActive]}
                      onPress={() => setSection(sec)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, section === sec && styles.chipTextActive]}>
                        Section {sec}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textOnPrimary} />
            ) : (
              <View style={styles.buttonInner}>
                <Text style={styles.buttonText}>
                  {isStudent ? 'Complete Profile' : 'Continue to Class Setup'}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={COLORS.textOnPrimary}
                  style={{ marginLeft: 6 }}
                />
              </View>
            )}
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  inner: {
    paddingTop: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBadge: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
    gap: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  roleCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  roleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  roleIconCircleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  roleCardTitleActive: {
    color: COLORS.primary,
  },
  roleBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  roleBadgeActive: {
    color: COLORS.primary,
  },
  formGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  optionalBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputPrefixIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
})
