import React, { useCallback, useState, useMemo } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, ActivityIndicator, ScrollView,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { HistoryStackParams } from '../../navigation/CRNavigator'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import {
    getSessionHistory,
    deleteSession,
    SessionSummary,
} from '../../api/historyApi'
import { showConfirmDialog, showErrorDialog } from '../../store/dialogStore'
import { HistoryCardSkeleton } from '../../components/SkeletonLoader'
import { useCacheStore } from '../../store/cacheStore'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function formatDateShort(iso: string): string {
    const [, m, d] = iso.split('-')
    return `${d} ${MONTHS[parseInt(m, 10) - 1]}`
}

function todayString(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function canEdit(takenAt: string): boolean {
    const taken = new Date(takenAt).getTime()
    const diffMinutes = (Date.now() - taken) / (1000 * 60)
    return diffMinutes <= 30
}

function minutesLeft(takenAt: string): number {
    const taken = new Date(takenAt).getTime()
    const diff = 30 - (Date.now() - taken) / (1000 * 60)
    return Math.max(0, Math.floor(diff))
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
    const isEditable = canEdit(session.taken_at)
    const minLeft = minutesLeft(session.taken_at)

    return (
        <TouchableOpacity
            style={styles.sessionCard}
            activeOpacity={0.85}
            onLongPress={() => onLongPress(session)}
            onPress={() => onPress(session)}
        >
            {/* Left accent strip */}
            <View style={[styles.accent, { backgroundColor: isLab ? COLORS.success : COLORS.primary }]} />

            <View style={styles.sessionInfo}>
                <View style={styles.sessionTop}>
                    <Text style={styles.sessionSubject} numberOfLines={1}>
                        {session.subject.name}
                    </Text>
                    <View style={[styles.typeBadge,
                    {
                        backgroundColor: isLab ? '#DCFCE7' : '#EEF2FF',
                        borderColor: isLab ? '#86EFAC' : '#C7D2FE',
                    }]}>
                        <Text style={[styles.typeBadgeText,
                        { color: isLab ? '#15803D' : COLORS.primary }]}>
                            {session.subject.type}
                        </Text>
                    </View>
                </View>

                <View style={styles.facultyRow}>
                    <Ionicons name="person-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.sessionFaculty} numberOfLines={1}>{session.subject.faculty_name}</Text>
                </View>

                {session.batch_name && (
                    <View style={styles.batchPill}>
                        <Text style={styles.batchPillText}>{session.batch_name}</Text>
                    </View>
                )}

                {/* Status Badges row: Editable vs Locked + Edited badge */}
                <View style={styles.statusBadgesRow}>
                    {isEditable ? (
                        <View style={styles.editableBadge}>
                            <View style={styles.editableDot} />
                            <Text style={styles.editableBadgeText}>Editable - {minLeft}m left</Text>
                        </View>
                    ) : (
                        <View style={styles.lockedBadge}>
                            <Ionicons name="lock-closed" size={10} color={COLORS.textMuted} />
                            <Text style={styles.lockedBadgeText}>Locked</Text>
                        </View>
                    )}

                    {session.is_edited && (
                        <View style={styles.editedBadge}>
                            <Ionicons name="pencil" size={10} color="#D97706" />
                            <Text style={styles.editedBadgeText}>Edited</Text>
                        </View>
                    )}
                </View>

                <View style={styles.sessionBottom}>
                    <View style={styles.countsWrap}>
                        <Text style={styles.sessionCounts}>
                            <Text style={{ color: '#15803D', fontWeight: '700' }}>{session.present_count}</Text> Present
                            {'  •  '}
                            <Text style={{ color: '#DC2626', fontWeight: '700' }}>{session.absent_count}</Text> Absent
                            {'  •  '}
                            <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>{session.total_count}</Text> Total
                        </Text>
                    </View>
                    <View style={[styles.pctBadge, { backgroundColor: pctColor + '18', borderColor: pctColor + '40' }]}>
                        <Text style={[styles.pctText, { color: pctColor }]}>{pct}%</Text>
                    </View>
                </View>
            </View>

            {isDeleting && (
                <View style={styles.deletingWrap}>
                    <ActivityIndicator size="small" color={COLORS.absent} />
                </View>
            )}
        </TouchableOpacity>
    )
})

export function HistoryScreen() {
    const navigation = useNavigation<StackNavigationProp<HistoryStackParams>>()
    const { classId, year, semester } = useAuthStore()

    const semLabel = year != null && semester != null ? `Y${year}S${semester}` : 'ALL'
    const cacheKey = `${classId}_${semLabel}`
    const cachedSessions = classId ? useCacheStore.getState().sessions[cacheKey] : undefined

    const [sessions, setSessions] = useState<SessionSummary[]>(cachedSessions ? (cachedSessions as SessionSummary[]) : [])
    const [loading, setLoading] = useState(!cachedSessions || cachedSessions.length === 0)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [filterType, setFilterType] = useState<'ALL' | 'CLASS' | 'LAB'>('ALL')
    const [selectedDateFilter, setSelectedDateFilter] = useState<string | 'ALL'>('ALL')

    async function loadHistory(force = false) {
        if (!classId) return
        const isStale = useCacheStore.getState().historyStale
        const cached = useCacheStore.getState().sessions[cacheKey]

        // Strict local cache check: if data exists and not stale, do NOT query database
        if (!force && !isStale && cached && cached.length > 0) {
            setSessions(cached as SessionSummary[])
            setLoading(false)
            return
        }

        try {
            if (!cached || cached.length === 0) {
                setLoading(true)
            }
            const querySem = semLabel === 'ALL' ? undefined : semLabel
            const data = await getSessionHistory(classId, querySem)
            setSessions(data)
            useCacheStore.getState().setSessions(cacheKey, data as any)
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

    useFocusEffect(useCallback(() => { loadHistory(false) }, [classId, cacheKey]))

    const confirmDelete = useCallback((session: SessionSummary) => {
        showConfirmDialog(
            'Delete Session?',
            `${session.subject.name} — ${formatDate(session.date_selected)}\n\nThis attendance session and all its records will be permanently removed. This cannot be undone.`,
            async () => {
                setDeleting(session.id)
                try {
                    await deleteSession(session.id)
                    setSessions((prev) => {
                        const updated = prev.filter((s) => s.id !== session.id)
                        useCacheStore.getState().setSessions(cacheKey, updated as any)
                        return updated
                    })
                } catch (err: any) {
                    showErrorDialog('Error', err?.message ?? 'Failed to delete session.')
                } finally {
                    setDeleting(null)
                }
            },
            undefined,
            'Delete',
            'Cancel',
            true // isDestructive
        )
    }, [cacheKey])

    // Extract unique dates for the calendar filter strip
    const availableDates = useMemo(() => {
        const set = new Set<string>()
        sessions.forEach((s) => set.add(s.date_selected))
        return Array.from(set).sort((a, b) => b.localeCompare(a))
    }, [sessions])

    // Filter by type and date
    const filtered = useMemo(() => {
        return sessions.filter((s) => {
            const matchesType = filterType === 'ALL' ? true : s.subject.type === filterType
            const matchesDate = selectedDateFilter === 'ALL' ? true : s.date_selected === selectedDateFilter
            return matchesType && matchesDate
        })
    }, [sessions, filterType, selectedDateFilter])

    // Group by date
    const grouped = useMemo(() => {
        return filtered.reduce((acc, session) => {
            const key = session.date_selected
            if (!acc[key]) acc[key] = []
            acc[key].push(session)
            return acc
        }, {} as Record<string, SessionSummary[]>)
    }, [filtered])

    const groupedList = useMemo(() => {
        return Object.entries(grouped).map(([date, items]) => ({
            date,
            items,
        }))
    }, [grouped])

    const handlePress = useCallback((session: SessionSummary) => {
        navigation.navigate('SessionDetail', { sessionId: session.id, session })
    }, [navigation])

    const handleLongPress = useCallback((session: SessionSummary) => {
        confirmDelete(session)
    }, [confirmDelete])

    const renderItem = useCallback(({ item }: { item: { date: string, items: SessionSummary[] } }) => (
        <View style={styles.dateGroup}>
            <View style={styles.dateHeaderRow}>
                <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
                <Text style={styles.dateHeader}>{formatDate(item.date)}</Text>
                {item.date === todayString() && (
                    <View style={styles.todayTag}>
                        <Text style={styles.todayTagText}>Today</Text>
                    </View>
                )}
            </View>
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
                <View style={styles.headerTitleRow}>
                    {navigation.canGoBack() && (
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
                            <Text style={styles.backText}>Back</Text>
                        </TouchableOpacity>
                    )}
                    <Text style={styles.headerTitle}>Attendance History</Text>
                </View>
                <View style={styles.headerCountBadge}>
                    <Text style={styles.headerCountText}>{filtered.length} sessions</Text>
                </View>
            </View>

            {/* Date / Calendar Filter Strip */}
            {availableDates.length > 0 && (
                <View style={styles.calendarStripWrap}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.calendarStripContent}
                    >
                        <TouchableOpacity
                            style={[
                                styles.calendarDatePill,
                                selectedDateFilter === 'ALL' && styles.calendarDatePillActive,
                            ]}
                            onPress={() => setSelectedDateFilter('ALL')}
                            activeOpacity={0.75}
                        >
                            <Text style={[
                                styles.calendarDatePillText,
                                selectedDateFilter === 'ALL' && styles.calendarDatePillTextActive,
                            ]}>
                                All Dates
                            </Text>
                        </TouchableOpacity>

                        {availableDates.map((date) => {
                            const isSelected = selectedDateFilter === date
                            const isToday = date === todayString()
                            return (
                                <TouchableOpacity
                                    key={date}
                                    style={[
                                        styles.calendarDatePill,
                                        isSelected && styles.calendarDatePillActive,
                                    ]}
                                    onPress={() => setSelectedDateFilter(date)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[
                                        styles.calendarDatePillText,
                                        isSelected && styles.calendarDatePillTextActive,
                                    ]}>
                                        {isToday ? 'Today' : formatDateShort(date)}
                                    </Text>
                                </TouchableOpacity>
                            )
                        })}
                    </ScrollView>
                </View>
            )}

            {/* Subject Type Filter Row */}
            <View style={styles.filterRow}>
                {(['ALL', 'CLASS', 'LAB'] as const).map((f) => {
                    const isActive = filterType === f
                    return (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterBtn, isActive && styles.filterBtnActive]}
                            onPress={() => setFilterType(f)}
                            activeOpacity={0.75}
                        >
                            <Ionicons
                                name={f === 'ALL' ? 'grid-outline' : f === 'CLASS' ? 'book-outline' : 'flask-outline'}
                                size={13}
                                color={isActive ? '#FFFFFF' : '#0F172A'}
                            />
                            <Text style={[styles.filterBtnText, isActive && styles.filterBtnTextActive]}>
                                {f === 'ALL' ? 'All' : f === 'CLASS' ? 'Theory' : 'Lab'}
                            </Text>
                        </TouchableOpacity>
                    )
                })}
            </View>

            {loading ? (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                    <HistoryCardSkeleton />
                    <HistoryCardSkeleton />
                    <HistoryCardSkeleton />
                    <HistoryCardSkeleton />
                    <HistoryCardSkeleton />
                </ScrollView>
            ) : groupedList.length === 0 ? (
                <View style={styles.centered}>
                    <View style={styles.emptyIconBadge}>
                        <Ionicons
                            name={selectedDateFilter !== 'ALL' || filterType !== 'ALL' ? "search-outline" : "clipboard-outline"}
                            size={32}
                            color={COLORS.primary}
                        />
                    </View>
                    <Text style={styles.emptyTitle}>
                        {selectedDateFilter !== 'ALL' || filterType !== 'ALL'
                            ? 'No matching sessions 🔍'
                            : 'No attendance marked yet 📋'}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                        {selectedDateFilter !== 'ALL' || filterType !== 'ALL'
                            ? 'Try clearing the selected date or subject type filters to view all sessions.'
                            : 'Take attendance for any class or lab from the Home screen to view your session history here.'}
                    </Text>
                    {selectedDateFilter !== 'ALL' || filterType !== 'ALL' ? (
                        <TouchableOpacity
                            style={styles.emptyActionBtn}
                            onPress={() => {
                                setSelectedDateFilter('ALL')
                                setFilterType('ALL')
                            }}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.emptyActionBtnText}>Reset All Filters</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.emptyActionBtn}
                            onPress={() => {
                                const parent = navigation.getParent()
                                if (parent) (parent as any).navigate('HomeTab')
                            }}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="arrow-forward-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.emptyActionBtnText}>Go to Home & Mark Attendance</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <FlatList
                    data={groupedList}
                    keyExtractor={(item) => item.date}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    renderItem={renderItem}
                    ListFooterComponent={
                        sessions.length > 0 ? (
                            <View style={styles.hint}>
                                <Ionicons name="information-circle-outline" size={13} color={COLORS.textMuted} />
                                <Text style={styles.hintText}>Tap to view session • Long press to delete</Text>
                            </View>
                        ) : undefined
                    }
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
    },
    backText: { fontSize: 15, color: COLORS.primary, fontWeight: '700' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
    headerCountBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    headerCountText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '700' },

    // Calendar Date Strip
    calendarStripWrap: {
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingVertical: 8,
    },
    calendarStripContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    calendarDatePill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#F1F5F9',
    },
    calendarDatePillActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primaryDark,
    },
    calendarDatePillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0F172A',
    },
    calendarDatePillTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },

    // Subject type filter
    filterRow: {
        flexDirection: 'row', gap: 8, padding: 12,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    },
    filterBtn: {
        flex: 1,
        flexDirection: 'row',
        gap: 5,
        paddingVertical: 9,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterBtnActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primaryDark,
    },
    filterBtnText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
    filterBtnTextActive: { color: '#FFFFFF', fontWeight: '800' },

    list: { padding: 16, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, paddingTop: 40 },
    emptyIconBadge: {
        width: 68,
        height: 68,
        borderRadius: 24,
        backgroundColor: '#EEF2FF',
        borderWidth: 1.5,
        borderColor: '#C7D2FE',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 3,
    },
    emptyTitle: { fontSize: 19, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
    emptySubtitle: { fontSize: 13.5, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    emptyActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    emptyActionBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },

    dateGroup: { marginBottom: 20 },
    dateHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    dateHeader: {
        fontSize: 12, fontWeight: '800', color: COLORS.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.8,
    },
    todayTag: {
        backgroundColor: COLORS.primary + '18',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    todayTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.primary,
    },

    // Modern Session Card
    sessionCard: {
        flexDirection: 'row', backgroundColor: COLORS.surface,
        borderRadius: 16, marginBottom: 10,
        borderWidth: 1, borderColor: '#E2E8F0',
        overflow: 'hidden',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    accent: { width: 4 },
    sessionInfo: { flex: 1, padding: 14 },
    sessionTop: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 4,
    },
    sessionSubject: {
        fontSize: 15, fontWeight: '800',
        color: COLORS.textPrimary, flex: 1,
    },
    typeBadge: {
        paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: 8, borderWidth: 1, marginLeft: 8,
    },
    typeBadgeText: { fontSize: 10, fontWeight: '700' },
    facultyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    sessionFaculty: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
    batchPill: {
        alignSelf: 'flex-start',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 6,
    },
    batchPillText: { fontSize: 11, color: '#475569', fontWeight: '600' },

    statusBadgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
        marginBottom: 6,
    },
    editableBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#86EFAC',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    editableDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    editableBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#15803D',
    },
    lockedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    lockedBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
    editedBadge: {
        backgroundColor: '#FFFBEB',
        borderWidth: 1, borderColor: '#FDE68A',
        paddingHorizontal: 6, paddingVertical: 3,
        borderRadius: 6,
    },
    editedBadgeText: {
        fontSize: 10, fontWeight: '700', color: '#D97706',
    },

    sessionBottom: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginTop: 4,
    },
    countsWrap: { flex: 1 },
    sessionCounts: { fontSize: 12, color: COLORS.textSecondary },
    pctBadge: {
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
        borderWidth: 1,
    },
    pctText: { fontSize: 13, fontWeight: '900' },

    deletingWrap: {
        padding: 12,
        justifyContent: 'center',
    },

    hint: {
        flexDirection: 'row',
        gap: 6,
        padding: 10, alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLORS.surface,
        borderTopWidth: 1, borderTopColor: '#E2E8F0',
    },
    hintText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
})
