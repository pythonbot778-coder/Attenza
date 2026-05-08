import React, { useCallback, useState } from 'react'
import {
    View, Text, StyleSheet, FlatList,
    ActivityIndicator, RefreshControl, TouchableOpacity, Alert,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { getSessionHistory, SessionSummary } from '../../api/historyApi'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(iso: string) {
    const [y, m, d] = iso.split('-')
    return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`
}

const HistoryCard = React.memo(function HistoryCard({ item }: { item: SessionSummary }) {
    const pct = item.total_count > 0
        ? Math.round((item.present_count / item.total_count) * 100)
        : 0
    const isLab = item.subject?.type === 'LAB'

    return (
        <View style={styles.card}>
            {/* Top row */}
            <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.subjectName} numberOfLines={1}>
                        {item.subject?.name}
                    </Text>
                    <Text style={styles.faculty}>{item.subject?.faculty_name}</Text>
                </View>
                <View style={styles.pctBox}>
                    <Text style={styles.pctText}>{pct}%</Text>
                </View>
            </View>

            {/* Meta row */}
            <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{formatDate(item.date_selected)}</Text>
                {isLab && item.batch_name && (
                    <View style={styles.batchPill}>
                        <Text style={styles.batchPillText}>{item.batch_name}</Text>
                    </View>
                )}
                {item.is_edited && (
                    <View style={styles.editedPill}>
                        <Text style={styles.editedPillText}>Edited</Text>
                    </View>
                )}
            </View>

            {/* Count row */}
            <View style={styles.countRow}>
                <Text style={[styles.countText, { color: COLORS.present }]}>
                    ✅ {item.present_count} present
                </Text>
                <Text style={styles.dot}>•</Text>
                <Text style={[styles.countText, { color: COLORS.absent }]}>
                    ❌ {item.absent_count} absent
                </Text>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.countText}>{item.total_count} total</Text>
            </View>
        </View>
    )
})

export function StudentHistoryScreen() {
    const { classId } = useAuthStore()
    const [sessions, setSessions] = useState<SessionSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const load = useCallback(async (isRefresh = false) => {
        if (!classId) return
        if (isRefresh) setRefreshing(true)
        else setLoading(true)
        try {
            const data = await getSessionHistory(classId)
            setSessions(data)
        } catch (e: any) {
            const userMsg =
              e?.code?.startsWith('PGRST') ||
              e?.code?.startsWith('42') ||
              e?.code?.startsWith('23')
                ? 'Something went wrong. Please try again.'
                : e?.message ?? 'An unexpected error occurred.'
            Alert.alert('Error', userMsg)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [classId])

    useFocusEffect(useCallback(() => { load() }, [load]))

    const renderItem = useCallback(({ item }: { item: SessionSummary }) => (
        <HistoryCard item={item} />
    ), [])

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Attendance History</Text>
                <Text style={styles.headerSub}>Read-only • Your class sessions</Text>
            </View>

            <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => load(true)}
                        colors={[COLORS.primary]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyTitle}>No sessions yet</Text>
                        <Text style={styles.emptySub}>
                            Attendance sessions will appear here once your CR takes attendance.
                        </Text>
                    </View>
                }
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
    headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
    list: { padding: 16, paddingBottom: 40 },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
        padding: 14, marginBottom: 12,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    subjectName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
    faculty: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    pctBox: {
        backgroundColor: COLORS.primary + '15',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    },
    pctText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    metaText: { fontSize: 12, color: COLORS.textMuted },
    batchPill: {
        backgroundColor: COLORS.success + '20',
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    },
    batchPillText: { fontSize: 11, fontWeight: '600', color: COLORS.success },
    editedPill: {
        backgroundColor: '#F59E0B20',
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    },
    editedPillText: { fontSize: 11, fontWeight: '600', color: '#92400E' },
    countRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    countText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
    dot: { fontSize: 12, color: COLORS.textMuted },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    emptySub: {
        fontSize: 13, color: COLORS.textSecondary,
        textAlign: 'center', marginTop: 8, paddingHorizontal: 32,
    },
})