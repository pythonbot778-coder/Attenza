import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, FlatList, Dimensions,
    TextInput, Switch,
} from 'react-native'
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'
import {
    getMembersForClass,
    getMembersForBatch,
    saveAttendanceSession,
    semesterLabel,
    ClassMember,
} from '../../api/attendanceApi'
import { getDisplayRoll } from '../../utils/rollNumberUtils'
import { HomeStackParams } from '../../navigation/CRNavigator'
import { AttendanceGridSkeleton } from '../../components/SkeletonLoader'
import { useCacheStore } from '../../store/cacheStore'
import {
    getPendingTransferForUser,
    acceptRoleTransfer,
    rejectRoleTransfer,
    RoleTransfer,
} from '../../api/roleTransferApi'
import { getShowNames } from '../../utils/attendancePrefs'
import { useSendAttendanceNotification } from '../../hooks/useSendAttendanceNotification'
import { showDialog, showErrorDialog } from '../../store/dialogStore'

type AttendanceRoute   = RouteProp<HomeStackParams, 'Attendance'>
type AttendanceNavProp = StackNavigationProp<HomeStackParams, 'Attendance'>
type AttendanceStatus  = 'present' | 'absent'

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_PADDING = 12
const GAP = 8
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - (GRID_PADDING * 2) - (GAP * 2)) / 3)

function todayString(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateDisplay(iso: string): string {
    const [y, m, day] = iso.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${day} ${months[parseInt(m, 10) - 1]} ${y}`
}

function offsetDate(iso: string, days: number): string {
    const d = new Date(iso)
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MemberCell = React.memo(function MemberCell({
    item, isPresent, showNames, onPress, cardWidth,
}: {
    item: ClassMember
    isPresent: boolean
    showNames: boolean
    onPress: (id: string) => void
    cardWidth: number
}) {
    return (
        <TouchableOpacity
            style={[
                styles.memberCard,
                { width: cardWidth },
                isPresent ? styles.memberCardPresent : styles.memberCardAbsent,
            ]}
            activeOpacity={0.7}
            onPress={() => onPress(item.id)}
        >
            <View style={styles.cardTopRow}>
                <Text
                    style={[styles.cellRoll, isPresent ? styles.rollPresent : styles.rollAbsent]}
                    numberOfLines={1}
                >
                    {getDisplayRoll(item.roll_number)}
                </Text>
                <View style={[styles.statusBadge, isPresent ? styles.statusBadgePresent : styles.statusBadgeAbsent]}>
                    <Ionicons
                        name={isPresent ? "checkmark" : "close"}
                        size={11}
                        color={isPresent ? "#15803D" : "#DC2626"}
                    />
                </View>
            </View>
            {showNames && item.name ? (
                <Text
                    style={[styles.cellName, isPresent ? styles.namePresent : styles.nameAbsent]}
                    numberOfLines={1}
                >
                    {item.name.split(' ')[0]}
                </Text>
            ) : null}
        </TouchableOpacity>
    )
})

export function AttendanceScreen() {
    const route      = useRoute<AttendanceRoute>()
    const navigation = useNavigation<AttendanceNavProp>()
    const { classId, userId, role, branch, year, semester, section } = useAuthStore()
    const isMutating = useRef(false)
    const isMounted  = useRef(true)

    // ── Notification hook ─────────────────────────────────────
    const sendNotification = useSendAttendanceNotification()

    const { subjectId, subjectName, facultyName, type, batches } = route.params

    const isLab      = type === 'LAB'
    const hasBatches = isLab && batches && batches.length > 0
    const batchOptions = hasBatches ? batches! : []

    const [selectedDate,  setSelectedDate]  = useState(todayString())
    const [selectedBatch, setSelectedBatch] = useState<typeof batchOptions[0] | null>(
        hasBatches ? batchOptions[0] : null
    )
    const [members,    setMembers]    = useState<ClassMember[]>([])
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
    const [loading,    setLoading]    = useState(true)
    const [saving,     setSaving]     = useState(false)
    const [showNames,  setShowNamesState] = useState(true)

    // ── Multi-hour selector & Substitute teacher state ──────────
    const [hours, setHours] = useState<number>(1)
    const [isSubstitute, setIsSubstitute] = useState<boolean>(false)
    const [substituteName, setSubstituteName] = useState<string>('')

    useEffect(() => { return () => { isMounted.current = false } }, [])
    useEffect(() => { getShowNames().then(val => setShowNamesState(val)) }, [])

    // ── Pending role transfer check ───────────────────────────
    useEffect(() => {
        if (!userId) return
        getPendingTransferForUser(userId).then((transfer) => {
            if (!transfer) return
            showTransferPopup(transfer)
        }).catch(() => {})
    }, [userId])

    function showTransferPopup(transfer: RoleTransfer) {
        showDialog({
            type: 'confirm',
            title: `You've Been Assigned as ${transfer.role}`,
            message: `You have been assigned as ${transfer.role}. Accept or Reject.`,
            dismissable: false,
            buttons: [
                {
                    text: 'Reject',
                    style: 'cancel',
                    onPress: async () => {
                        try {
                            await rejectRoleTransfer(transfer.id)
                        } catch (e: any) {
                            showErrorDialog('Error', e?.message ?? 'Something went wrong.')
                        }
                    },
                },
                {
                    text: 'Accept',
                    style: 'primary',
                    onPress: async () => {
                        try {
                            await acceptRoleTransfer(transfer)
                            await hydrateAuthState()
                        } catch (e: any) {
                            showErrorDialog('Error', e?.message ?? 'Something went wrong.')
                        }
                    },
                },
            ],
        })
    }

    // ── Load members ──────────────────────────────────────────
    const loadMembers = useCallback(async () => {
        if (!classId) return
        setLoading(true)
        try {
            let list: ClassMember[]
            if (selectedBatch) {
                list = await getMembersForBatch(
                    classId,
                    selectedBatch.id ?? null,
                    selectedBatch.start_roll,
                    selectedBatch.end_roll,
                )
            } else {
                list = await getMembersForClass(classId)
            }
            if (isMounted.current) {
                setMembers(list)
                const init: Record<string, AttendanceStatus> = {}
                list.forEach((m) => { init[m.id] = 'present' })
                setAttendance(init)
            }
        } catch (err: any) {
            showErrorDialog('Error', err?.message ?? 'Something went wrong.')
        } finally {
            if (isMounted.current) setLoading(false)
        }
    }, [classId, selectedBatch])

    useEffect(() => { loadMembers() }, [loadMembers])

    const toggleMember = useCallback((memberId: string) => {
        setAttendance((prev) => ({
            ...prev,
            [memberId]: prev[memberId] === 'present' ? 'absent' : 'present',
        }))
    }, [])

    function markAll(status: AttendanceStatus) {
        const updated: Record<string, AttendanceStatus> = {}
        members.forEach((m) => { updated[m.id] = status })
        setAttendance(updated)
    }

    const presentCount = Object.values(attendance).filter((v) => v === 'present').length
    const absentCount  = members.length - presentCount
    const totalCount   = members.length
    const attendancePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0

    const effectiveFaculty = isSubstitute && substituteName.trim()
        ? `${substituteName.trim()} (Sub)`
        : facultyName

    function handleSave() {
        if (isMutating.current || saving) return
        if (!classId || !userId) {
            showErrorDialog('Error', 'Session missing. Please restart.')
            return
        }
        if (members.length === 0) {
            showDialog({
                type: 'info',
                title: 'No Members',
                message: 'No students found to mark attendance.',
                buttons: [{ text: 'OK', style: 'primary' }],
            })
            return
        }

        const dateLabel  = formatDateDisplay(selectedDate)
        const batchLabel = selectedBatch ? ` · ${selectedBatch.batch_name}` : ''
        const hourLabel = `${hours} Hour${hours > 1 ? 's' : ''}`
        const facultyDisplay = isSubstitute
            ? `Faculty: ${substituteName.trim() || 'Substitute Teacher'} (Substitute)`
            : `Faculty: ${facultyName}`

        showDialog({
            type: 'confirm',
            title: 'Save Attendance Session?',
            message:
                `${subjectName}${batchLabel}\n` +
                `${dateLabel} • ${hourLabel}\n` +
                `${facultyDisplay}\n\n` +
                `Present: ${presentCount} (${attendancePct}%)\n` +
                `Absent: ${absentCount}\n` +
                `Strength: ${totalCount}\n\n` +
                `You can edit this session within 30 minutes from History.`,
            buttons: [
                { text: 'Review', style: 'cancel' },
                { text: 'Save Session', style: 'primary', onPress: doSave },
            ],
        })
    }

    async function doSave() {
        if (isMutating.current) return
        isMutating.current = true
        if (!classId || !userId) {
            isMutating.current = false
            return
        }
        setSaving(true)
        try {
            const records = members.map((m) => ({
                classMemberId: m.id,
                status:        attendance[m.id] ?? 'absent',
            }))

            const session = await saveAttendanceSession({
                subjectId,
                classId,
                batchName:    selectedBatch ? selectedBatch.batch_name : null,
                dateSelected: selectedDate,
                takenBy:      userId,
                semesterLabel: semesterLabel(Number(year) || 0, Number(semester) || 0),
                records,
            })

            // Invalidate history cache so History screen loads fresh data on next visit
            useCacheStore.getState().invalidateHistory()

            // ── Send push notification — fire and forget ──────
            sendNotification({
                subjectName,
                presentCount,
                absentCount,
                totalCount,
                dateSelected: selectedDate,
                batchName:    selectedBatch?.batch_name ?? null,
            })

            const presentMembers = members.filter((m) => attendance[m.id] === 'present')
            const absentMembers  = members.filter((m) => attendance[m.id] !== 'present')

            navigation.navigate('AttendanceSummary', {
                subjectName,
                facultyName:  effectiveFaculty,
                subjectType:  type,
                dateSelected: selectedDate,
                presentCount: presentMembers.length,
                absentCount:  absentMembers.length,
                totalCount:   members.length,
                presentRolls: presentMembers.map((m) => m.roll_number),
                absentRolls:  absentMembers.map((m) => m.roll_number),
                batchName:    selectedBatch?.batch_name ?? null,
                sessionId:    session.id,
                durationHours: hours,
                substituteTeacher: isSubstitute ? (substituteName.trim() || 'Substitute Teacher') : null,
            })
        } catch (err: any) {
            showErrorDialog('Save Failed', err?.message ?? 'Something went wrong.')
        } finally {
            isMutating.current = false
            setSaving(false)
        }
    }

    const renderCell = useCallback(({ item }: { item: ClassMember }) => (
        <MemberCell
            item={item}
            isPresent={attendance[item.id] === 'present'}
            showNames={showNames}
            onPress={toggleMember}
            cardWidth={CARD_WIDTH}
        />
    ), [attendance, toggleMember, showNames])

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{subjectName}</Text>
                    <Text style={styles.headerSubtitle}>{branch} • Yr {year} • S{semester} • {section}</Text>
                </View>
                <View style={[styles.rolePill, { backgroundColor: role === 'CR' ? COLORS.crColor : COLORS.lrColor }]}>
                    <Text style={styles.rolePillText}>{role}</Text>
                </View>
            </View>

            {/* Controls Bar: Date navigation */}
            <View style={styles.controlsCard}>
                <View style={styles.dateRow}>
                    <TouchableOpacity
                        style={styles.dateArrow}
                        onPress={() => setSelectedDate((d) => offsetDate(d, -1))}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                    <View style={styles.dateCenter}>
                        <Text style={styles.dateText}>{formatDateDisplay(selectedDate)}</Text>
                        {selectedDate === todayString() && <Text style={styles.todayBadge}>Today</Text>}
                    </View>
                    <TouchableOpacity
                        style={styles.dateArrow}
                        onPress={() => { const next = offsetDate(selectedDate, 1); if (next <= todayString()) setSelectedDate(next) }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-forward" size={20} color={selectedDate >= todayString() ? COLORS.textMuted : COLORS.primary} />
                    </TouchableOpacity>
                </View>

                {/* Multi-hour selector chips & Substitute Teacher Toggle */}
                <View style={styles.optionsDivider} />
                <View style={styles.optionsRow}>
                    {/* Hour chips */}
                    <View style={styles.hourSelectorGroup}>
                        <Text style={styles.optionLabel}>Duration</Text>
                        <View style={styles.hourChipsRow}>
                            {[1, 2, 3].map((h) => {
                                const active = hours === h
                                return (
                                    <TouchableOpacity
                                        key={h}
                                        style={[styles.hourChip, active && styles.hourChipActive]}
                                        onPress={() => setHours(h)}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[styles.hourChipText, active && styles.hourChipTextActive]}>
                                            {h} {h === 1 ? 'Hour' : 'Hours'}
                                        </Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    </View>

                    {/* Substitute Toggle */}
                    <View style={styles.substituteToggleBox}>
                        <View style={styles.substituteToggleRow}>
                            <View style={styles.subLabelWrap}>
                                <Ionicons name="person-circle-outline" size={17} color={isSubstitute ? COLORS.primary : COLORS.textSecondary} />
                                <Text style={styles.substituteLabel}>Substitute</Text>
                            </View>
                            <Switch
                                value={isSubstitute}
                                onValueChange={setIsSubstitute}
                                trackColor={{ false: '#E2E8F0', true: COLORS.primary }}
                                thumbColor="#FFFFFF"
                                ios_backgroundColor="#E2E8F0"
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                        </View>
                    </View>
                </View>

                {/* Substitute Name Input if enabled */}
                {isSubstitute && (
                    <View style={styles.substituteInputWrap}>
                        <TextInput
                            style={styles.substituteInput}
                            placeholder="Enter substitute faculty name (optional)"
                            placeholderTextColor={COLORS.textMuted}
                            value={substituteName}
                            onChangeText={setSubstituteName}
                            autoCapitalize="words"
                        />
                    </View>
                )}
            </View>

            {/* Batch selector if LAB */}
            {hasBatches && (
                <View style={styles.batchRow}>
                    {batchOptions.map((b) => (
                        <TouchableOpacity
                            key={b.id}
                            style={[styles.batchPill, selectedBatch?.id === b.id && styles.batchPillActive]}
                            onPress={() => setSelectedBatch(b)}
                            activeOpacity={0.75}
                        >
                            <Text style={[styles.batchPillText, selectedBatch?.id === b.id && styles.batchPillTextActive]}>
                                {b.batch_name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Grid / Content */}
            {loading ? (
                <AttendanceGridSkeleton />
            ) : members.length === 0 ? (
                <View style={styles.centered}>
                    <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
                    <Text style={styles.emptyText}>No members found</Text>
                </View>
            ) : (
                <FlatList
                    data={members}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCell}
                    numColumns={3}
                    columnWrapperStyle={styles.gridRow}
                    contentContainerStyle={styles.grid}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Sleek Floating Quick-Action Bar */}
            {!loading && members.length > 0 && (
                <View style={styles.floatingActionBar}>
                    {/* Top Row: Quick actions + Live Stats Counter ('X/Y Present • Z%') */}
                    <View style={styles.floatingBarTop}>
                        <View style={styles.quickActionGroup}>
                            <TouchableOpacity
                                style={styles.quickActionPillPresent}
                                onPress={() => markAll('present')}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="checkmark-done" size={13} color="#15803D" />
                                <Text style={styles.quickActionPresentText}>Mark All Present</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.quickActionPillAbsent}
                                onPress={() => markAll('absent')}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={13} color="#DC2626" />
                                <Text style={styles.quickActionAbsentText}>Mark All Absent</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Live Counter Badge: X/Y Present • Z% */}
                        <View style={styles.liveStatsBadge}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveStatsText}>
                                {presentCount}/{totalCount} Present • {attendancePct}%
                            </Text>
                        </View>
                    </View>

                    {/* Bottom Row: Tactile 'Save Session' button */}
                    <TouchableOpacity
                        style={[styles.floatingSaveBtn, (saving || loading) && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={saving || loading}
                        activeOpacity={0.85}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.floatingSaveBtnText}>
                                Save Session  •  {presentCount}/{totalCount} Present ({attendancePct}%)
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
        backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 10,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingRight: 6,
    },
    backText: { fontSize: 15, color: COLORS.primary, fontWeight: '700' },
    headerCenter:   { flex: 1 },
    headerTitle:    { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
    headerSubtitle: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
    rolePill:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    rolePillText:   { color: '#fff', fontWeight: '700', fontSize: 12 },

    // Controls Card with refined border
    controlsCard: {
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingHorizontal: 16,
        paddingVertical: 10,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    dateRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    dateArrow:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    dateCenter:    { flex: 1, alignItems: 'center' },
    dateText:      { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
    todayBadge: {
        fontSize: 10, color: COLORS.primary, fontWeight: '700',
        backgroundColor: COLORS.primary + '15',
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2,
    },
    optionsDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 8,
    },
    optionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    hourSelectorGroup: {
        flex: 1,
    },
    optionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 5,
    },
    hourChipsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    hourChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#F1F5F9',
    },
    hourChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primaryDark,
    },
    hourChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0F172A',
    },
    hourChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    substituteToggleBox: {
        alignItems: 'flex-end',
    },
    substituteToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    subLabelWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    substituteLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    substituteInputWrap: {
        marginTop: 8,
    },
    substituteInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: COLORS.textPrimary,
    },

    batchRow: {
        flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    },
    batchPill: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
        borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F1F5F9',
    },
    batchPillActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primaryDark },
    batchPillText:      { fontSize: 12, fontWeight: '700', color: '#0F172A' },
    batchPillTextActive:{ color: '#fff', fontWeight: '800' },
    centered:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyIcon:  { fontSize: 40, marginBottom: 12 },
    emptyText:  { fontSize: 16, color: COLORS.textSecondary },

    // Grid layout
    grid:       { padding: GRID_PADDING, paddingBottom: 145 },
    gridRow:    { gap: GAP, marginBottom: GAP },

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

    // Floating Quick-Action Bar
    floatingActionBar: {
        position: 'absolute',
        bottom: 16,
        left: 12,
        right: 12,
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 8,
        gap: 10,
    },
    floatingBarTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    quickActionGroup: {
        flexDirection: 'row',
        gap: 6,
    },
    quickActionPillPresent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    quickActionPresentText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#15803D',
    },
    quickActionPillAbsent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: '#FFF5F5',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    quickActionAbsentText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#DC2626',
    },
    liveStatsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 5,
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: COLORS.present,
    },
    liveStatsText: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    floatingSaveBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 14,
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3,
    },
    saveBtnDisabled: {
        opacity: 0.5,
    },
    floatingSaveBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
})
