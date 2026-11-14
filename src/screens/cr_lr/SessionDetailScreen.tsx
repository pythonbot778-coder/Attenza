import React, { useCallback, useState } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, ActivityIndicator, Share, Dimensions,
    Modal,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { HistoryStackParams } from '../../navigation/CRNavigator'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { getDisplayRoll } from '../../utils/rollNumberUtils'
import { getSessionDetail, SessionSummary, saveEditedSession } from '../../api/historyApi'
import { showDialog, showErrorDialog, showSuccessDialog } from '../../store/dialogStore'
import { AttendanceGridSkeleton } from '../../components/SkeletonLoader'
import { useCacheStore } from '../../store/cacheStore'

function canEdit(takenAt: string): boolean {
    const taken = new Date(takenAt).getTime()
    const now = Date.now()
    const diffMinutes = (now - taken) / (1000 * 60)
    return diffMinutes <= 30
}

function minutesLeft(takenAt: string): number {
    const taken = new Date(takenAt).getTime()
    const diff = 30 - (Date.now() - taken) / (1000 * 60)
    return Math.max(0, Math.floor(diff))
}

type DetailRoute = RouteProp<HistoryStackParams, 'SessionDetail'>
type DetailNav = StackNavigationProp<HistoryStackParams, 'SessionDetail'>

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_PADDING = 12
const GAP = 8
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - (GRID_PADDING * 2) - (GAP * 2)) / 3)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function formatDateShort(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d}-${m}-${y}`
}

type AttendanceStatus = 'present' | 'absent'

interface DetailRecord {
    id: string
    status: AttendanceStatus
    class_members: {
        id: string
        roll_number: string
        name: string | null
    }
}

const EDIT_REASONS = [
    { id: 'mistake', label: 'Marked absent by mistake', icon: 'checkmark-circle-outline' as const },
    { id: 'late', label: 'Late entry / Permission granted', icon: 'time-outline' as const },
    { id: 'od', label: 'On-Duty (OD) / College event', icon: 'briefcase-outline' as const },
    { id: 'medical', label: 'Medical leave approved', icon: 'medkit-outline' as const },
    { id: 'other', label: 'Roll number correction / Other', icon: 'create-outline' as const },
]

export function SessionDetailScreen() {
    const route = useRoute<DetailRoute>()
    const navigation = useNavigation<DetailNav>()
    const { name, role, branch, year, semester, section } = useAuthStore()

    const { sessionId, session } = route.params as {
        sessionId: string
        session: SessionSummary
    }

    const [records, setRecords] = useState<DetailRecord[]>([])
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editMode, setEditMode] = useState(false)

    // Edit Reason Picker Modal
    const [reasonPickerVisible, setReasonPickerVisible] = useState(false)
    const [selectedReason, setSelectedReason] = useState(EDIT_REASONS[0].label)

    async function loadDetail() {
        setLoading(true)
        try {
            const data = await getSessionDetail(sessionId) as unknown as DetailRecord[]
            setRecords(data)
            const init: Record<string, AttendanceStatus> = {}
            data.forEach((r) => {
                init[r.class_members.id] = r.status
            })
            setAttendance(init)
        } catch (err: any) {
            const userMsg =
              err?.code?.startsWith('PGRST') ||
              err?.code?.startsWith('42') ||
              err?.code?.startsWith('23')
                ? 'Something went wrong. Please try again.'
                : err?.message ?? 'An unexpected error occurred.'
            showErrorDialog('Error', userMsg)
        } finally {
            setLoading(false)
        }
    }

    useFocusEffect(useCallback(() => { loadDetail() }, [sessionId]))

    function toggleMember(memberId: string) {
        if (!editMode) return
        setAttendance((prev) => ({
            ...prev,
            [memberId]: prev[memberId] === 'present' ? 'absent' : 'present',
        }))
    }

    function markAll(status: AttendanceStatus) {
        if (!editMode) return
        const updated: Record<string, AttendanceStatus> = {}
        records.forEach((r) => { updated[r.class_members.id] = status })
        setAttendance(updated)
    }

    const presentMembers = records.filter((r) => attendance[r.class_members.id] === 'present')
    const absentMembers = records.filter((r) => attendance[r.class_members.id] !== 'present')
    const pct = records.length > 0
        ? Math.round((presentMembers.length / records.length) * 100) : 0

    function handleStartSave() {
        if (!canEdit(session.taken_at)) {
            showDialog({
                type: 'warning',
                title: 'Editing Locked',
                message: 'Attendance can only be edited within the 30-minute grace period.',
                buttons: [{ text: 'OK', style: 'primary' }],
            })
            setEditMode(false)
            return
        }

        // Open Reason Picker modal
        setReasonPickerVisible(true)
    }

    async function handleConfirmSaveWithReason() {
        setReasonPickerVisible(false)
        setSaving(true)
        try {
            await saveEditedSession(
                sessionId,
                records.map((r) => ({
                    classMemberId: r.class_members.id,
                    status: attendance[r.class_members.id] ?? 'absent',
                }))
            )
            useCacheStore.getState().invalidateHistory()
            setEditMode(false)
            await loadDetail()
            showSuccessDialog('Attendance Updated', `Changes saved with reason: "${selectedReason}".`)
        } catch (err: any) {
            const userMsg =
              err?.code?.startsWith('PGRST') ||
              err?.code?.startsWith('42') ||
              err?.code?.startsWith('23')
                ? 'Something went wrong. Please try again.'
                : err?.message ?? 'An unexpected error occurred.'
            showErrorDialog('Error', userMsg)
        } finally {
            setSaving(false)
        }
    }

    function buildShareText(): string {
        const presentRolls = presentMembers.map((r) => getDisplayRoll(r.class_members.roll_number)).join(', ') || 'None'
        const absentRolls = absentMembers.map((r) => getDisplayRoll(r.class_members.roll_number)).join(', ') || 'None'

        return [
            'ATTENZA ATTENDANCE SESSION',
            '',
            `Date: ${formatDateShort(session.date_selected)}`,
            `Section: ${branch} - ${section} | Year ${year} SEM ${semester}`,
            `Subject: ${session.subject.name.toUpperCase()}${session.batch_name ? ` (${session.batch_name})` : ''}`,
            `Faculty: ${session.subject.faculty_name}`,
            `Type: ${session.subject.type}`,
            '',
            `Present (${presentMembers.length}):`,
            presentRolls,
            '',
            `Absent (${absentMembers.length}):`,
            absentRolls,
            '',
            `Total Present: ${presentMembers.length} | Total Absent: ${absentMembers.length} | Strength: ${records.length}`,
            '',
            `Taken by: ${role} | ${name}`,
        ].join('\n')
    }

    async function handleShare() {
        try {
            await Share.share({ message: buildShareText() })
        } catch (err: any) {
            const userMsg =
              err?.code?.startsWith('PGRST') ||
              err?.code?.startsWith('42') ||
              err?.code?.startsWith('23')
                ? 'Something went wrong. Please try again.'
                : err?.message ?? 'An unexpected error occurred.'
            showErrorDialog('Error', userMsg)
        }
    }

    async function handleCopy() {
        await Clipboard.setStringAsync(buildShareText())
        showSuccessDialog('Copied!', 'Attendance report copied to clipboard.')
    }

    function renderCell({ item }: { item: DetailRecord }) {
        const memberId = item.class_members.id
        const isPresent = (attendance[memberId] ?? item.status) === 'present'

        return (
            <TouchableOpacity
                style={[
                    styles.memberCard,
                    { width: CARD_WIDTH },
                    isPresent ? styles.memberCardPresent : styles.memberCardAbsent,
                    !editMode && styles.memberCardReadonly,
                ]}
                onPress={() => toggleMember(memberId)}
                activeOpacity={editMode ? 0.7 : 1}
            >
                <View style={styles.cardTopRow}>
                    <Text
                        style={[styles.cellRoll, isPresent ? styles.rollPresent : styles.rollAbsent]}
                        numberOfLines={1}
                    >
                        {getDisplayRoll(item.class_members.roll_number)}
                    </Text>
                    <View style={[styles.statusBadge, isPresent ? styles.statusBadgePresent : styles.statusBadgeAbsent]}>
                        <Ionicons
                            name={isPresent ? "checkmark" : "close"}
                            size={11}
                            color={isPresent ? "#15803D" : "#DC2626"}
                        />
                    </View>
                </View>
                {item.class_members.name ? (
                    <Text
                        style={[styles.cellName, isPresent ? styles.namePresent : styles.nameAbsent]}
                        numberOfLines={1}
                    >
                        {item.class_members.name.split(' ')[0]}
                    </Text>
                ) : null}
            </TouchableOpacity>
        )
    }

    const isEditable = canEdit(session.taken_at)
    const minLeft = minutesLeft(session.taken_at)

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {session.subject.name}
                    </Text>
                    <Text style={styles.headerDate}>{formatDate(session.date_selected)}</Text>
                </View>
                {/* Edit button — only show if within 30 min grace period */}
                {isEditable ? (
                    <TouchableOpacity
                        style={[styles.editBtn,
                        { backgroundColor: editMode ? '#FEE2E2' : '#EEF2FF', borderColor: editMode ? '#FECACA' : '#C7D2FE' }]}
                        onPress={() => {
                            if (editMode) {
                                const init: Record<string, AttendanceStatus> = {}
                                records.forEach((r) => { init[r.class_members.id] = r.status })
                                setAttendance(init)
                            }
                            setEditMode(!editMode)
                        }}
                        activeOpacity={0.75}
                    >
                        {editMode ? (
                            <Text style={[styles.editBtnText, { color: '#DC2626' }]}>Cancel</Text>
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="pencil" size={12} color={COLORS.primary} />
                                <Text style={[styles.editBtnText, { color: COLORS.primary }]}>
                                    Edit ({minLeft}m)
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ) : (
                    <View style={styles.lockedBtn}>
                        <Ionicons name="lock-closed" size={11} color={COLORS.textMuted} />
                        <Text style={styles.lockedBtnText}>Locked</Text>
                    </View>
                )}
            </View>

            {/* Upgraded Session Summary Card */}
            <View style={styles.sessionCard}>
                <View style={styles.sessionHeaderRow}>
                    <View style={[
                        styles.typeBadge,
                        {
                            backgroundColor: session.subject.type === 'LAB' ? '#DCFCE7' : '#EEF2FF',
                            borderColor: session.subject.type === 'LAB' ? '#86EFAC' : '#C7D2FE',
                        }
                    ]}>
                        <Text style={[
                            styles.typeBadgeText,
                            { color: session.subject.type === 'LAB' ? '#15803D' : COLORS.primary }
                        ]}>
                            {session.subject.type}
                        </Text>
                    </View>
                    {session.batch_name ? (
                        <View style={styles.batchPill}>
                            <Text style={styles.batchPillText}>{session.batch_name}</Text>
                        </View>
                    ) : null}
                    <View style={{ flex: 1 }} />
                    <View style={styles.facultyWrap}>
                        <Ionicons name="person-outline" size={12} color={COLORS.textSecondary} />
                        <Text style={styles.facultySubtext} numberOfLines={1}>
                            {session.subject.faculty_name}
                        </Text>
                    </View>
                </View>

                {/* Modern 4-Card Stats Grid */}
                <View style={styles.statsCardGrid}>
                    <View style={[styles.statCardItem, { backgroundColor: '#ECFDF5', borderColor: '#86EFAC' }]}>
                        <Text style={[styles.statCardNum, { color: '#15803D' }]}>{presentMembers.length}</Text>
                        <Text style={[styles.statCardLabel, { color: '#166534' }]}>Present</Text>
                    </View>
                    <View style={[styles.statCardItem, { backgroundColor: '#FFF5F5', borderColor: '#FECACA' }]}>
                        <Text style={[styles.statCardNum, { color: '#DC2626' }]}>{absentMembers.length}</Text>
                        <Text style={[styles.statCardLabel, { color: '#991B1B' }]}>Absent</Text>
                    </View>
                    <View style={[styles.statCardItem, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
                        <Text style={[styles.statCardNum, { color: COLORS.primary }]}>{records.length}</Text>
                        <Text style={[styles.statCardLabel, { color: '#3730A3' }]}>Total</Text>
                    </View>
                    <View style={[
                        styles.statCardItem,
                        {
                            backgroundColor: pct >= 75 ? '#ECFDF5' : pct >= 60 ? '#FFFBEB' : '#FFF5F5',
                            borderColor: pct >= 75 ? '#86EFAC' : pct >= 60 ? '#FDE68A' : '#FECACA',
                        }
                    ]}>
                        <Text style={[
                            styles.statCardNum,
                            { color: pct >= 75 ? '#15803D' : pct >= 60 ? '#D97706' : '#DC2626' }
                        ]}>{pct}%</Text>
                        <Text style={[styles.statCardLabel, { color: COLORS.textSecondary }]}>Rate</Text>
                    </View>
                </View>
            </View>

            {/* Edit mode quick-action bar */}
            {editMode && (
                <View style={styles.editToolbar}>
                    <TouchableOpacity
                        style={[styles.markBtn, { backgroundColor: '#ECFDF5', borderColor: '#86EFAC' }]}
                        onPress={() => markAll('present')}
                        activeOpacity={0.75}
                    >
                        <Ionicons name="checkmark-done" size={13} color="#15803D" style={{ marginRight: 4 }} />
                        <Text style={[styles.markBtnText, { color: '#15803D' }]}>All Present</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.markBtn, { backgroundColor: '#FFF5F5', borderColor: '#FECACA' }]}
                        onPress={() => markAll('absent')}
                        activeOpacity={0.75}
                    >
                        <Ionicons name="close" size={13} color="#DC2626" style={{ marginRight: 4 }} />
                        <Text style={[styles.markBtnText, { color: '#DC2626' }]}>All Absent</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Detailed Roll Grid */}
            {loading ? (
                <AttendanceGridSkeleton />
            ) : (
                <FlatList
                    data={records}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCell}
                    numColumns={3}
                    columnWrapperStyle={styles.gridRow}
                    contentContainerStyle={styles.grid}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Footer */}
            <View style={styles.footer}>
                {editMode ? (
                    <TouchableOpacity
                        style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                        onPress={handleStartSave}
                        disabled={saving}
                        activeOpacity={0.85}
                    >
                        {saving
                            ? <ActivityIndicator color="#fff" />
                            : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                                    <Text style={styles.saveBtnText}>Review & Save Changes</Text>
                                </View>
                            )
                        }
                    </TouchableOpacity>
                ) : (
                    <View style={styles.shareRow}>
                        <TouchableOpacity
                            style={[styles.shareBtn, { backgroundColor: COLORS.primary }]}
                            onPress={handleShare}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="share-social-outline" size={17} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.shareBtnText}>Share</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.shareBtn, {
                                backgroundColor: COLORS.surface,
                                borderWidth: 1.5, borderColor: '#E2E8F0',
                            }]}
                            onPress={handleCopy}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="copy-outline" size={17} color={COLORS.textPrimary} style={{ marginRight: 6 }} />
                            <Text style={[styles.shareBtnText, { color: COLORS.textPrimary }]}>Copy Report</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Reason Picker Modal (Grace Period Edit) */}
            <Modal
                visible={reasonPickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setReasonPickerVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconWrap}>
                                <Ionicons name="create-outline" size={22} color={COLORS.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Select Edit Reason</Text>
                                <Text style={styles.modalSubtitle}>Why is this session being modified?</Text>
                            </View>
                            <TouchableOpacity onPress={() => setReasonPickerVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.reasonsList}>
                            {EDIT_REASONS.map((r) => {
                                const isSelected = selectedReason === r.label
                                return (
                                    <TouchableOpacity
                                        key={r.id}
                                        style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                                        onPress={() => setSelectedReason(r.label)}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons
                                            name={r.icon}
                                            size={18}
                                            color={isSelected ? COLORS.primary : COLORS.textSecondary}
                                            style={{ marginRight: 10 }}
                                        />
                                        <Text style={[styles.reasonOptionText, isSelected && styles.reasonOptionTextSelected]}>
                                            {r.label}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
                                        )}
                                    </TouchableOpacity>
                                )
                            })}
                        </View>

                        <View style={styles.modalButtonsRow}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setReasonPickerVisible(false)}
                                activeOpacity={0.75}
                            >
                                <Text style={styles.modalCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirmBtn}
                                onPress={handleConfirmSaveWithReason}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.modalConfirmBtnText}>Confirm & Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    header: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingRight: 4,
    },
    backText: { fontSize: 15, color: COLORS.primary, fontWeight: '700' },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
    headerDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1, fontWeight: '500' },
    editBtn: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1,
    },
    editBtnText: { fontSize: 12, fontWeight: '700' },
    lockedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    lockedBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },

    // Upgraded Session Summary Card
    sessionCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        marginHorizontal: 14,
        marginTop: 12,
        marginBottom: 8,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    sessionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    typeBadge: {
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
    },
    typeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    batchPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    batchPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
    },
    facultyWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    facultySubtext: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: '500',
        maxWidth: 140,
    },
    statsCardGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    statCardItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    statCardNum: {
        fontSize: 18,
        fontWeight: '900',
    },
    statCardLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1,
    },

    editToolbar: {
        flexDirection: 'row', gap: 10,
        paddingHorizontal: 14, paddingVertical: 8,
    },
    markBtn: {
        flex: 1, paddingVertical: 8, borderRadius: 10,
        borderWidth: 1, alignItems: 'center',
    },
    markBtnText: { fontSize: 12, fontWeight: '700' },

    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    grid: { padding: GRID_PADDING, paddingBottom: 24 },
    gridRow: { gap: GAP, marginBottom: GAP },

    // Modern 3-Column Pill Card
    memberCard: {
        borderRadius: 14,
        borderWidth: 1.5,
        paddingVertical: 10,
        paddingHorizontal: 8,
        minHeight: 62,
        justifyContent: 'center',
        elevation: 1.5,
    },
    memberCardPresent: {
        backgroundColor: '#ECFDF5',
        borderColor: '#86EFAC',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    memberCardAbsent: {
        backgroundColor: '#FFF5F5',
        borderColor: '#FECACA',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
    },
    memberCardReadonly: {
        opacity: 0.95,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cellRoll: {
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.2,
        flex: 1,
    },
    rollPresent: {
        color: '#065F46',
    },
    rollAbsent: {
        color: '#991B1B',
    },
    statusBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    statusBadgePresent: {
        backgroundColor: '#10B981',
    },
    statusBadgeAbsent: {
        backgroundColor: '#FEE2E2',
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    badgeTextPresent: {
        color: '#FFFFFF',
    },
    badgeTextAbsent: {
        color: '#DC2626',
    },
    cellName: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 3,
    },
    namePresent: {
        color: '#047857',
    },
    nameAbsent: {
        color: '#B91C1C',
    },

    footer: {
        backgroundColor: COLORS.surface,
        borderTopWidth: 1, borderTopColor: '#E2E8F0',
        padding: 16,
    },
    saveBtn: {
        backgroundColor: COLORS.primary, borderRadius: 14,
        paddingVertical: 14, alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3, shadowRadius: 6,
        elevation: 3,
    },
    saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    shareRow: { flexDirection: 'row', gap: 10 },
    shareBtn: {
        flex: 1, borderRadius: 14,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 4,
        elevation: 2,
    },
    shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    modalIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    modalSubtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 1,
    },
    reasonsList: {
        gap: 8,
        marginBottom: 20,
    },
    reasonOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    reasonOptionSelected: {
        backgroundColor: '#EEF2FF',
        borderColor: COLORS.primary,
    },
    reasonOptionText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textPrimary,
        flex: 1,
    },
    reasonOptionTextSelected: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    modalButtonsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modalCancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    modalConfirmBtn: {
        flex: 1.5,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: COLORS.primary,
    },
    modalConfirmBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
})
