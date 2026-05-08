import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert,
    FlatList, Dimensions,
} from 'react-native'
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { COLORS } from '../../constants/colors'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'
import {
    getMembersForClass,
    getMembersForBatch,
    saveAttendanceSession,
    ClassMember,
} from '../../api/attendanceApi'
import { getDisplayRoll } from '../../utils/rollNumberUtils'
import { HomeStackParams } from '../../navigation/CRNavigator'
import {
    getPendingTransferForUser,
    acceptRoleTransfer,
    rejectRoleTransfer,
    RoleTransfer,
} from '../../api/roleTransferApi'
import { getShowNames } from '../../utils/attendancePrefs'
import { useSendAttendanceNotification } from '../../hooks/useSendAttendanceNotification'

type AttendanceRoute   = RouteProp<HomeStackParams, 'Attendance'>
type AttendanceNavProp = StackNavigationProp<HomeStackParams, 'Attendance'>
type AttendanceStatus  = 'present' | 'absent'

const SCREEN_WIDTH = Dimensions.get('window').width
const CELL_SIZE    = Math.floor((SCREEN_WIDTH - 32 - 16) / 3)

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
    item, isPresent, showNames, onPress, cellSize,
}: {
    item: ClassMember
    isPresent: boolean
    showNames: boolean
    onPress: (id: string) => void
    cellSize: number
}) {
    return (
        <TouchableOpacity
            style={[
                styles.cell,
                {
                    backgroundColor: isPresent ? COLORS.present : COLORS.absent + '18',
                    borderColor:     isPresent ? COLORS.present : COLORS.absent + '60',
                    width: cellSize, height: cellSize,
                },
            ]}
            activeOpacity={0.7}
            onPress={() => onPress(item.id)}
        >
            <Text style={[styles.cellRoll, { color: isPresent ? '#fff' : COLORS.absent }]}>
                {getDisplayRoll(item.roll_number)}
            </Text>
            {showNames && item.name ? (
                <Text
                    style={[styles.cellName, { color: isPresent ? 'rgba(255,255,255,0.85)' : COLORS.textMuted }]}
                    numberOfLines={1}
                >
                    {item.name.split(' ')[0]}
                </Text>
            ) : null}
            <Text style={[styles.cellStatus, { color: isPresent ? 'rgba(255,255,255,0.75)' : COLORS.absent + 'aa' }]}>
                {isPresent ? '✓' : '✕'}
            </Text>
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
        Alert.alert(
            `You've Been Assigned as ${transfer.role}`,
            `You have been assigned as ${transfer.role}. Accept or Reject.`,
            [
                {
                    text: 'Reject', style: 'cancel',
                    onPress: async () => {
                        try { await rejectRoleTransfer(transfer.id) }
                        catch (e: any) { Alert.alert('Error', e?.message ?? 'Something went wrong.') }
                    },
                },
                {
                    text: 'Accept', style: 'default',
                    onPress: async () => {
                        try { await acceptRoleTransfer(transfer); await hydrateAuthState() }
                        catch (e: any) { Alert.alert('Error', e?.message ?? 'Something went wrong.') }
                    },
                },
            ],
            { cancelable: false }
        )
    }

    // ── Load members ──────────────────────────────────────────
    const loadMembers = useCallback(async () => {
        if (!classId) return
        setLoading(true)
        try {
            let list: ClassMember[]
            if (selectedBatch) {
                list = await getMembersForBatch(classId, selectedBatch.start_roll, selectedBatch.end_roll)
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
            Alert.alert('Error', err?.message ?? 'Something went wrong.')
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

    async function handleSave() {
        if (isMutating.current) return
        isMutating.current = true
        if (!classId || !userId) {
            Alert.alert('Error', 'Session missing. Please restart.')
            isMutating.current = false
            return
        }
        if (members.length === 0) {
            Alert.alert('No members', 'No students found to mark attendance.')
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
                records,
            })

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
                facultyName,
                subjectType:  type,
                dateSelected: selectedDate,
                presentCount: presentMembers.length,
                absentCount:  absentMembers.length,
                totalCount:   members.length,
                presentRolls: presentMembers.map((m) => m.roll_number),
                absentRolls:  absentMembers.map((m) => m.roll_number),
                batchName:    selectedBatch?.batch_name ?? null,
                sessionId:    session.id,
            })
        } catch (err: any) {
            Alert.alert('Save Failed', err?.message ?? 'Something went wrong.')
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
            cellSize={CELL_SIZE}
        />
    ), [attendance, toggleMember, showNames])

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{subjectName}</Text>
                    <Text style={styles.headerSubtitle}>{branch} • Yr {year} • S{semester} • {section}</Text>
                </View>
                <View style={[styles.rolePill, { backgroundColor: role === 'CR' ? COLORS.crColor : COLORS.lrColor }]}>
                    <Text style={styles.rolePillText}>{role}</Text>
                </View>
            </View>

            <View style={styles.dateRow}>
                <TouchableOpacity style={styles.dateArrow} onPress={() => setSelectedDate((d) => offsetDate(d, -1))}>
                    <Text style={styles.dateArrowText}>‹</Text>
                </TouchableOpacity>
                <View style={styles.dateCenter}>
                    <Text style={styles.dateText}>{formatDateDisplay(selectedDate)}</Text>
                    {selectedDate === todayString() && <Text style={styles.todayBadge}>Today</Text>}
                </View>
                <TouchableOpacity
                    style={styles.dateArrow}
                    onPress={() => { const next = offsetDate(selectedDate, 1); if (next <= todayString()) setSelectedDate(next) }}
                >
                    <Text style={styles.dateArrowText}>›</Text>
                </TouchableOpacity>
            </View>

            {hasBatches && (
                <View style={styles.batchRow}>
                    {batchOptions.map((b) => (
                        <TouchableOpacity
                            key={b.id}
                            style={[styles.batchPill, selectedBatch?.id === b.id && styles.batchPillActive]}
                            onPress={() => setSelectedBatch(b)}
                        >
                            <Text style={[styles.batchPillText, selectedBatch?.id === b.id && styles.batchPillTextActive]}>
                                {b.batch_name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <View style={styles.markAllRow}>
                <TouchableOpacity
                    style={[styles.markAllBtn, { backgroundColor: COLORS.present + '18', borderColor: COLORS.present }]}
                    onPress={() => markAll('present')}
                >
                    <Text style={[styles.markAllText, { color: COLORS.present }]}>✓ All Present</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.markAllBtn, { backgroundColor: COLORS.absent + '18', borderColor: COLORS.absent }]}
                    onPress={() => markAll('absent')}
                >
                    <Text style={[styles.markAllText, { color: COLORS.absent }]}>✕ All Absent</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : members.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyIcon}>👥</Text>
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

            <View style={styles.footer}>
                <View style={styles.countRow}>
                    <View style={[styles.countBadge, { backgroundColor: COLORS.present + '20' }]}>
                        <Text style={[styles.countNum, { color: COLORS.present }]}>{presentCount}</Text>
                        <Text style={[styles.countLabel, { color: COLORS.present }]}>Present</Text>
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: COLORS.absent + '18' }]}>
                        <Text style={[styles.countNum, { color: COLORS.absent }]}>{absentCount}</Text>
                        <Text style={[styles.countLabel, { color: COLORS.absent }]}>Absent</Text>
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: COLORS.primary + '15' }]}>
                        <Text style={[styles.countNum, { color: COLORS.primary }]}>{totalCount}</Text>
                        <Text style={[styles.countLabel, { color: COLORS.primary }]}>Total</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={[styles.saveBtn, (saving || loading) && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving || loading}
                    activeOpacity={0.85}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Attendance</Text>}
                </TouchableOpacity>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
        backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10,
    },
    backBtn:        { paddingRight: 4 },
    backText:       { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
    headerCenter:   { flex: 1 },
    headerTitle:    { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
    headerSubtitle: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
    rolePill:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    rolePillText:   { color: '#fff', fontWeight: '700', fontSize: 12 },
    dateRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10,
    },
    dateArrow:     { paddingHorizontal: 20, paddingVertical: 6 },
    dateArrowText: { fontSize: 26, color: COLORS.primary, fontWeight: '300' },
    dateCenter:    { flex: 1, alignItems: 'center' },
    dateText:      { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
    todayBadge: {
        fontSize: 11, color: COLORS.primary, fontWeight: '600',
        backgroundColor: COLORS.primary + '15',
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 3,
    },
    batchRow: {
        flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    batchPill:         { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background },
    batchPillActive:   { backgroundColor: COLORS.success, borderColor: COLORS.success },
    batchPillText:     { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
    batchPillTextActive:{ color: '#fff' },
    markAllRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
    markAllBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
    markAllText:{ fontSize: 13, fontWeight: '700' },
    centered:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyIcon:  { fontSize: 40, marginBottom: 12 },
    emptyText:  { fontSize: 16, color: COLORS.textSecondary },
    grid:       { padding: 8, paddingBottom: 8 },
    gridRow:    { gap: 8, marginBottom: 8, paddingHorizontal: 8 },
    cell:       { borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', padding: 6 },
    cellRoll:   { fontSize: 18, fontWeight: '800' },
    cellName:   { fontSize: 10, fontWeight: '500', marginTop: 1 },
    cellStatus: { fontSize: 13, fontWeight: '700', marginTop: 2 },
    footer:     { backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 16 },
    countRow:   { flexDirection: 'row', gap: 10, marginBottom: 12 },
    countBadge: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
    countNum:   { fontSize: 22, fontWeight: '900' },
    countLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    saveBtn:         { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
})