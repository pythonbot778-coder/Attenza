import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { supabase } from '../../api/supabase'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'
import { COLORS } from '../../constants/colors'
import { BRANCHES, type Branch } from '../../constants/branches'
import { SECTIONS, YEARS } from '../../constants/sections'
import { validateName, validateRollNumber, validateMobile, check } from '../../utils/validation'

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
  const { userId, email, setUser } = useAuthStore()

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
    if (!branch) return Alert.alert('Error', 'Select your branch.')
    if (!year) return Alert.alert('Error', 'Select your year.')
    if (!semester) return Alert.alert('Error', 'Select your semester.')
    if (!section) return Alert.alert('Error', 'Select your section.')
  }

  try {
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    const sessionEmail = session?.user?.email ?? null
    if (!uid) return Alert.alert('Error', 'No session. Please login again.')

    const { error: userError } = await supabase
      .from('users')
      .upsert(
        { id: uid, name: normalizedName, email: sessionEmail, mobile_number: normalizedMobile },
        { onConflict: 'id' }
      )
    if (userError) return Alert.alert('Error', userError.message)

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

      if (cgError) return Alert.alert('Error', cgError.message)
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

      if (conflictError) return Alert.alert('Error', conflictError.message)
      if (hasConflict) {
        return Alert.alert(
          `${role} Already Assigned`,
          `This class already has a ${role}. Contact your class if this is an error.`
        )
      }

      // Pre-check: verify roll number is within class range
      const { data: classGroupRange, error: rangeError } = await supabase
        .from('class_groups')
        .select('id, start_roll, end_roll')
        .eq('id', classGroupId)
        .single()

      if (rangeError) return Alert.alert('Error', rangeError.message)

      const startRoll = String(classGroupRange?.start_roll ?? '').trim().toUpperCase()
      const endRoll = String(classGroupRange?.end_roll ?? '').trim().toUpperCase()

      if (!startRoll || !endRoll) {
        return Alert.alert('Error', 'This class is missing roll range data.')
      }

      if (normalizedRoll < startRoll || normalizedRoll > endRoll) {
        return Alert.alert(
          'Roll Number Mismatch',
          `This roll number does not belong to the selected class.\n\nAllowed range: ${startRoll} to ${endRoll}`
        )
      }

      const { error: claimError } = await supabase.rpc('claim_class_member_row', {
        p_class_id: classGroupId,
        p_roll_number: normalizedRoll,
        p_user_id: uid,
        p_name: normalizedName,
        p_role: role,
      })

      if (claimError) return Alert.alert('Error', claimError.message)

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

    if (claimError) return Alert.alert('Error', claimError.message)

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
    Alert.alert('Error', err?.message ?? 'Something went wrong')
  } finally {
    setLoading(false)
  }
}
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Set Up Profile</Text>
          <Text style={styles.subtitle}>Tell us about yourself</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>I am a</Text>
          <View style={styles.roleRow}>
            {(['CR', 'LR', 'STUDENT'] as ProfileRole[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                onPress={() => setRole(r)}
              >
                <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                  {r === 'CR' ? '👑 CR' : r === 'LR' ? '👑 LR' : '🎓 Student'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Basic Info</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="FULL NAME"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="words"
            maxLength={80}
          />

          <Text style={styles.label}>Roll Number</Text>
          <TextInput
            style={styles.input}
            value={rollNumber}
            onChangeText={(t) => setRollNumber(t.toUpperCase())}
            placeholder="e.g. 2abcd01234"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
            maxLength={15}
          />

          <Text style={styles.label}>
            Mobile Number{' '}
            <Text style={{ color: COLORS.textMuted, fontWeight: '400' }}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={setMobile}
            placeholder="10-digit number"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>

        {role !== 'STUDENT' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Branch</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {BRANCHES.map((b: Branch) => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.chip, branch === b && styles.chipActive]}
                    onPress={() => setBranch(b)}
                  >
                    <Text style={[styles.chipText, branch === b && styles.chipTextActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Year</Text>
              <View style={styles.chipRow}>
                {YEARS.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[styles.chip, year === y && styles.chipActive]}
                    onPress={() => setYear(y)}
                  >
                    <Text style={[styles.chipText, year === y && styles.chipTextActive]}>Year {y}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Semester</Text>
              <View style={styles.chipRow}>
                {[1, 2].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, semester === s && styles.chipActive]}
                    onPress={() => setSemester(s)}
                  >
                    <Text style={[styles.chipText, semester === s && styles.chipTextActive]}>SEM {s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Section</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {SECTIONS.map((sec) => (
                  <TouchableOpacity
                    key={sec}
                    style={[styles.chip, section === sec && styles.chipActive]}
                    onPress={() => setSection(sec)}
                  >
                    <Text style={[styles.chipText, section === sec && styles.chipTextActive]}>{sec}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={COLORS.textOnPrimary} />
            : <Text style={styles.buttonText}>
              {isStudent ? 'Save Profile' : 'Continue to Class Setup →'}
            </Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, marginTop: 6 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 13, fontSize: 16, color: COLORS.textPrimary,
  },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: 'center' },
  roleBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  roleBtnTextActive: { color: COLORS.textOnPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.textOnPrimary },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: COLORS.textOnPrimary, fontSize: 16, fontWeight: '700' },
})