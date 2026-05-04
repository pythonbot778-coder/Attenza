import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp }           from '@react-navigation/native'
import { COLORS }              from '../../constants/colors'
import { generateRollRange }   from '../../utils/rollNumberUtils'
import { AuthStackParams }     from '../../navigation/AuthNavigator'
import { createClassWithMembers } from '../../api/classApi'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'

type Props = {
  navigation: StackNavigationProp<AuthStackParams, 'RollRangeSetup'>
  route:      RouteProp<AuthStackParams, 'RollRangeSetup'>
}

export function RollRangeSetupScreen({ navigation, route }: Props) {
  const { userId } = useAuthStore()
  const { branch, year, semester, section, name, rollNumber, role } = route.params

  const [startRoll, setStartRoll] = useState('')
  const [endRoll,   setEndRoll]   = useState('')
  const [preview,   setPreview]   = useState<string[]>([])
  const [loading,   setLoading]   = useState(false)

  function handlePreview() {
    const start = startRoll.trim().toUpperCase()
    const end   = endRoll.trim().toUpperCase()

    if (!start || !end) {
      Alert.alert('Required', 'Enter both start and end roll numbers.')
      return
    }

    const rolls = generateRollRange(start, end)
    if (rolls.length === 0) {
      Alert.alert('Invalid Range', 'Start roll must come before end roll.')
      return
    }
    if (rolls.length > 200) {
      Alert.alert('Too Large', 'Class size cannot exceed 200 students.')
      return
    }

    setPreview(rolls)
  }

  async function handleSave() {
    if (preview.length === 0) {
      Alert.alert('Preview First', 'Tap "Preview List" before saving.')
      return
    }

    if (!userId || !name || !rollNumber) {
      Alert.alert('Error', 'User data missing. Please go back and re-enter profile.')
      return
    }

    setLoading(true)
    try {
      const result = await createClassWithMembers({
        userId,
        branch,
        year:      Number(year),
        semester:  Number(semester),
        section,
        startRoll: startRoll.trim().toUpperCase(),
        endRoll:   endRoll.trim().toUpperCase(),
        role:      role as 'CR' | 'LR',
        userName:  name,
        userRoll:  rollNumber,
      })

      if (result.error === 'CR_EXISTS') {
        Alert.alert('CR Already Exists', result.message)
        return
      }

      await hydrateAuthState()
      Alert.alert('✅ Class Created!', `${preview.length} students added.`)
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Class Setup</Text>
          <Text style={styles.subtitle}>
            Define your class roll number range.{'\n'}
            All attendance will be within this range.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>{branch} • Year {year} • SEM {semester} • Sec {section}</Text>
          <Text style={styles.infoText}>{role} • {name} • {rollNumber}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Starting Roll Number</Text>
          <TextInput
            style={styles.input}
            value={startRoll}
            onChangeText={(t) => { setStartRoll(t.toUpperCase()); setPreview([]) }}
            placeholder="e.g. 25ECE04131"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Ending Roll Number</Text>
          <TextInput
            style={styles.input}
            value={endRoll}
            onChangeText={(t) => { setEndRoll(t.toUpperCase()); setPreview([]) }}
            placeholder="e.g. 25ECE04198"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
          />

          <TouchableOpacity
            style={styles.previewBtn}
            onPress={handlePreview}
            activeOpacity={0.85}
          >
            <Text style={styles.previewBtnText}>Preview List</Text>
          </TouchableOpacity>
        </View>

        {preview.length > 0 && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>✅ {preview.length} Students Found</Text>
              <Text style={styles.previewRange}>{startRoll} → {endRoll}</Text>
            </View>
            <View style={styles.grid}>
              {preview.map((r) => (
                <View key={r} style={styles.gridItem}>
                  <Text style={styles.gridText}>{r.slice(-3)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {preview.length > 0 && (
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.textOnPrimary} />
              : <Text style={styles.buttonText}>Confirm & Continue →</Text>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { padding: 24, paddingTop: 60 },
  header:    { marginBottom: 28 },
  title:    { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, marginTop: 8, lineHeight: 22 },
  infoCard: {
    backgroundColor: COLORS.primary + '12',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.primary + '30',
    marginBottom: 20, gap: 4,
  },
  infoText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 20,
  },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 13, fontSize: 16, color: COLORS.textPrimary,
  },
  previewBtn: {
    marginTop: 20, borderWidth: 1.5,
    borderColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  previewBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  previewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 20,
  },
  previewHeader: { marginBottom: 16 },
  previewTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  previewRange:  { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: {
    width: 52, height: 36,
    backgroundColor: COLORS.primaryLight + '22',
    borderRadius: 8, borderWidth: 1,
    borderColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  gridText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12, paddingVertical: 15, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: COLORS.textOnPrimary, fontSize: 16, fontWeight: '700' },
})