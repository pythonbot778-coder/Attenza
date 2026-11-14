import React, { useCallback, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, ActivityIndicator } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { HomeStackParams } from '../../navigation/CRNavigator'
import { COLORS } from '../../constants/colors'
import { getDisplayRoll } from '../../utils/rollNumberUtils'
import { getSubjectStats, SubjectStats } from '../../api/statsApi'
import { useAuthStore } from '../../store/authStore'
import { showErrorDialog, showSuccessDialog } from '../../store/dialogStore'

type StatsRoute = RouteProp<HomeStackParams, 'SubjectStats'>
type StatsNav = StackNavigationProp<HomeStackParams, 'SubjectStats'>

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(iso: string) {
    const [y, m, d] = iso.split('-')
    return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function PctBar({ pct }: { pct: number }) {
    const color = pct >= 75 ? COLORS.present : pct >= 60 ? '#F59E0B' : COLORS.absent
    return (
        <View style={barStyles.track}>
            <View style={[barStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
    )
}

const barStyles = StyleSheet.create({
    track: { height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden', flex: 1 },
    fill: { height: '100%', borderRadius: 3 },
})

type TabType = 'overview' | 'sessions' | 'students'
type StudentFilterType = 'ALL' | 'AT_RISK' | 'SAFE'

export function SubjectStatsScreen() {
    const route = useRoute<StatsRoute>()
    const navigation = useNavigation<StatsNav>()
    const { subjectId, subjectName, facultyName, type, batches } = route.params
    const isLab = type === 'LAB'
    const batchList = isLab && batches ? batches : []

    const { year, semester } = useAuthStore()
    const semLabel = useMemo(
        () => (year != null && semester != null ? `Y${year}S${semester}` : undefined),
        [year, semester],
    )

    const [activeTab, setActiveTab] = useState<TabType>('overview')
    const [studentFilter, setStudentFilter] = useState<StudentFilterType>('ALL')
    const [selectedBatch, setSelectedBatch] = useState<string | null>(isLab && batchList.length > 0 ? batchList[0].batch_name : null)
    const [stats, setStats] = useState<SubjectStats | null>(null)
    const [loading, setLoading] = useState(true)

    const loadStats = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getSubjectStats(subjectId, selectedBatch, semLabel)
            setStats(data)
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
    }, [subjectId, selectedBatch, semLabel])

    useFocusEffect(useCallback(() => { loadStats() }, [loadStats]))

    const pctColor = (pct: number) => pct >= 75 ? COLORS.present : pct >= 60 ? '#F59E0B' : COLORS.absent

    const reportText = useMemo(() => {
        if (!stats) return ''
        const avg = stats.avgAttendance
        const sessionsText = stats.sessions.slice().reverse().map((s) => `${formatDate(s.date_selected)} — ${s.percent}%`).join('\n') || 'None'
        const atRisk = stats.studentStats.filter((s) => s.percent < 75).slice(0, 10)
        const riskText = atRisk.length ? atRisk.map((s) => `${getDisplayRoll(s.roll_number)} — ${s.percent}%`).join('\n') : 'All students above 75%'
        return [
            'ATTENZA SUBJECT ANALYTICS',
            '',
            `Subject: ${subjectName}`,
            `Faculty: ${facultyName}`,
            `Type: ${type}`,
            `Average Attendance: ${avg}%`,
            '',
            'Sessions:',
            sessionsText,
            '',
            'At Risk Students (<75%):',
            riskText,
        ].join('\n')
    }, [stats, subjectName, facultyName, type])

    async function handleShare() {
        if (!stats) return
        try {
            await Share.share({ message: reportText })
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
        if (!stats) return
        await Clipboard.setStringAsync(reportText)
        showSuccessDialog('Copied!', 'Stats report copied to clipboard.')
    }

    const atRiskStudents = useMemo(() => {
        if (!stats) return []
        return stats.studentStats.filter((s) => s.percent < 75)
    }, [stats])

    const safeStudents = useMemo(() => {
        if (!stats) return []
        return stats.studentStats.filter((s) => s.percent >= 75)
    }, [stats])

    const displayedStudents = useMemo(() => {
        if (!stats) return []
        if (studentFilter === 'AT_RISK') return atRiskStudents
        if (studentFilter === 'SAFE') return safeStudents
        return stats.studentStats
    }, [stats, studentFilter, atRiskStudents, safeStudents])

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{subjectName}</Text>
                    <Text style={styles.headerSub}>{facultyName}</Text>
                </View>
                <View style={[styles.typeBadge, {
                    backgroundColor: isLab ? '#DCFCE7' : '#EEF2FF',
                    borderColor: isLab ? '#86EFAC' : '#C7D2FE',
                }]}>
                    <Text style={[styles.typeBadgeText, { color: isLab ? '#15803D' : COLORS.primary }]}>
                        {type}
                    </Text>
                </View>
            </View>

            {/* Batch Selector if Lab */}
            {isLab && batchList.length > 0 && (
                <View style={styles.batchWrap}>
                    {batchList.map((b) => {
                        const active = selectedBatch === b.batch_name
                        return (
                            <TouchableOpacity
                                key={b.batch_name}
                                style={[styles.batchHalf, active && styles.batchHalfActive]}
                                onPress={() => setSelectedBatch(b.batch_name)}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.batchHalfText, active && styles.batchHalfTextActive]}>
                                    {b.batch_name}
                                </Text>
                            </TouchableOpacity>
                        )
                    })}
                </View>
            )}

            {/* Tab Row */}
            <View style={styles.tabRow}>
                {(['overview', 'sessions', 'students'] as TabType[]).map((t) => {
                    const isActive = activeTab === t
                    return (
                        <TouchableOpacity
                            key={t}
                            style={[styles.tab, isActive && styles.tabActive]}
                            onPress={() => setActiveTab(t)}
                            activeOpacity={0.75}
                        >
                            <Ionicons
                                name={t === 'overview' ? 'bar-chart-outline' : t === 'sessions' ? 'calendar-outline' : 'people-outline'}
                                size={13}
                                color={isActive ? '#FFFFFF' : '#0F172A'}
                                style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                                {t === 'overview' ? 'Overview' : t === 'sessions' ? 'Sessions' : 'Students'}
                            </Text>
                        </TouchableOpacity>
                    )
                })}
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading subject stats...</Text>
                </View>
            ) : !stats || stats.totalSessions === 0 ? (
                <View style={styles.centered}>
                    <View style={styles.emptyIconBadge}>
                        <Ionicons name="trending-up-outline" size={32} color={COLORS.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>No sessions recorded yet 📈</Text>
                    <Text style={styles.emptySubtitle}>
                        Mark your first attendance session for {subjectName} to generate attendance rates and student analytics.
                    </Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {activeTab === 'overview' && (
                        <>
                            {/* Big Attendance % Card */}
                            <View style={styles.bigCard}>
                                <View style={styles.bigCardTop}>
                                    <View style={[styles.standingBadge, {
                                        backgroundColor: stats.avgAttendance >= 75 ? '#ECFDF5' : stats.avgAttendance >= 60 ? '#FFFBEB' : '#FFF5F5',
                                        borderColor: stats.avgAttendance >= 75 ? '#86EFAC' : stats.avgAttendance >= 60 ? '#FDE68A' : '#FECACA',
                                    }]}>
                                        <Ionicons
                                            name={stats.avgAttendance >= 75 ? "checkmark-circle" : stats.avgAttendance >= 60 ? "alert-circle" : "close-circle"}
                                            size={12}
                                            color={pctColor(stats.avgAttendance)}
                                            style={{ marginRight: 4 }}
                                        />
                                        <Text style={[styles.standingBadgeText, { color: pctColor(stats.avgAttendance) }]}>
                                            {stats.avgAttendance >= 75 ? 'Good Standing' : stats.avgAttendance >= 60 ? 'Moderate' : 'Critical Attention'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.bigPct, { color: pctColor(stats.avgAttendance) }]}>{stats.avgAttendance}%</Text>
                                <Text style={styles.bigLabel}>Average Attendance Rate</Text>
                                <Text style={styles.bigSub}>{stats.totalSessions} sessions recorded across {stats.totalStrength} students</Text>
                            </View>

                            {/* Metrics Row */}
                            <View style={styles.summaryRow}>
                                <View style={[styles.summaryBox, { backgroundColor: '#ECFDF5', borderColor: '#86EFAC' }]}>
                                    <Text style={[styles.summaryNum, { color: '#15803D' }]}>{stats.totalPresent}</Text>
                                    <Text style={styles.summaryLabel}>Total Present</Text>
                                </View>
                                <View style={[styles.summaryBox, { backgroundColor: '#FFF5F5', borderColor: '#FECACA' }]}>
                                    <Text style={[styles.summaryNum, { color: '#DC2626' }]}>{stats.totalAbsent}</Text>
                                    <Text style={styles.summaryLabel}>Total Absent</Text>
                                </View>
                                <View style={[styles.summaryBox, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
                                    <Text style={[styles.summaryNum, { color: COLORS.primary }]}>{stats.totalStrength}</Text>
                                    <Text style={styles.summaryLabel}>Class Strength</Text>
                                </View>
                            </View>

                            {/* Share / Copy buttons */}
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
                                    onPress={handleShare}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="share-social-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                                    <Text style={styles.actionBtnText}>Share Report</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.actionBtnOutline]}
                                    onPress={handleCopy}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="copy-outline" size={16} color={COLORS.textPrimary} style={{ marginRight: 6 }} />
                                    <Text style={[styles.actionBtnText, { color: COLORS.textPrimary }]}>Copy Report</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Recent Trend Card */}
                            <View style={styles.sectionCard}>
                                <View style={styles.sectionHeaderRow}>
                                    <Ionicons name="trending-up-outline" size={16} color={COLORS.primary} />
                                    <Text style={styles.sectionTitle}>Recent Trend (Last 5 Sessions)</Text>
                                </View>
                                {stats.sessions.slice(-5).reverse().map((s) => (
                                    <View key={s.id} style={styles.trendRow}>
                                        <Text style={styles.trendDate}>{formatDate(s.date_selected)}</Text>
                                        <PctBar pct={s.percent} />
                                        <Text style={[styles.trendPct, { color: pctColor(s.percent) }]}>{s.percent}%</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Low Attendance List (<75%) */}
                            <View style={styles.sectionCard}>
                                <View style={styles.sectionHeaderRow}>
                                    <Ionicons name="warning-outline" size={16} color={COLORS.absent} />
                                    <Text style={styles.sectionTitle}>Low Attendance Alert (&lt;75%)</Text>
                                    <View style={styles.riskCountPill}>
                                        <Text style={styles.riskCountText}>{atRiskStudents.length} Students</Text>
                                    </View>
                                </View>
                                {atRiskStudents.length > 0 ? (
                                    atRiskStudents.slice(0, 10).map((s) => (
                                        <View key={s.roll_number} style={styles.riskRow}>
                                            <View style={styles.riskRollWrap}>
                                                <Text style={styles.riskRoll}>{getDisplayRoll(s.roll_number)}</Text>
                                                {s.name && <Text style={styles.riskName} numberOfLines={1}>{s.name.split(' ')[0]}</Text>}
                                            </View>
                                            <PctBar pct={s.percent} />
                                            <View style={[styles.riskBadge, { backgroundColor: pctColor(s.percent) + '18' }]}>
                                                <Text style={[styles.riskPct, { color: pctColor(s.percent) }]}>{s.percent}%</Text>
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.allGoodBox}>
                                        <Ionicons name="checkmark-circle" size={20} color="#15803D" />
                                        <Text style={styles.allGood}>Great job! All students are above 75% attendance.</Text>
                                    </View>
                                )}
                            </View>
                        </>
                    )}

                    {activeTab === 'sessions' && (
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeaderRow}>
                                <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                                <Text style={styles.sectionTitle}>{stats.totalSessions} Sessions Recorded</Text>
                            </View>
                            {stats.sessions.map((s) => (
                                <View key={s.id} style={styles.sessionRow}>
                                    <View style={styles.sessionLeft}>
                                        <Text style={styles.sessionDate}>{formatDate(s.date_selected)}</Text>
                                        {s.batch_name && (
                                            <View style={styles.batchTag}>
                                                <Text style={styles.batchTagText}>{s.batch_name}</Text>
                                            </View>
                                        )}
                                        {s.is_edited && (
                                            <View style={styles.editedPill}>
                                                <Text style={styles.editedPillText}>edited</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.sessionMid}>
                                        <PctBar pct={s.percent} />
                                    </View>
                                    <View style={styles.sessionRight}>
                                        <Text style={[styles.sessionPct, { color: pctColor(s.percent) }]}>{s.percent}%</Text>
                                        <Text style={styles.sessionCounts}>{s.present}/{s.total}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {activeTab === 'students' && (
                        <View style={styles.sectionCard}>
                            {/* Student Filter Chips */}
                            <View style={styles.studentFilterRow}>
                                <TouchableOpacity
                                    style={[styles.studentFilterChip, studentFilter === 'ALL' && styles.studentFilterChipActive]}
                                    onPress={() => setStudentFilter('ALL')}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[styles.studentFilterText, studentFilter === 'ALL' && styles.studentFilterTextActive]}>
                                        All ({stats.studentStats.length})
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.studentFilterChip, studentFilter === 'AT_RISK' && styles.studentFilterChipActive]}
                                    onPress={() => setStudentFilter('AT_RISK')}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons
                                        name="alert-circle"
                                        size={12}
                                        color={studentFilter === 'AT_RISK' ? '#FFFFFF' : '#DC2626'}
                                        style={{ marginRight: 3 }}
                                    />
                                    <Text style={[styles.studentFilterText, studentFilter === 'AT_RISK' && styles.studentFilterTextActive]}>
                                        &lt;75% ({atRiskStudents.length})
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.studentFilterChip, studentFilter === 'SAFE' && styles.studentFilterChipActive]}
                                    onPress={() => setStudentFilter('SAFE')}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={12}
                                        color={studentFilter === 'SAFE' ? '#FFFFFF' : '#15803D'}
                                        style={{ marginRight: 3 }}
                                    />
                                    <Text style={[styles.studentFilterText, studentFilter === 'SAFE' && styles.studentFilterTextActive]}>
                                        ≥75% ({safeStudents.length})
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {displayedStudents.map((s) => (
                                <View key={s.roll_number} style={styles.studentRow}>
                                    <View style={[styles.studentPct, {
                                        backgroundColor: pctColor(s.percent) + '18',
                                        borderColor: pctColor(s.percent) + '40',
                                    }]}>
                                        <Text style={[styles.studentPctText, { color: pctColor(s.percent) }]}>{s.percent}%</Text>
                                    </View>
                                    <View style={styles.studentInfo}>
                                        <View style={styles.studentNameRow}>
                                            <Text style={styles.studentRoll}>{getDisplayRoll(s.roll_number)}</Text>
                                            {s.name && <Text style={styles.studentName} numberOfLines={1}>{s.name}</Text>}
                                        </View>
                                        <PctBar pct={s.percent} />
                                    </View>
                                    <View style={styles.studentCountsWrap}>
                                        <Text style={styles.studentCounts}>{s.presentCount}/{s.totalSessions}</Text>
                                        <Text style={styles.studentCountsSub}>Attended</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
        backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    },
    backBtn: { padding: 4 },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
    headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1, fontWeight: '500' },
    typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
    typeBadgeText: { fontSize: 11, fontWeight: '700' },

    batchWrap: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    batchHalf: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    batchHalfActive: {
        backgroundColor: COLORS.success,
        borderColor: COLORS.success,
    },
    batchHalfText: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.textSecondary,
    },
    batchHalfTextActive: {
        color: '#fff',
    },
    tabRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: COLORS.primary },
    tabText: { fontSize: 13, fontWeight: '700', color: '#334155' },
    tabTextActive: { color: COLORS.primary, fontWeight: '800' },
    content: {
        padding: 16,
        paddingTop: 16,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    loadingText: { color: COLORS.textMuted, fontSize: 13, marginTop: 10, fontWeight: '500' },
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
    emptySubtitle: { fontSize: 13.5, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 },

    // Big Card
    bigCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 22,
        alignItems: 'center',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    bigCardTop: {
        marginBottom: 8,
    },
    standingBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    standingBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    bigPct: { fontSize: 56, fontWeight: '900', letterSpacing: -1 },
    bigLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
    bigSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 6, fontWeight: '500' },

    // Summary 3-box row
    summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    summaryBox: {
        flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
        borderWidth: 1,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    summaryNum: { fontSize: 22, fontWeight: '900' },
    summaryLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },

    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    actionBtn: {
        flex: 1, paddingVertical: 12, borderRadius: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25, shadowRadius: 4, elevation: 2,
    },
    actionBtnOutline: {
        backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: '#E2E8F0',
        shadowColor: '#000', shadowOpacity: 0.04,
    },
    actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    sectionCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
    },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
    riskCountPill: {
        backgroundColor: '#FFF5F5',
        borderWidth: 1,
        borderColor: '#FECACA',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    riskCountText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#DC2626',
    },

    trendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    trendDate: { fontSize: 12, color: COLORS.textSecondary, width: 84, fontWeight: '500' },
    trendPct: { fontSize: 12, fontWeight: '800', width: 36, textAlign: 'right' },

    riskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    riskRollWrap: { width: 90 },
    riskRoll: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
    riskName: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },
    riskBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        width: 44,
        alignItems: 'center',
    },
    riskPct: { fontSize: 12, fontWeight: '800' },
    allGoodBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
    },
    allGood: { fontSize: 13, color: '#15803D', fontWeight: '600' },

    sessionRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    },
    sessionLeft: {
        width: 120,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    sessionDate: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
    editedPill: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
    editedPillText: { fontSize: 9, fontWeight: '700', color: '#D97706' },
    sessionMid: {
        flex: 1,
        marginHorizontal: 6,
    },
    sessionRight: {
        alignItems: 'flex-end',
        width: 44,
    },
    sessionPct: { fontSize: 13, fontWeight: '800' },
    sessionCounts: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },

    // Student list
    studentFilterRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    studentFilterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#F1F5F9',
    },
    studentFilterChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primaryDark,
    },
    studentFilterText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0F172A',
    },
    studentFilterTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    studentRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    },
    studentPct: {
        width: 44, height: 44, borderRadius: 12, borderWidth: 1,
        justifyContent: 'center', alignItems: 'center',
    },
    studentPctText: { fontSize: 13, fontWeight: '900' },
    studentInfo: { flex: 1, gap: 4 },
    studentNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    studentRoll: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
    studentName: { fontSize: 11, color: COLORS.textSecondary, flex: 1 },
    studentCountsWrap: {
        alignItems: 'flex-end',
    },
    studentCounts: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
    studentCountsSub: { fontSize: 9, color: COLORS.textMuted, fontWeight: '500' },
    batchTag: {
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#86EFAC',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 6,
    },
    batchTagText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#15803D',
    },
})
