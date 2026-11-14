import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { COLORS } from '../../constants/colors'
import { generateRollRange } from '../../utils/rollNumberUtils'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { createClassWithMembers } from '../../api/classApi'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'
import { validateRollRange, check } from '../../utils/validation'
import { showDialog, showErrorDialog } from '../../store/dialogStore'

type Props = {
  navigation: StackNavigationProp<AuthStackParams, 'RollRangeSetup'>
  route: RouteProp<AuthStackParams, 'RollRangeSetup'>
}

export function RollRangeSetupScreen({ navigation, route }: Props) {
  const { userId } = useAuthStore()
  const { branch, year, semester, section, name, rollNumber, role } = route.params

  const [startRoll, setStartRoll] = useState('')
  const [endRoll, setEndRoll] = useState('')
  const [preview, setPreview] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  function handlePreview() {
    const start = startRoll.trim().toUpperCase()
    const end = endRoll.trim().toUpperCase()

    if (!check(validateRollRange(start, end))) return

    const rolls = generateRollRange(start, end)
    if (rolls.length === 0) {
      showErrorDialog('Invalid Range', 'Starting roll must come before ending roll.')
      return
    }
    setPreview(rolls)
  }

  async function handleSave() {
    if (preview.length === 0) {
      showDialog({
        type: 'info',
        title: 'Preview Required',
        message: 'Tap "Preview Student List" to inspect the roll range before creating your class.',
      })
      return
    }
    if (!userId || !name || !rollNumber) {
      showErrorDialog('Profile Missing', 'User data is missing. Please go back and re-enter your profile.')
      return
    }

    const start = startRoll.trim().toUpperCase()
    const end = endRoll.trim().toUpperCase()
    const roll = rollNumber.trim().toUpperCase()

    if (!preview.includes(roll)) {
      showDialog({
        type: 'warning',
        title: 'Roll Number Outside Range',
        message: `Your roll number (${roll}) is not within the declared class range (${start} → ${end}).\n\nPlease correct the roll range or your profile roll number.`,
      })
      return
    }

    setLoading(true)
    try {
      const result = await createClassWithMembers({
        userId,
        branch,
        year: Number(year),
        semester: Number(semester),
        section,
        startRoll: start,
        endRoll: end,
        role: role as 'CR' | 'LR',
        userName: name,
        userRoll: roll,
      })

      if (result.error === 'CR_EXISTS') {
        showDialog({
          type: 'warning',
          title: 'CR Already Exists',
          message: result.message,
        })
        return
      }

      showDialog({
        type: 'success',
        title: 'Class Created!',
        message: `${preview.length} student rolls registered. Welcome to your class dashboard!`,
        buttons: [
          {
            text: 'Continue →',
            style: 'primary',
            onPress: async () => {
              await hydrateAuthState()
            },
          },
        ],
      })
    } catch (err: any) {
      const realMsg = err?.message ?? JSON.stringify(err)
      const code = err?.code ?? ''

      if (__DEV__) {
        showErrorDialog('Error (Dev)', `Code: ${code}\n\n${realMsg}`)
      } else {
        const userMsg =
          code.startsWith('PGRST') ||
          code.startsWith('42') ||
          code.startsWith('23')
            ? 'Something went wrong while setting up the class. Please try again.'
            : realMsg || 'An unexpected error occurred.'
        showErrorDialog('Error', userMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  const userRollNorm = rollNumber.trim().toUpperCase()

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="people-outline" size={30} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Class Setup</Text>
          <Text style={styles.subtitle}>
            Define your class roll number range. Attendance will be tracked for these students.
          </Text>
        </View>

        {/* Class Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.roleTag}>
              <Ionicons name="ribbon-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.roleTagText}>{role}</Text>
            </View>
            <Text style={styles.userNameText} numberOfLines={1}>{name}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaPill}>{branch}</Text>
            <Text style={styles.metaPill}>Year {year}</Text>
            <Text style={styles.metaPill}>SEM {semester}</Text>
            <Text style={styles.metaPill}>Sec {section}</Text>
          </View>
        </View>

        {/* Input Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Roll Number Boundaries</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Starting Roll Number</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="barcode-outline"
                size={20}
                color={COLORS.textSecondary}
                style={styles.inputPrefixIcon}
              />
              <TextInput
                style={styles.input}
                value={startRoll}
                onChangeText={(t) => {
                  setStartRoll(t.toUpperCase())
                  setPreview([])
                }}
                placeholder="e.g. 25ECE04131"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
                maxLength={15}
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Ending Roll Number</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="barcode-outline"
                size={20}
                color={COLORS.textSecondary}
                style={styles.inputPrefixIcon}
              />
              <TextInput
                style={styles.input}
                value={endRoll}
                onChangeText={(t) => {
                  setEndRoll(t.toUpperCase())
                  setPreview([])
                }}
                placeholder="e.g. 25ECE04198"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
                maxLength={15}
                editable={!loading}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.previewBtn}
            onPress={handlePreview}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Ionicons name="eye-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.previewBtnText}>Preview Student List</Text>
          </TouchableOpacity>
        </View>

        {/* Preview List Card */}
        {preview.length > 0 && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.previewBadge}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} style={{ marginRight: 6 }} />
                <Text style={styles.previewTitle}>{preview.length} Students</Text>
              </View>
              <Text style={styles.previewRange}>{startRoll} → {endRoll}</Text>
            </View>

            <View style={styles.grid}>
              {preview.map((r) => {
                const isUserRoll = r === userRollNorm
                return (
                  <View
                    key={r}
                    style={[
                      styles.gridItem,
                      isUserRoll && styles.gridItemHighlight,
                    ]}
                  >
                    <Text
                      style={[
                        styles.gridText,
                        isUserRoll && styles.gridTextHighlight,
                      ]}
                    >
                      {r.slice(-3)}
                    </Text>
                    {isUserRoll && <Text style={styles.youBadge}>YOU</Text>}
                  </View>
                )
              })}
            </View>

            <Text style={styles.gridHint}>
              Showing last 3 digits of each roll. Your roll number is highlighted.
            </Text>
          </View>
        )}

        {/* Save Button */}
        {preview.length > 0 && (
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textOnPrimary} />
            ) : (
              <View style={styles.buttonInner}>
                <Text style={styles.buttonText}>Confirm & Create Class</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={COLORS.textOnPrimary}
                  style={{ marginLeft: 6 }}
                />
              </View>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 24,
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
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginRight: 10,
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  userNameText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
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
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    paddingVertical: 13,
  },
  previewBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  previewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  previewRange: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  gridItem: {
    width: 54,
    height: 42,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemHighlight: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  gridText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  gridTextHighlight: {
    color: '#FFFFFF',
  },
  youBadge: {
    fontSize: 8,
    fontWeight: '800',
    color: '#E0E7FF',
    marginTop: -2,
  },
  gridHint: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginTop: 14,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
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
