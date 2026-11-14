import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { useAuthStore } from '../../../store/authStore'
import { getClassMembers, addCustomClassMembers, ClassMemberRow } from '../../../api/membersApi'
import { initiateRoleTransfer } from '../../../api/roleTransferApi'
import { generateRollRange } from '../../../utils/rollNumberUtils'
import {
  showDialog,
  showErrorDialog,
  showSuccessDialog,
  showConfirmDialog,
} from '../../../store/dialogStore'

export function ClassManagementTab() {
  const { classId, userId, role: myRole } = useAuthStore()
  const [members, setMembers] = useState<ClassMemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Add members modal state
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [addMode, setAddMode] = useState<'manual' | 'range'>('manual')
  const [rollInput, setRollInput] = useState('')
  const [startRoll, setStartRoll] = useState('')
  const [endRoll, setEndRoll] = useState('')
  const [previewRolls, setPreviewRolls] = useState<string[]>([])
  const [adding, setAdding] = useState(false)

  function closeAddModal() {
    setAddModalVisible(false)
    setAddMode('manual')
    setRollInput('')
    setStartRoll('')
    setEndRoll('')
    setPreviewRolls([])
  }

  function handlePreviewRange() {
    const s = startRoll.trim().toUpperCase()
    const e = endRoll.trim().toUpperCase()
    if (!s || !e) {
      showErrorDialog('Missing Input', 'Enter both start and end roll numbers to preview range.')
      return
    }
    const rolls = generateRollRange(s, e)
    if (rolls.length === 0) {
      showErrorDialog('Invalid Range', 'Start roll must come before end roll with the same prefix.')
      return
    }
    setPreviewRolls(rolls)
  }

  async function handleAddMembers() {
    if (!classId) return

    let rolls: string[] = []
    if (addMode === 'manual') {
      rolls = rollInput
        .split(/[\n,]+/)
        .map((r) => r.trim().toUpperCase())
        .filter((r) => r.length > 0)
    } else {
      if (previewRolls.length === 0) {
        showErrorDialog('Preview First', 'Tap "Preview Range" before adding to review the roll list.')
        return
      }
      rolls = previewRolls
    }

    const beforeDedup = rolls.length
    rolls = Array.from(new Set(rolls))
    const duplicateCount = beforeDedup - rolls.length

    if (rolls.length === 0) {
      showErrorDialog('Empty Input', 'Enter at least one valid roll number.')
      return
    }

    try {
      setAdding(true)
      const result = await addCustomClassMembers(classId, rolls)
      closeAddModal()
      await loadMembers()

      const lines: string[] = []
      if (result.added > 0) lines.push(`• ${result.added} member(s) added successfully`)
      if (duplicateCount > 0) lines.push(`• ${duplicateCount} duplicate roll(s) in input ignored`)
      if (result.skipped_same_class > 0) lines.push(`• ${result.skipped_same_class} already registered in this class`)
      if (result.skipped_other_class > 0) {
        lines.push(
          `• ${result.skipped_other_class} active in another class:\n  ${result.other_class_conflicts.join(', ')}`
        )
      }

      showDialog({
        type: result.added > 0 ? 'success' : 'info',
        title: result.added > 0 ? 'Members Added' : 'No Members Added',
        message: lines.join('\n') || 'No members were added.',
      })
    } catch (e: any) {
      showErrorDialog('Failed to Add Members', e?.message ?? 'Could not add members. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  const loadMembers = useCallback(async () => {
    if (!classId) return

    try {
      const data = await getClassMembers(classId)
      setMembers(data)
    } catch (e: any) {
      const userMsg =
        e?.code?.startsWith('PGRST') ||
        e?.code?.startsWith('42') ||
        e?.code?.startsWith('23')
          ? 'Something went wrong while fetching members. Please try again.'
          : e?.message ?? 'An unexpected error occurred.'

      showErrorDialog('Error Loading Members', userMsg)
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  function handleLongPress(member: ClassMemberRow) {
    if (!member.user_id) {
      showDialog({
        type: 'warning',
        title: 'Cannot Assign Role',
        message: 'This student has not joined the app yet. They must log in before receiving a leadership role.',
      })
      return
    }

    if (member.user_id === userId) return

    if (member.role === 'CR' || member.role === 'LR') {
      showDialog({
        type: 'info',
        title: 'Already Assigned',
        message: `This student is already a ${member.role}.`,
      })
      return
    }

    const targetRole = myRole

    showConfirmDialog(
      `Transfer ${targetRole} Role?`,
      `Do you want to nominate ${member.name ?? member.roll_number} as the new ${targetRole}?\n\nThey will need to accept this request upon their next login.`,
      async () => {
        try {
          await initiateRoleTransfer({
            classId: classId!,
            fromUserId: userId!,
            toUserId: member.user_id!,
            role: targetRole as 'CR' | 'LR',
          })

          showSuccessDialog(
            'Transfer Request Sent',
            `A role transfer request for ${targetRole} has been sent to ${member.name ?? member.roll_number}.`
          )
        } catch (e: any) {
          const userMsg =
            e?.code?.startsWith('PGRST') ||
            e?.code?.startsWith('42') ||
            e?.code?.startsWith('23')
              ? 'Something went wrong while initiating role transfer.'
              : e?.message ?? 'An unexpected error occurred.'

          showErrorDialog('Transfer Error', userMsg)
        }
      },
      undefined,
      `Assign as ${targetRole}`,
      'Cancel'
    )
  }

  // Filter members by search
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) =>
        m.roll_number.toLowerCase().includes(q) ||
        (m.name?.toLowerCase().includes(q) ?? false)
    )
  }, [members, searchQuery])

  // Summary stats
  const stats = useMemo(() => {
    const total = members.length
    const joined = members.filter((m) => !!m.user_id).length
    const crCount = members.filter((m) => m.role === 'CR').length
    const lrCount = members.filter((m) => m.role === 'LR').length
    return { total, joined, crCount, lrCount }
  }, [members])

  const renderItem = useCallback(
    ({ item }: { item: ClassMemberRow }) => {
      const hasJoined = !!item.user_id
      const isMe = item.user_id === userId

      return (
        <TouchableOpacity
          style={styles.memberCard}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={350}
          activeOpacity={0.75}
        >
          <View style={styles.memberLeft}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: hasJoined ? COLORS.primary + '15' : COLORS.borderLight },
              ]}
            >
              <Text
                style={[
                  styles.avatarInitial,
                  { color: hasJoined ? COLORS.primary : COLORS.textMuted },
                ]}
              >
                {item.roll_number.slice(-3)}
              </Text>
              <View
                style={[
                  styles.statusBadgeDot,
                  { backgroundColor: hasJoined ? COLORS.success : COLORS.textMuted },
                ]}
              />
            </View>

            <View style={styles.memberInfo}>
              <Text style={styles.memberRoll}>{item.roll_number}</Text>
              {hasJoined && item.name ? (
                <Text style={styles.memberName} numberOfLines={1}>
                  {item.name}
                  {isMe ? ' (You)' : ''}
                </Text>
              ) : (
                <Text style={styles.memberNotJoined}>Not registered yet</Text>
              )}
            </View>
          </View>

          <View style={styles.memberRight}>
            {item.role !== 'STUDENT' ? (
              <View
                style={[
                  styles.memberRoleBadge,
                  {
                    backgroundColor:
                      item.role === 'CR' ? COLORS.crLight : COLORS.lrLight,
                    borderColor:
                      item.role === 'CR' ? COLORS.crBorder : COLORS.lrBorder,
                    borderWidth: 1,
                  },
                ]}
              >
                <Ionicons
                  name={item.role === 'CR' ? "shield-checkmark" : "sparkles"}
                  size={11}
                  color={item.role === 'CR' ? COLORS.crColor : COLORS.lrColor}
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={[
                    styles.memberRoleBadgeText,
                    { color: item.role === 'CR' ? COLORS.crColor : COLORS.lrColor },
                  ]}
                >
                  {item.role}
                </Text>
              </View>
            ) : (
              <View style={styles.studentBadge}>
                <Text style={styles.studentBadgeText}>STUDENT</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      )
    },
    [userId, myRole]
  )

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Loading class roster...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Top Banner & Quick Stats */}
      <View style={styles.statsBanner}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.joined}</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.crColor }]}>{stats.crCount + stats.lrCount}</Text>
          <Text style={styles.statLabel}>CR / LR</Text>
        </View>
      </View>

      {/* Action Header & Search */}
      <View style={styles.actionHeader}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by roll number or name..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.addMembersBtn}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="person-add" size={15} color="#fff" />
          <Text style={styles.addMembersBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Instruction Tip */}
      <View style={styles.instructionStrip}>
        <Ionicons name="information-circle-outline" size={14} color={COLORS.primary} />
        <Text style={styles.instructionText}>
          Long-press any joined student to transfer your {myRole} role.
        </Text>
      </View>

      {/* Member List */}
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={44} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching students' : 'No class members yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try searching with a different roll number or name'
                : 'Tap "Add" above to register students manually or by roll range'}
            </Text>
          </View>
        }
      />

      {/* Add Members Modal Bottom Sheet */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeAddModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Add Class Members</Text>
                <Text style={styles.modalSub}>Register students into your class roster</Text>
              </View>
              <TouchableOpacity onPress={closeAddModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modePills}>
              <TouchableOpacity
                style={[styles.modePill, addMode === 'manual' && styles.modePillActive]}
                onPress={() => setAddMode('manual')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="keypad-outline"
                  size={15}
                  color={addMode === 'manual' ? '#fff' : COLORS.textSecondary}
                />
                <Text style={[styles.modePillText, addMode === 'manual' && styles.modePillTextActive]}>
                  Manual Entry
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modePill, addMode === 'range' && styles.modePillActive]}
                onPress={() => setAddMode('range')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="git-commit-outline"
                  size={15}
                  color={addMode === 'range' ? '#fff' : COLORS.textSecondary}
                />
                <Text style={[styles.modePillText, addMode === 'range' && styles.modePillTextActive]}>
                  Roll Range
                </Text>
              </TouchableOpacity>
            </View>

            {addMode === 'manual' ? (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Enter Roll Numbers</Text>
                <Text style={styles.modalHint}>
                  Separate multiple roll numbers with commas or line breaks.
                </Text>
                <TextInput
                  style={styles.modalTextArea}
                  value={rollInput}
                  onChangeText={(t) => setRollInput(t.toUpperCase())}
                  placeholder={'25ECE04200\n25ECE04201, 25ECE04202'}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={4}
                  autoCapitalize="characters"
                  textAlignVertical="top"
                />
              </View>
            ) : (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Range Parameters</Text>
                <Text style={styles.modalHint}>
                  Provide start and end roll numbers sharing the same prefix.
                </Text>
                <View style={styles.rangeRow}>
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    value={startRoll}
                    onChangeText={(t) => {
                      setStartRoll(t.toUpperCase())
                      setPreviewRolls([])
                    }}
                    placeholder="e.g. 25ECE04201"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="characters"
                  />
                  <Ionicons name="arrow-forward" size={18} color={COLORS.textMuted} />
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    value={endRoll}
                    onChangeText={(t) => {
                      setEndRoll(t.toUpperCase())
                      setPreviewRolls([])
                    }}
                    placeholder="e.g. 25ECE04260"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
                <TouchableOpacity
                  style={styles.previewBtn}
                  onPress={handlePreviewRange}
                  activeOpacity={0.85}
                >
                  <Ionicons name="eye-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.previewBtnText}>Preview Range</Text>
                </TouchableOpacity>

                {previewRolls.length > 0 && (
                  <View style={styles.previewCard}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                    <Text style={styles.previewCount}>
                      {previewRolls.length} roll number(s) generated ({previewRolls[0]} ...{' '}
                      {previewRolls[previewRolls.length - 1]})
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={closeAddModal}
                disabled={adding}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAddBtn, adding && { opacity: 0.6 }]}
                onPress={handleAddMembers}
                disabled={adding}
                activeOpacity={0.85}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View style={styles.modalAddInner}>
                    <Ionicons name="checkmark" size={17} color="#fff" />
                    <Text style={styles.modalAddText}>Confirm & Add</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.borderLight,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 6,
  },
  addMembersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addMembersBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  instructionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  instructionText: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '600',
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusBadgeDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  memberInfo: {
    flex: 1,
  },
  memberRoll: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  memberNotJoined: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  memberRight: {
    marginLeft: 8,
  },
  memberRoleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  memberRoleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  studentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.borderLight,
  },
  studentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
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
    padding: 22,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modePills: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  modePillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modePillTextActive: {
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  modalTextArea: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    minHeight: 100,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  previewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: COLORS.success + '12',
    borderWidth: 1,
    borderColor: COLORS.success + '30',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewCount: {
    fontSize: 13,
    color: COLORS.success,
    fontWeight: '600',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modalAddBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modalAddInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalAddText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
})
