import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { supabase } from '../../api/supabase'
import { ensureUserProfile } from '../../api/profile'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'
import { COLORS } from '../../constants/colors'
import { BRANCHES, type Branch } from '../../constants/branches'
import { SECTIONS, YEARS } from '../../constants/sections'

// Replace ProfileStackParams:
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
    if (!name.trim()) return Alert.alert('Error', 'Enter your full name')
    if (!rollNumber.trim()) return Alert.alert('Error', 'Enter your roll number')
    if (!role) return Alert.alert('Error', 'Select a role')

    // Branch/year/semester/section only required for CR/LR
    if (role !== 'STUDENT') {
      if (!branch) return Alert.alert('Error', 'Select your branch')
      if (!year) return Alert.alert('Error', 'Select your year')
      if (!semester) return Alert.alert('Error', 'Select your semester')
      if (!section) return Alert.alert('Error', 'Select your section')
    }

    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      const email = session?.user?.email ?? null
      if (!userId) return Alert.alert('Error', 'No session. Login again.')

      // Step 1 — Save basic profile to public.users
      const { error: userError } = await supabase
        .from('users')
        .upsert(
          { id: userId, name: name.trim(), email, role: role, mobile_number: mobile.trim() },
          { onConflict: 'id' }
        )
      if (userError) return Alert.alert('Error', userError.message)

      // Step 2 — Find existing class for this branch/year/sem/section (if CR/LR)
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

      // ── CR or LR path ─────────────────────────────────────────
      if (role === 'CR' || role === 'LR') {

        // No class exists yet — this person is first, go to class setup
        if (!classGroupId) {
          navigation.navigate('RollRangeSetup', {
            branch: branch,
            year: year,
            semester: semester,
            section: section,
            name: name.trim(),
            rollNumber: rollNumber.trim().toUpperCase(),
            role: role,
          })
          return
        }

        // Class already exists — claim their slot
        const { data: memberRow, error: memberFetchError } = await supabase
          .from('class_members')
          .select('id, role')
          .eq('class_id', classGroupId)
          .eq('roll_number', rollNumber.trim().toUpperCase())
          .is('user_id', null)
          .maybeSingle()

        if (memberFetchError) return Alert.alert('Error', memberFetchError.message)

        if (!memberRow) {
          return Alert.alert(
            'Roll Number Not Found',
            'Your roll number was not found in this class. Contact your partner CR/LR.',
          )
        }

        // Check if this role is already taken by someone else
        const { data: roleConflict } = await supabase
          .from('class_members')
          .select('id')
          .eq('class_id', classGroupId)
          .eq('role', role)
          .not('user_id', 'is', null)
          .maybeSingle()

        if (roleConflict) {
          return Alert.alert(
            `${role} Already Assigned`,
            `This class already has a ${role}. Contact your class if this is an error.`,
          )
        }

        // Claim the slot
        const { error: claimError } = await supabase
          .from('class_members')
          .update({
            user_id: userId,
            name: name.trim(),
            role: role,
            status: 'active',
          })
          .eq('id', memberRow.id)

        if (claimError) return Alert.alert('Error', claimError.message)

        // Refresh and go home
        await hydrateAuthState()
        return
      }

      // ── Student path ──────────────────────────────────────────
      if (role === 'STUDENT') {

        // Students don't provide class details, we just search all classes
        // to see if their roll number exists.
        const { data: memberRows, error: memberFetchError } = await supabase
          .from('class_members')
          .select('id, class_id')
          .eq('roll_number', rollNumber.trim().toUpperCase())
          .is('user_id', null)

        if (memberFetchError) return Alert.alert('Error', memberFetchError.message)

        if (!memberRows || memberRows.length === 0) {
          // Check if they already claimed a spot
          const { data: alreadyClaimed } = await supabase
            .from('class_members')
            .select('id')
            .eq('roll_number', rollNumber.trim().toUpperCase())
            .eq('user_id', userId)
            .maybeSingle()

          if (alreadyClaimed) {
            await hydrateAuthState()
            return
          }

          // Still save profile in users so they can come back
          await hydrateAuthState()
          Alert.alert(
            'Class Not Set Up Yet',
            "Your CR/LR hasn't set up the class yet. Contact them."
          )
          return
        }

        // Since roll numbers are globally unique in an institute, we just take the first match
        const targetMemberRow = memberRows[0]

        // Claim the slot
        const { error: claimError } = await supabase
          .from('class_members')
          .update({
            user_id: userId,
            name: name.trim(),
            status: 'active',
          })
          .eq('id', targetMemberRow.id)

        if (claimError) return Alert.alert('Error', claimError.message)

        await hydrateAuthState()
        return
      }

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Set Up Profile</Text>
          <Text style={styles.subtitle}>Tell us about yourself</Text>
        </View>

        {/* Role Selector */}
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

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Basic Info</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sree Vindyan"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Roll Number</Text>
          <TextInput
            style={styles.input}
            value={rollNumber}
            onChangeText={(t) => setRollNumber(t.toUpperCase())}
            placeholder="e.g. 25ECE04178"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Mobile Number <Text style={{ color: COLORS.textMuted, fontWeight: '400' }}>(optional)</Text></Text>
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

        {/* Class info — only shown for CR/LR */}
        {role !== 'STUDENT' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Branch</Text>
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
                  >
                    <Text style={[styles.chipText, branch === b && styles.chipTextActive]}>
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Year */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Year</Text>
              <View style={styles.chipRow}>
                {YEARS.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[styles.chip, year === y && styles.chipActive]}
                    onPress={() => setYear(y)}
                  >
                    <Text style={[styles.chipText, year === y && styles.chipTextActive]}>
                      Year {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Semester */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Semester</Text>
              <View style={styles.chipRow}>
                {[1, 2].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, semester === s && styles.chipActive]}
                    onPress={() => setSemester(s)}
                  >
                    <Text style={[styles.chipText, semester === s && styles.chipTextActive]}>
                      SEM {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Section</Text>
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
                  >
                    <Text style={[styles.chipText, section === sec && styles.chipTextActive]}>
                      {sec}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        {/* Submit */}
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
    </KeyboardAvoidingView >
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  header: { marginBottom: 32 },
  title: {
    fontSize: 28, fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 15, color: COLORS.textSecondary, marginTop: 6,
  },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  label: {
    fontSize: 14, fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 13, fontSize: 16,
    color: COLORS.textPrimary,
  },
  roleRow: {
    flexDirection: 'row', gap: 10,
  },
  roleBtn: {
    flex: 1, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  roleBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleBtnText: {
    fontSize: 13, fontWeight: '600',
    color: COLORS.textSecondary,
  },
  roleBtnTextActive: { color: COLORS.textOnPrimary },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 14, fontWeight: '600',
    color: COLORS.textSecondary,
  },
  chipTextActive: { color: COLORS.textOnPrimary },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: COLORS.textOnPrimary,
    fontSize: 16, fontWeight: '700',
  },
})