import React, { useCallback, useState } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, ActivityIndicator, Alert,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { HistoryStackParams } from '../../navigation/CRNavigator'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import {
    getSessionHistory,
    deleteSession,
    SessionSummary,
} from '../../api/historyApi'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function getPercentColor(pct: number): string {
    if (pct >= 75) return COLORS.present
    if (pct >= 60) return '#F59E0B'
    return COLORS.absent
}

const SessionCard = React.memo(function SessionCard({
    session,
    onPress,
    onLongPress,
    isDeleting,
}: {
    session: SessionSummary,
    onPress: (session: SessionSummary) => void,
    onLongPress: (session: SessionSummary) => void,
    isDeleting: boolean,
}) {
    const pct = session.total_count > 0
        ? Math.round((session.present_count / session.total_count) * 100) : 0
    const pctColor = getPercentColor(pct)
    const isLab = session.subject.type === 'LAB'

    return (
        <TouchableOpacity
            style={styles.sessionCard}
            activeOpacity={0.85}
            onLongPress={() => onLongPress(session)}
            onPress={() => onPress(session)}
        >
            {/* Left accent */}
            <View style={[styles.accent, { backgroundColor: isLab ? COLORS.success : COLORS.primary }]} />

            <View style={styles.sessionInfo}>
                <View style={styles.sessionTop}>
                    <Text style={styles.sessionSubject} numberOfLines={1}>
                        {session.subject.name}
                    </Text>
                    <View style={[styles.typeBadge,
                    { backgroundColor: isLab ? COLORS.success + '20' : COLORS.primary + '20' }]}>
                        <Text style={[styles.typeBadgeText,
                        { color: isLab ? COLORS.success : COLORS.primary }]}>
                            {session.subject.type}
                        </Text>
                    </View>
                </View>

                <Text style={styles.sessionFaculty}>{session.subject.faculty_name}</Text>
                {session.batch_name && (
                    <Text style={styles.sessionBatch}>{session.batch_name}</Text>
                )}

                {session.is_edited && (
                    <View style={styles.editedBadge}>
                        <Text style={styles.editedBadgeText}>✏️ Edited</Text>
                    </View>
                )}

                <View style={styles.sessionBottom}>
                    <Text style={styles.sessionCounts}>
                        ✅ {session.present_count}  ❌ {session.absent_count}  👥 {session.total_count}
                    </Text>
                    <View style={[styles.pctBadge, { backgroundColor: pctColor + '20' }]}>
                        <Text style={[styles.pctText, { color: pctColor }]}>{pct}%</Text>
                    </View>
                </View>
            </View>

            {isDeleting && (
                <ActivityIndicator size="small" color={COLORS.absent} style={{ marginLeft: 8 }} />
            )}
        </TouchableOpacity>
    )
})

export function HistoryScreen() {
    const navigation = useNavigation<StackNavigationProp<HistoryStackParams>>()
    const { classId } = useAuthStore()

    const [sessions, setSessions] = useState<SessionSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [filterType, setFilterType] = useState<'ALL' | 'CLASS' | 'LAB'>('ALL')

    async function loadHistory() {
        if (!classId) return
        setLoading(true)
        try {
            const data = await getSessionHistory(classId)
            setSessions(data)
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

    useFocusEffect(useCallback(() => { loadHistory() }, [classId]))

    const confirmDelete = useCallback((session: SessionSummary) => {
        Alert.alert(
            'Delete Session?',
            `${session.subject.name} — ${formatDate(session.date_selected)}\n\nThis cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        setDeleting(session.id)
                        try {
                            await deleteSession(session.id)
                            setSessions((prev) => prev.filter((s) => s.id !== session.id))
                        } catch (err: any) {
                            Alert.alert('Error', err.message)
                        } finally {
                            setDeleting(null)
                        }
                    },
                },
            ]
        )
    }, [])

    const filtered = sessions.filter((s) =>
        filterType === 'ALL' ? true : s.subject.type === filterType
    )

    // Group by date
    const grouped = filtered.reduce((acc, session) => {
        const key = session.date_selected
        if (!acc[key]) acc[key] = []
        acc[key].push(session)
        return acc
    }, {} as Record<string, SessionSummary[]>)

    const groupedList = Object.entries(grouped).map(([date, items]) => ({
        date,
        items,
    }))

    const handlePress = useCallback((session: SessionSummary) => {
        navigation.navigate('SessionDetail', { sessionId: session.id, session })
    }, [navigation])

    const handleLongPress = useCallback((session: SessionSummary) => {
        confirmDelete(session)
    }, [confirmDelete])

    const renderItem = useCallback(({ item }: { item: { date: string, items: SessionSummary[] } }) => (
        <View style={styles.dateGroup}>
            <Text style={styles.dateHeader}>{formatDate(item.date)}</Text>
            {item.items.map((session) => (
                <SessionCard
                    key={session.id}
                    session={session}
                    onPress={handlePress}
                    onLongPress={handleLongPress}
                    isDeleting={deleting === session.id}
                />
            ))}
        </View>
    ), [handlePress, handleLongPress, deleting])

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>History</Text>
                <Text style={styles.headerCount}>{sessions.length} sessions</Text>
            </View>

            {/* Filter */}
            <View style={styles.filterRow}>
                {(['ALL', 'CLASS', 'LAB'] as const).map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterBtn, filterType === f && styles.filterBtnActive]}
                        onPress={() => setFilterType(f)}
                    >
                        <Text style={[styles.filterBtnText, filterType === f && styles.filterBtnTextActive]}>
                            {f === 'ALL' ? '📋 All' : f === 'CLASS' ? '🏫 Class' : '🔬 Lab'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : groupedList.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyIcon}>📭</Text>
                    <Text style={styles.emptyTitle}>No sessions yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Mark attendance from the Home screen first
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={groupedList}
                    keyExtractor={(item) => item.date}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    renderItem={renderItem}
                />
            )}

            {/* Long press hint */}
            {sessions.length > 0 && (
                <View style={styles.hint}>
                    <Text style={styles.hintText}>Long press a session to delete</Text>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
    headerCount: { fontSize: 13, color: COLORS.textSecondary },

    filterRow: {
        flexDirection: 'row', gap: 8, padding: 12,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    filterBtn: {
        flex: 1, paddingVertical: 8, borderRadius: 10,
        borderWidth: 1.5, borderColor: COLORS.border,
        backgroundColor: COLORS.background, alignItems: 'center',
    },
    filterBtnActive: {
        backgroundColor: COLORS.primary, borderColor: COLORS.primary,
    },
    filterBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
    filterBtnTextActive: { color: '#fff' },

    list: { padding: 16, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
    emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },

    dateGroup: { marginBottom: 20 },
    dateHeader: {
        fontSize: 13, fontWeight: '700', color: COLORS.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.8,
        marginBottom: 8,
    },
    sessionCard: {
        flexDirection: 'row', backgroundColor: COLORS.surface,
        borderRadius: 14, marginBottom: 10,
        borderWidth: 1, borderColor: COLORS.border,
        overflow: 'hidden',
    },
    accent: { width: 4 },
    sessionInfo: { flex: 1, padding: 14 },
    sessionTop: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 4,
    },
    sessionSubject: {
        fontSize: 15, fontWeight: '700',
        color: COLORS.textPrimary, flex: 1,
    },
    typeBadge: {
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 6, marginLeft: 8,
    },
    typeBadgeText: { fontSize: 11, fontWeight: '700' },
    sessionFaculty: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 2 },
    sessionBatch: { fontSize: 12, color: COLORS.success, fontWeight: '600', marginBottom: 4 },
    sessionBottom: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginTop: 6,
    },
    sessionCounts: { fontSize: 12, color: COLORS.textSecondary },
    pctBadge: {
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    },
    pctText: { fontSize: 13, fontWeight: '800' },

    editedBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#F59E0B20',
        borderWidth: 1, borderColor: '#F59E0B60',
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 6, marginTop: 4,
    },
    editedBadgeText: {
        fontSize: 11, fontWeight: '700', color: '#F59E0B',
    },

    hint: {
        padding: 10, alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderTopWidth: 1, borderTopColor: COLORS.border,
    },
    hintText: { fontSize: 12, color: COLORS.textMuted },
})