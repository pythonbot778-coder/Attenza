import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
  Modal, FlatList,
} from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS }              from '../../constants/colors'
import { useAuthStore }        from '../../store/authStore'
import { createSubject }       from '../../api/subjectApi'
import { getClassMembers, ClassMemberRow } from '../../api/membersApi'
import { HomeStackParams }     from '../../navigation/CRNavigator'
import { validateTextField, validateRollRange, check } from '../../utils/validation'

type Props = {
  navigation: StackNavigationProp<HomeStackParams, 'CreateSubject'>
}

interface BatchInput {
  startRoll: string
  endRoll:   string
  manualMemberIds: string[]
}

export function CreateSubjectScreen({ navigation }: Props) {
  const { classId }   = useAuthStore()
  const isMutating    = useRef(false)

  const [name,    setName]    = useState('')
  const [faculty, setFaculty] = useState('')
  const [type,    setType]    = useState<'CLASS' | 'LAB'>('CLASS')
  const [batches, setBatches] = useState<BatchInput[]>([
    { startRoll: '', endRoll: '', manualMemberIds: [] },
    { startRoll: '', endRoll: '', manualMemberIds: [] },
  ])
  const [loading, setLoading] = useState(false)

  // Class members for manual selection
  const [classMembers, setClassMembers] = useState<ClassMemberRow[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerBatchIndex, setPickerBatchIndex] = useState<number>(0)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (type !== 'LAB' || !classId || classMembers.length > 0) return
    setMembersLoading(true)
    getClassMembers(classId)
      .then(setClassMembers)
      .catch(() => {})
      .finally(() => setMembersLoading(false))
  }, [type, classId])

  function updateBatch(index: number, field: 'startRoll' | 'endRoll', value: string) {
    const updated = [...batches]
    updated[index] = { ...updated[index], [field]: value.toUpperCase() }
    setBatches(updated)
  }

  function openPicker(batchIndex: number) {
    setPickerBatchIndex(batchIndex)
    setPickerSelected(new Set(batches[batchIndex].manualMemberIds))
    setPickerSearch('')
    setPickerOpen(true)
  }

  function togglePickerMember(id: string) {
    setPickerSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function confirmPicker() {
    const updated = [...batches]
    updated[pickerBatchIndex] = {
      ...updated[pickerBatchIndex],
      manualMemberIds: Array.from(pickerSelected),
    }
    setBatches(updated)
    setPickerOpen(false)
  }

  function removeManualMember(batchIndex: number, memberId: string) {
    const updated = [...batches]
    updated[batchIndex] = {
      ...updated[batchIndex],
      manualMemberIds: updated[batchIndex].manualMemberIds.filter(id => id !== memberId),
    }
    setBatches(updated)
  }

  // Members already manually added to the OTHER batch — disabled in current picker
  const otherBatchSelectedIds = new Set(
    batches.flatMap((b, i) => i === pickerBatchIndex ? [] : b.manualMemberIds)
  )

  const filteredPickerMembers = classMembers.filter(m => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return true
    return m.roll_number.toLowerCase().includes(q) ||
      (m.name?.toLowerCase().includes(q) ?? false)
  })

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
              manualMemberIds: b.manualMemberIds,
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

                {/* Manual additions */}
                <View style={styles.manualSection}>
                  <View style={styles.manualHeaderRow}>
                    <Text style={styles.manualTitle}>Add Manually</Text>
                    <TouchableOpacity
                      style={styles.manualAddBtn}
                      onPress={() => openPicker(i)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="person-add-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.manualAddBtnText}>Select Members</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.manualHint}>
                    For diploma/lateral-entry students whose rolls don't match the range.
                  </Text>
                  {batches[i].manualMemberIds.length > 0 ? (
                    <View style={styles.chipWrap}>
                      {batches[i].manualMemberIds.map((id) => {
                        const m = classMembers.find((x) => x.id === id)
                        const label = m
                          ? `${m.roll_number}${m.name ? ` · ${m.name.split(' ')[0]}` : ''}`
                          : id.slice(0, 6)
                        return (
                          <TouchableOpacity
                            key={id}
                            style={styles.chip}
                            onPress={() => removeManualMember(i, id)}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.chipText}>{label}</Text>
                            <Ionicons name="close" size={14} color={COLORS.textSecondary} />
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  ) : (
                    <Text style={styles.manualEmpty}>No manual members yet.</Text>
                  )}
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

      {/* Manual Member Picker Modal */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>
              Select Members for Batch {pickerBatchIndex + 1}
            </Text>
            <Text style={styles.pickerSub}>
              Only class members can be added. Students already in the other batch are disabled.
            </Text>

            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search roll or name…"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
              />
            </View>

            {membersLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
            ) : (
              <FlatList
                data={filteredPickerMembers}
                keyExtractor={(item) => item.id}
                style={styles.pickerList}
                contentContainerStyle={{ paddingBottom: 8 }}
                ListEmptyComponent={
                  <Text style={styles.pickerEmpty}>No members match your search.</Text>
                }
                renderItem={({ item }) => {
                  const disabled = otherBatchSelectedIds.has(item.id)
                  const selected = pickerSelected.has(item.id)
                  return (
                    <TouchableOpacity
                      style={[
                        styles.pickerRow,
                        selected && styles.pickerRowSelected,
                        disabled && styles.pickerRowDisabled,
                      ]}
                      onPress={() => !disabled && togglePickerMember(item.id)}
                      disabled={disabled}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.pickerCheck, selected && styles.pickerCheckOn]}>
                        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerRoll}>{item.roll_number}</Text>
                        <Text style={styles.pickerName}>
                          {item.name ?? 'Not joined yet'}
                          {disabled && ' · in other batch'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                }}
              />
            )}

            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={styles.pickerCancelBtn}
                onPress={() => setPickerOpen(false)}
              >
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickerConfirmBtn}
                onPress={confirmPicker}
              >
                <Text style={styles.pickerConfirmText}>
                  Add {pickerSelected.size > 0 ? `(${pickerSelected.size})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  manualSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  manualHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  manualTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  manualHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  manualEmpty: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  manualAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '12',
  },
  manualAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    height: '80%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  pickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  pickerSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    padding: 0,
  },
  pickerList: {
    flex: 1,
  },
  pickerEmpty: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 30,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '0E',
  },
  pickerRowDisabled: {
    opacity: 0.4,
  },
  pickerCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCheckOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pickerRoll: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  pickerName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  pickerCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  pickerCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  pickerConfirmBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  pickerConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
})