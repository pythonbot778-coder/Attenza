import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { createSubject } from '../../api/subjectApi'
import { useCacheStore } from '../../store/cacheStore'
import { getClassMembers, ClassMemberRow } from '../../api/membersApi'
import { HomeStackParams } from '../../navigation/CRNavigator'
import { validateTextField, validateRollRange } from '../../utils/validation'
import {
  showDialog,
  showErrorDialog,
  showSuccessDialog,
} from '../../store/dialogStore'

type Props = {
  navigation: StackNavigationProp<HomeStackParams, 'CreateSubject'>
}

interface BatchInput {
  startRoll: string
  endRoll: string
  manualMemberIds: string[]
}

export function CreateSubjectScreen({ navigation }: Props) {
  const { classId } = useAuthStore()
  const isMutating = useRef(false)

  const [name, setName] = useState('')
  const [faculty, setFaculty] = useState('')
  const [type, setType] = useState<'CLASS' | 'LAB'>('CLASS')
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
    setPickerSelected((prev) => {
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
      manualMemberIds: updated[batchIndex].manualMemberIds.filter((id) => id !== memberId),
    }
    setBatches(updated)
  }

  // Members already manually added to the other batch
  const otherBatchSelectedIds = new Set(
    batches.flatMap((b, i) => (i === pickerBatchIndex ? [] : b.manualMemberIds))
  )

  const filteredPickerMembers = classMembers.filter((m) => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return true
    return (
      m.roll_number.toLowerCase().includes(q) ||
      (m.name?.toLowerCase().includes(q) ?? false)
    )
  })

  async function handleSave() {
    if (isMutating.current) return
    isMutating.current = true

    // Validate Subject Name
    const nameVal = validateTextField(name, 'Subject name')
    if (!nameVal.valid) {
      showErrorDialog('Invalid Input', nameVal.error ?? 'Please provide a valid subject name.')
      isMutating.current = false
      return
    }

    // Validate Faculty Name
    const facultyVal = validateTextField(faculty, 'Faculty name')
    if (!facultyVal.valid) {
      showErrorDialog('Invalid Input', facultyVal.error ?? 'Please provide a faculty name.')
      isMutating.current = false
      return
    }

    if (!classId) {
      showErrorDialog('Class Not Found', 'Class session not found. Please restart the app.')
      isMutating.current = false
      return
    }

    if (type === 'LAB') {
      for (let i = 0; i < 2; i++) {
        const b = batches[i]
        const hasRange = b.startRoll.trim() !== '' || b.endRoll.trim() !== ''
        const hasManual = (b.manualMemberIds?.length ?? 0) > 0

        if (!hasRange && !hasManual) {
          showErrorDialog(
            `Batch ${i + 1} is empty`,
            'Enter a roll range or pick at least one member manually before saving.'
          )
          isMutating.current = false
          return
        }

        if (hasRange) {
          const r = validateRollRange(b.startRoll, b.endRoll)
          if (!r.valid) {
            showErrorDialog(`Batch ${i + 1} Error`, r.error ?? 'Invalid roll range.')
            isMutating.current = false
            return
          }
        }
      }
    }

    setLoading(true)
    try {
      const result = await createSubject({
        classId,
        name: name.trim(),
        facultyName: faculty.trim(),
        type,
        batches:
          type === 'LAB'
            ? batches.map((b, i) => ({
                batchName: `Batch ${i + 1}`,
                startRoll: b.startRoll.trim(),
                endRoll: b.endRoll.trim(),
                manualMemberIds: b.manualMemberIds,
              }))
            : undefined,
      })

      useCacheStore.getState().invalidateSubjects()

      if (result.manualAddIssues.length > 0) {
        const lines = result.manualAddIssues
          .map((i) => `• ${i.batchName}: ${i.error}`)
          .join('\n')
        showDialog({
          type: 'warning',
          title: 'Subject Saved — Manual Members Pending',
          message:
            `The subject and lab batches were created, but some manual member ` +
            `additions could not be applied:\n\n${lines}\n\nYou can re-add them from the batch later.`,
          buttons: [
            {
              text: 'OK',
              style: 'primary',
              onPress: () => navigation.goBack(),
            },
          ],
        })
      } else {
        showSuccessDialog(
          'Subject Created',
          `"${name.trim()}" has been successfully added to your subject list.`,
          () => navigation.goBack()
        )
      }
    } catch (err: any) {
      const userMsg =
        err?.code?.startsWith('PGRST') ||
        err?.code?.startsWith('42') ||
        err?.code?.startsWith('23')
          ? 'Something went wrong while saving subject. Please try again.'
          : err?.message ?? 'An unexpected error occurred.'

      showErrorDialog('Create Subject Failed', userMsg)
    } finally {
      isMutating.current = false
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Subject</Text>
          <TouchableOpacity
            style={[styles.headerSaveBtn, loading && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.headerSaveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Subject Type Segmented Cards */}
          <Text style={styles.sectionHeader}>Subject Type</Text>
          <View style={styles.typeSelectorRow}>
            <TouchableOpacity
              style={[
                styles.typeCard,
                type === 'CLASS' && styles.typeCardActiveClass,
              ]}
              onPress={() => setType('CLASS')}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.typeIconCircle,
                  type === 'CLASS' && styles.typeIconCircleActiveClass,
                ]}
              >
                <Ionicons
                  name="school-outline"
                  size={20}
                  color={type === 'CLASS' ? '#fff' : COLORS.primary}
                />
              </View>
              <Text
                style={[
                  styles.typeCardTitle,
                  type === 'CLASS' && styles.typeCardTitleActive,
                ]}
              >
                Theory Class
              </Text>
              <Text style={styles.typeCardDesc}>
                Full class attendance
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeCard,
                type === 'LAB' && styles.typeCardActiveLab,
              ]}
              onPress={() => setType('LAB')}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.typeIconCircle,
                  type === 'LAB' && styles.typeIconCircleActiveLab,
                ]}
              >
                <Ionicons
                  name="flask-outline"
                  size={20}
                  color={type === 'LAB' ? '#fff' : COLORS.success}
                />
              </View>
              <Text
                style={[
                  styles.typeCardTitle,
                  type === 'LAB' && styles.typeCardTitleActive,
                ]}
              >
                Practical Lab
              </Text>
              <Text style={styles.typeCardDesc}>
                Split into 2 batches
              </Text>
            </TouchableOpacity>
          </View>

          {/* Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>General Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Subject Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="book-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Operating Systems"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  maxLength={100}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text style={styles.inputLabel}>Faculty / Professor Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={faculty}
                  onChangeText={setFaculty}
                  placeholder="e.g. Dr. K. Ramanathan"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  maxLength={80}
                />
              </View>
            </View>
          </View>

          {/* Lab Batches Section */}
          {type === 'LAB' && (
            <View style={styles.labSection}>
              <View style={styles.labHeaderRow}>
                <Text style={styles.sectionHeader}>Lab Batches Configuration</Text>
                <View style={styles.labPill}>
                  <Text style={styles.labPillText}>2 Batches Required</Text>
                </View>
              </View>

              <Text style={styles.labNote}>
                Specify roll ranges or manually select students for Batch 1 and Batch 2.
              </Text>

              {batches.map((batch, i) => (
                <View key={i} style={styles.batchCard}>
                  <View style={styles.batchHeader}>
                    <View style={styles.batchBadge}>
                      <Text style={styles.batchBadgeText}>Batch {i + 1}</Text>
                    </View>
                    <Text style={styles.batchCountHint}>
                      {batch.manualMemberIds.length > 0
                        ? `${batch.manualMemberIds.length} manual student(s)`
                        : 'Roll Range Based'}
                    </Text>
                  </View>

                  <Text style={styles.inputSubLabel}>Roll Number Range</Text>
                  <View style={styles.rangeRow}>
                    <TextInput
                      style={[styles.rangeInput, { flex: 1 }]}
                      placeholder="Start Roll"
                      placeholderTextColor={COLORS.textMuted}
                      value={batch.startRoll}
                      onChangeText={(v) => updateBatch(i, 'startRoll', v)}
                      autoCapitalize="characters"
                    />
                    <Text style={styles.rangeArrow}>→</Text>
                    <TextInput
                      style={[styles.rangeInput, { flex: 1 }]}
                      placeholder="End Roll"
                      placeholderTextColor={COLORS.textMuted}
                      value={batch.endRoll}
                      onChangeText={(v) => updateBatch(i, 'endRoll', v)}
                      autoCapitalize="characters"
                    />
                  </View>

                  {/* Manual Members Section */}
                  <View style={styles.manualSection}>
                    <View style={styles.manualHeader}>
                      <Text style={styles.inputSubLabel}>Manual Students</Text>
                      <TouchableOpacity
                        style={styles.pickMembersBtn}
                        onPress={() => openPicker(i)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle-outline" size={15} color={COLORS.primary} />
                        <Text style={styles.pickMembersBtnText}>Pick Students</Text>
                      </TouchableOpacity>
                    </View>

                    {batch.manualMemberIds.length > 0 ? (
                      <View style={styles.chipsWrap}>
                        {batch.manualMemberIds.map((id) => {
                          const m = classMembers.find((cm) => cm.id === id)
                          const label = m ? `${m.roll_number}${m.name ? ` (${m.name})` : ''}` : id
                          return (
                            <View key={id} style={styles.memberChip}>
                              <Text style={styles.chipText} numberOfLines={1}>
                                {label}
                              </Text>
                              <TouchableOpacity
                                onPress={() => removeManualMember(i, id)}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                              </TouchableOpacity>
                            </View>
                          )
                        })}
                      </View>
                    ) : (
                      <Text style={styles.noManualText}>No manual students added to Batch {i + 1}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Bottom Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.submitBtnInner}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Create Subject</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Manual Member Selection Sheet Modal */}
        <Modal
          visible={pickerOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setPickerOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={styles.modalTitle}>Select Batch {pickerBatchIndex + 1} Students</Text>
                  <Text style={styles.modalSubTitle}>
                    {pickerSelected.size} student(s) selected
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setPickerOpen(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalSearchBox}>
                <Ionicons name="search" size={17} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search students..."
                  placeholderTextColor={COLORS.textMuted}
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                />
              </View>

              {membersLoading ? (
                <View style={styles.modalLoader}>
                  <ActivityIndicator color={COLORS.primary} size="large" />
                </View>
              ) : (
                <FlatList
                  data={filteredPickerMembers}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.pickerList}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isSelected = pickerSelected.has(item.id)
                    const isOther = otherBatchSelectedIds.has(item.id)
                    return (
                      <TouchableOpacity
                        style={[
                          styles.pickerItem,
                          isSelected && styles.pickerItemSelected,
                          isOther && styles.pickerItemDisabled,
                        ]}
                        onPress={() => !isOther && togglePickerMember(item.id)}
                        disabled={isOther}
                        activeOpacity={0.7}
                      >
                        <View style={styles.pickerItemLeft}>
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && styles.checkboxSelected,
                              isOther && styles.checkboxDisabled,
                            ]}
                          >
                            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                          </View>
                          <View>
                            <Text style={[styles.pickerRoll, isOther && { color: COLORS.textMuted }]}>
                              {item.roll_number}
                            </Text>
                            {item.name ? (
                              <Text style={styles.pickerName}>{item.name}</Text>
                            ) : null}
                          </View>
                        </View>
                        {isOther && (
                          <View style={styles.otherBatchTag}>
                            <Text style={styles.otherBatchTagText}>In Other Batch</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  }}
                  ListEmptyComponent={
                    <Text style={styles.pickerEmpty}>No students found</Text>
                  }
                />
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalDoneBtn}
                  onPress={confirmPicker}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalDoneBtnText}>Confirm Selection ({pickerSelected.size})</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerSaveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: 'center',
  },
  headerSaveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  typeCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  typeCardActiveClass: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  typeCardActiveLab: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success + '08',
  },
  typeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeIconCircleActiveClass: {
    backgroundColor: COLORS.primary,
  },
  typeIconCircleActiveLab: {
    backgroundColor: COLORS.success,
  },
  typeCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  typeCardTitleActive: {
    fontWeight: '900',
  },
  typeCardDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  inputGroup: {},
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  labSection: {
    marginBottom: 18,
  },
  labHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  labPill: {
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  labPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
  },
  labNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  batchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  batchBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  batchBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  batchCountHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  inputSubLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  rangeInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  rangeArrow: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  manualSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 12,
  },
  manualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickMembersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickMembersBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  chipText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  noManualText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalSubTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  modalLoader: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  pickerList: {
    paddingBottom: 16,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  pickerItemSelected: {
    backgroundColor: COLORS.primary + '10',
  },
  pickerItemDisabled: {
    opacity: 0.5,
  },
  pickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.borderLight,
  },
  pickerRoll: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  pickerName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  otherBatchTag: {
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  otherBatchTagText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  pickerEmpty: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 14,
    paddingVertical: 24,
  },
  modalActions: {
    marginTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  modalDoneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
})
