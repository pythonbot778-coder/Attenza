import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { COLORS }              from '../../constants/colors'
import { useAuthStore }        from '../../store/authStore'
import { createSubject }       from '../../api/subjectApi'
import { HomeStackParams }     from '../../navigation/CRNavigator'
import { validateTextField, validateRollRange, check } from '../../utils/validation'

type Props = {
  navigation: StackNavigationProp<HomeStackParams, 'CreateSubject'>
}

interface BatchInput {
  startRoll: string
  endRoll:   string
}

export function CreateSubjectScreen({ navigation }: Props) {
  const { classId }   = useAuthStore()
  const isMutating    = useRef(false)

  const [name,    setName]    = useState('')
  const [faculty, setFaculty] = useState('')
  const [type,    setType]    = useState<'CLASS' | 'LAB'>('CLASS')
  const [batches, setBatches] = useState<BatchInput[]>([
    { startRoll: '', endRoll: '' },
    { startRoll: '', endRoll: '' },
  ])
  const [loading, setLoading] = useState(false)

  function updateBatch(index: number, field: keyof BatchInput, value: string) {
    const updated = [...batches]
    updated[index] = { ...updated[index], [field]: value.toUpperCase() }
    setBatches(updated)
  }

  async function handleSave() {
    if (isMutating.current) return
    isMutating.current = true

    // ── Validation ────────────────────────────────────────────
    if (!check(validateTextField(name, 'Subject name'))) {
      isMutating.current = false; return
    }
    if (!check(validateTextField(faculty, 'Faculty name'))) {
      isMutating.current = false; return
    }
    if (!classId) {
      Alert.alert('Error', 'Class not found. Please restart the app.')
      isMutating.current = false; return
    }
    if (type === 'LAB') {
      for (let i = 0; i < 2; i++) {
        const b = batches[i]
        if (!check(validateRollRange(b.startRoll, b.endRoll))) {
          // prefix error with batch label
          const r = validateRollRange(b.startRoll, b.endRoll)
          Alert.alert(`Batch ${i + 1} Error`, r.error)
          isMutating.current = false; return
        }
      }
    }
    // ─────────────────────────────────────────────────────────

    setLoading(true)
    try {
      await createSubject({
        classId,
        name:        name.trim(),
        facultyName: faculty.trim(),
        type,
        batches: type === 'LAB'
          ? batches.map((b, i) => ({
              batchName: `Batch ${i + 1}`,
              startRoll: b.startRoll.trim(),
              endRoll:   b.endRoll.trim(),
            }))
          : undefined,
      })
      navigation.goBack()
    } catch (err: any) {
      const userMsg =
        err?.code?.startsWith('PGRST') ||
        err?.code?.startsWith('42') ||
        err?.code?.startsWith('23')
          ? 'Something went wrong. Please try again.'
          : err?.message ?? 'An unexpected error occurred.'
      Alert.alert('Error', userMsg)
    } finally {
      isMutating.current = false
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Subject</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Type Toggle */}
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'CLASS' && styles.typeBtnActive]}
            onPress={() => setType('CLASS')}
          >
            <Text style={[styles.typeBtnText, type === 'CLASS' && styles.typeBtnTextActive]}>🏫 Class</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'LAB' && styles.typeBtnActiveGreen]}
            onPress={() => setType('LAB')}
          >
            <Text style={[styles.typeBtnText, type === 'LAB' && styles.typeBtnTextActive]}>🔬 Lab</Text>
          </TouchableOpacity>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.label}>Subject Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Network Analysis"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="words"
            maxLength={100}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Faculty Name</Text>
          <TextInput
            style={styles.input}
            value={faculty}
            onChangeText={setFaculty}
            placeholder="e.g. Dr. Bhaskar"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="words"
            maxLength={100}
          />
        </View>

        {/* Lab Batches */}
        {type === 'LAB' && (
          <View style={styles.batchSection}>
            <Text style={styles.sectionTitle}>Lab Batches</Text>
            {[0, 1].map((i) => (
              <View key={i} style={styles.batchCard}>
                <View style={styles.batchHeader}>
                  <View style={[styles.batchBadge,
                    { backgroundColor: i === 0 ? COLORS.primary : COLORS.success }]}>
                    <Text style={styles.batchBadgeText}>Batch {i + 1}</Text>
                  </View>
                </View>
                <View style={styles.rollRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Start Roll</Text>
                    <TextInput
                      style={styles.input}
                      value={batches[i].startRoll}
                      onChangeText={(v) => updateBatch(i, 'startRoll', v)}
                      placeholder="e.g. 25ECE04131"
                      placeholderTextColor={COLORS.textMuted}
                      autoCapitalize="characters"
                      maxLength={15}
                    />
                  </View>
                  <Text style={styles.rollArrow}>→</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>End Roll</Text>
                    <TextInput
                      style={styles.input}
                      value={batches[i].endRoll}
                      onChangeText={(v) => updateBatch(i, 'endRoll', v)}
                      placeholder="e.g. 25ECE04165"
                      placeholderTextColor={COLORS.textMuted}
                      autoCapitalize="characters"
                      maxLength={15}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={COLORS.textOnPrimary} />
            : <Text style={styles.buttonText}>Save Subject</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 300 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backText:    { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  content:     { padding: 20, paddingBottom: 0 },
  typeRow:     { flexDirection: 'row', gap: 12, marginBottom: 20 },
  typeBtn:          { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: 'center' },
  typeBtnActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnActiveGreen:{ backgroundColor: COLORS.success, borderColor: COLORS.success },
  typeBtnText:      { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  typeBtnTextActive:{ color: COLORS.textOnPrimary },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 20,
  },
  label:  { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary,
  },
  batchSection:    { marginBottom: 20 },
  sectionTitle:    { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  batchCard:       { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  batchHeader:     { marginBottom: 12 },
  batchBadge:      { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  batchBadgeText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  rollRow:         { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rollArrow:       { fontSize: 18, color: COLORS.textMuted, paddingBottom: 12 },
  button:          { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  buttonDisabled:  { opacity: 0.5 },
  buttonText:      { color: COLORS.textOnPrimary, fontSize: 16, fontWeight: '700' },
})