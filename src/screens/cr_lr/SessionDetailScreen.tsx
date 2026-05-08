import React, { useCallback, useState } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, ActivityIndicator, Alert, Share,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { HistoryStackParams } from '../../navigation/CRNavigator'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { getDisplayRoll } from '../../utils/rollNumberUtils'
import { getSessionDetail, SessionSummary, saveEditedSession } from '../../api/historyApi'
import { saveAttendanceSession } from '../../api/attendanceApi'

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

export function SessionDetailScreen() {
    const route = useRoute<DetailRoute>()
    const navigation = useNavigation<DetailNav>()
    const { name, role, branch, year, semester, section, classId, userId } = useAuthStore()

    const { sessionId, session } = route.params as {
        sessionId: string
        session: SessionSummary
    }

    const [records, setRecords] = useState<DetailRecord[]>([])
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editMode, setEditMode] = useState(false)

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
            Alert.alert('Error', userMsg)
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

    async function handleSaveEdit() {
        if (!canEdit(session.taken_at)) {
            Alert.alert('Locked', 'Attendance can only be edited within 30 minutes of taking it.')
            setEditMode(false)
            return
        }

        setSaving(true)
        try {
            await saveEditedSession(
                sessionId,
                records.map((r) => ({
                    classMemberId: r.class_members.id,
                    status: attendance[r.class_members.id] ?? 'absent',
                }))
            )
            setEditMode(false)
            // Reload to reflect changes
            await loadDetail()
            Alert.alert('✅ Updated', 'Attendance updated successfully.')
        } catch (err: any) {
            const userMsg =
              err?.code?.startsWith('PGRST') ||
              err?.code?.startsWith('42') ||
              err?.code?.startsWith('23')
                ? 'Something went wrong. Please try again.'
                : err?.message ?? 'An unexpected error occurred.'
            Alert.alert('Error', userMsg)
        } finally {
            setSaving(false)
        }
    }

    function buildShareText(): string {
        const presentRolls = presentMembers.map((r) => getDisplayRoll(r.class_members.roll_number)).join(', ') || 'None'
        const absentRolls = absentMembers.map((r) => getDisplayRoll(r.class_members.roll_number)).join(', ') || 'None'

        return [
            '🎓 ATTENZA',
            '',
            `📅 Date: ${formatDateShort(session.date_selected)}`,
            `🏫 Section: ${branch} - ${section} | Year ${year} SEM ${semester}`,
            `📖 Subject: ${session.subject.name.toUpperCase()}${session.batch_name ? ` (${session.batch_name})` : ''}`,
            `👨‍🏫 Faculty: ${session.subject.faculty_name}`,
            `🔖 Type: ${session.subject.type}`,
            '',
            `✅ Present (${presentMembers.length}):`,
            presentRolls,
            '',
            `❌ Absent (${absentMembers.length}):`,
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
            Alert.alert('Error', userMsg)
        }
    }

    async function handleCopy() {
        await Clipboard.setStringAsync(buildShareText())
        Alert.alert('✅ Copied!', 'Attendance report copied to clipboard.')
    }

    function renderCell({ item }: { item: DetailRecord }) {
        const memberId = item.class_members.id
        const isPresent = (attendance[memberId] ?? item.status) === 'present'

        return (
            <TouchableOpacity
                style={[
                    styles.cell,
                    {
                        backgroundColor: isPresent ? COLORS.present : COLORS.absent + '18',
                        borderColor: isPresent ? COLORS.present : COLORS.absent + '60',
                        opacity: editMode ? 1 : 0.95,
                    },
                ]}
                onPress={() => toggleMember(memberId)}
                activeOpacity={editMode ? 0.7 : 1}
            >
                <Text style={[styles.cellRoll, { color: isPresent ? '#fff' : COLORS.absent }]}>
                    {getDisplayRoll(item.class_members.roll_number)}
                </Text>
                {item.class_members.name ? (
                    <Text
                        style={[styles.cellName, { color: isPresent ? 'rgba(255,255,255,0.8)' : COLORS.textMuted }]}
                        numberOfLines={1}
                    >
                        {item.class_members.name.split(' ')[0]}
                    </Text>
                ) : null}
                <Text style={[styles.cellStatus, { color: isPresent ? 'rgba(255,255,255,0.75)' : COLORS.absent + 'aa' }]}>
                    {isPresent ? '✓' : '✕'}
                </Text>
            </TouchableOpacity>
        )
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {session.subject.name}
                    </Text>
                    <Text style={styles.headerDate}>{formatDate(session.date_selected)}</Text>
                </View>
                {/* Edit button — only show if within 30 min */}
                {canEdit(session.taken_at) ? (
                    <TouchableOpacity
                        style={[styles.editBtn,
                        { backgroundColor: editMode ? COLORS.absent + '20' : COLORS.primary + '15' }]}
                        onPress={() => {
                            if (editMode) {
                                const init: Record<string, AttendanceStatus> = {}
                                records.forEach((r) => { init[r.class_members.id] = r.status })
                                setAttendance(init)
                            }
                            setEditMode(!editMode)
                        }}
                    >
                        <Text style={[styles.editBtnText, { color: editMode ? COLORS.absent : COLORS.primary }]}>
                            {editMode ? 'Cancel' : `✏️ Edit (${minutesLeft(session.taken_at)}m)`}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View style={[styles.editBtn, { backgroundColor: COLORS.border }]}>
                        <Text style={[styles.editBtnText, { color: COLORS.textMuted }]}>🔒 Locked</Text>
                    </View>
                )}
            </View>

            {/* Stats bar */}
            <View style={styles.statsBar}>
                <View style={[styles.statItem, { backgroundColor: COLORS.present + '15' }]}>
                    <Text style={[styles.statNum, { color: COLORS.present }]}>{presentMembers.length}</Text>
                    <Text style={[styles.statLabel, { color: COLORS.present }]}>Present</Text>
                </View>
                <View style={[styles.statItem, { backgroundColor: COLORS.absent + '15' }]}>
                    <Text style={[styles.statNum, { color: COLORS.absent }]}>{absentMembers.length}</Text>
                    <Text style={[styles.statLabel, { color: COLORS.absent }]}>Absent</Text>
                </View>
                <View style={[styles.statItem, { backgroundColor: COLORS.primary + '15' }]}>
                    <Text style={[styles.statNum, { color: COLORS.primary }]}>{records.length}</Text>
                    <Text style={[styles.statLabel, { color: COLORS.primary }]}>Total</Text>
                </View>
                <View style={[styles.statItem, {
                    backgroundColor: pct >= 75 ? COLORS.present + '15' : pct >= 60 ? '#F59E0B20' : COLORS.absent + '15'
                }]}>
                    <Text style={[styles.statNum, {
                        color: pct >= 75 ? COLORS.present : pct >= 60 ? '#F59E0B' : COLORS.absent
                    }]}>{pct}%</Text>
                    <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>Rate</Text>
                </View>
            </View>

            {/* Edit mode toolbar */}
            {editMode && (
                <View style={styles.editToolbar}>
                    <TouchableOpacity
                        style={[styles.markBtn, { backgroundColor: COLORS.present + '18', borderColor: COLORS.present }]}
                        onPress={() => markAll('present')}
                    >
                        <Text style={[styles.markBtnText, { color: COLORS.present }]}>✓ All Present</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.markBtn, { backgroundColor: COLORS.absent + '18', borderColor: COLORS.absent }]}
                        onPress={() => markAll('absent')}
                    >
                        <Text style={[styles.markBtnText, { color: COLORS.absent }]}>✕ All Absent</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Grid */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
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
                        onPress={handleSaveEdit}
                        disabled={saving}
                        activeOpacity={0.85}
                    >
                        {saving
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.saveBtnText}>💾 Save Changes</Text>
                        }
                    </TouchableOpacity>
                ) : (
                    <View style={styles.shareRow}>
                        <TouchableOpacity
                            style={[styles.shareBtn, { backgroundColor: COLORS.primary }]}
                            onPress={handleShare}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.shareBtnText}>💬 Share</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.shareBtn, {
                                backgroundColor: COLORS.surface,
                                borderWidth: 1.5, borderColor: COLORS.border,
                            }]}
                            onPress={handleCopy}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.shareBtnText, { color: COLORS.textPrimary }]}>📋 Copy</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    )
}

const CELL_SIZE = Math.floor((require('react-native').Dimensions.get('window').width - 32 - 16) / 3)

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    header: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
    headerDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    editBtn: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    },
    editBtnText: { fontSize: 13, fontWeight: '700' },

    statsBar: {
        flexDirection: 'row', gap: 8, padding: 12,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    statItem: {
        flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    },
    statNum: { fontSize: 20, fontWeight: '900' },
    statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },

    editToolbar: {
        flexDirection: 'row', gap: 10,
        paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    markBtn: {
        flex: 1, paddingVertical: 9, borderRadius: 10,
        borderWidth: 1.5, alignItems: 'center',
    },
    markBtnText: { fontSize: 13, fontWeight: '700' },

    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    grid: { padding: 8 },
    gridRow: { gap: 8, marginBottom: 8, paddingHorizontal: 8 },
    cell: {
        width: CELL_SIZE, height: CELL_SIZE,
        borderRadius: 12, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center', padding: 6,
    },
    cellRoll: { fontSize: 18, fontWeight: '800' },
    cellName: { fontSize: 10, fontWeight: '500', marginTop: 1 },
    cellStatus: { fontSize: 13, fontWeight: '700', marginTop: 2 },

    footer: {
        backgroundColor: COLORS.surface,
        borderTopWidth: 1, borderTopColor: COLORS.border,
        padding: 16,
    },
    saveBtn: {
        backgroundColor: COLORS.primary, borderRadius: 12,
        paddingVertical: 15, alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    shareRow: { flexDirection: 'row', gap: 10 },
    shareBtn: {
        flex: 1, borderRadius: 12,
        paddingVertical: 14, alignItems: 'center',
    },
    shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})