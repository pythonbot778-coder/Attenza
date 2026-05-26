import React, { useCallback, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Share } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { HomeStackParams } from '../../navigation/CRNavigator'
import { COLORS } from '../../constants/colors'
import { getDisplayRoll } from '../../utils/rollNumberUtils'
import { getSubjectStats, SubjectStats } from '../../api/statsApi'
import { useAuthStore } from '../../store/authStore'

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
    track: { height: 6, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden', flex: 1 },
    fill: { height: '100%', borderRadius: 3 },
})

type TabType = 'overview' | 'sessions' | 'students'

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
            Alert.alert('Error', userMsg)
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
            '🎓 ATTENZA',
            '',
            `📖 Subject: ${subjectName}`,
            `👨‍🏫 Faculty: ${facultyName}`,
            `🔖 Type: ${type}`,
            `📊 Average Attendance: ${avg}%`,
            '',
            '📅 Sessions',
            sessionsText,
            '',
            '⚠️ At Risk Students',
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
            Alert.alert('Error', userMsg)
        }
    }

    async function handleCopy() {
        if (!stats) return
        await Clipboard.setStringAsync(reportText)
        Alert.alert('Copied', 'Stats report copied to clipboard.')
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{subjectName}</Text>
                    <Text style={styles.headerSub}>{facultyName}</Text>
                </View>
                <View style={[styles.typeBadge, { backgroundColor: isLab ? COLORS.success + '20' : COLORS.primary + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: isLab ? COLORS.success : COLORS.primary }]}>{type}</Text>
                </View>
            </View>

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

            <View style={styles.tabRow}>
                {(['overview', 'sessions', 'students'] as TabType[]).map((t) => (
                    <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
                        <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t === 'overview' ? '📊 Overview' : t === 'sessions' ? '📅 Sessions' : '👥 Students'}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.centered}><Text style={styles.loadingText}>Loading stats...</Text></View>
            ) : !stats || stats.totalSessions === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyIcon}>📭</Text>
                    <Text style={styles.emptyTitle}>No sessions yet</Text>
                    <Text style={styles.emptySubtitle}>Mark attendance to see stats</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {activeTab === 'overview' && (
                        <>
                            <View style={[styles.bigCard, { backgroundColor: pctColor(stats.avgAttendance) }]}>
                                <Text style={styles.bigPct}>{stats.avgAttendance}%</Text>
                                <Text style={styles.bigLabel}>Average Attendance</Text>
                                <Text style={styles.bigSub}>{stats.totalSessions} sessions recorded</Text>
                            </View>

                            <View style={styles.summaryRow}>
                                <View style={[styles.summaryBox, { backgroundColor: COLORS.present + '15' }]}>
                                    <Text style={[styles.summaryNum, { color: COLORS.present }]}>{stats.totalPresent}</Text>
                                    <Text style={styles.summaryLabel}>Total Present</Text>
                                </View>
                                <View style={[styles.summaryBox, { backgroundColor: COLORS.absent + '15' }]}>
                                    <Text style={[styles.summaryNum, { color: COLORS.absent }]}>{stats.totalAbsent}</Text>
                                    <Text style={styles.summaryLabel}>Total Absent</Text>
                                </View>
                                <View style={[styles.summaryBox, { backgroundColor: COLORS.primary + '15' }]}>
                                    <Text style={[styles.summaryNum, { color: COLORS.primary }]}>{stats.totalStrength}</Text>
                                    <Text style={styles.summaryLabel}>Strength</Text>
                                </View>
                            </View>

                            <View style={styles.actionRow}>
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.primary }]} onPress={handleShare}>
                                    <Text style={styles.actionBtnText}>Share</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={handleCopy}>
                                    <Text style={[styles.actionBtnText, { color: COLORS.textPrimary }]}>Copy</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>Recent Trend</Text>
                                {stats.sessions.slice(-5).reverse().map((s) => (
                                    <View key={s.id} style={styles.trendRow}>
                                        <Text style={styles.trendDate}>{formatDate(s.date_selected)}</Text>
                                        <PctBar pct={s.percent} />
                                        <Text style={[styles.trendPct, { color: pctColor(s.percent) }]}>{s.percent}%</Text>
                                    </View>
                                ))}
                            </View>

                            {stats.totalSessions >= 3 && (
                                <View style={styles.sectionCard}>
                                    <Text style={styles.sectionTitle}>⚠️ At Risk</Text>
                                    {stats.studentStats.filter(s => s.percent < 75).slice(0, 10).map((s) => (
                                        <View key={s.roll_number} style={styles.riskRow}>
                                            <Text style={styles.riskRoll}>{getDisplayRoll(s.roll_number)}</Text>
                                            <PctBar pct={s.percent} />
                                            <Text style={[styles.riskPct, { color: pctColor(s.percent) }]}>{s.percent}%</Text>
                                        </View>
                                    ))}
                                    {stats.studentStats.filter(s => s.percent < 75).length === 0 && (
                                        <Text style={styles.allGood}>✅ All students above 75%</Text>
                                    )}
                                </View>
                            )}
                        </>
                    )}

                    {activeTab === 'sessions' && (
  <View style={styles.sectionCard}>
    <Text style={styles.sectionTitle}>{stats.totalSessions} Sessions</Text>
    {stats.sessions.map((s) => (
      <View key={s.id} style={styles.sessionRow}>
        <View style={styles.sessionLeft}>
          <Text style={styles.sessionDate}>{formatDate(s.date_selected)}</Text>
          {/* ✅ Show batch label per session */}
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
                            <Text style={styles.sectionTitle}>{stats.studentStats.length} Students</Text>
                            {stats.studentStats.map((s) => (
                                <View key={s.roll_number} style={styles.studentRow}>
                                    <View style={[styles.studentPct, { backgroundColor: pctColor(s.percent) + '20' }]}>
                                        <Text style={[styles.studentPctText, { color: pctColor(s.percent) }]}>{s.percent}%</Text>
                                    </View>
                                    <View style={styles.studentInfo}>
                                        <Text style={styles.studentRoll}>{getDisplayRoll(s.roll_number)}</Text>
                                        {s.name && <Text style={styles.studentName} numberOfLines={1}>{s.name}</Text>}
                                        <PctBar pct={s.percent} />
                                    </View>
                                    <Text style={styles.studentCounts}>{s.presentCount}/{s.totalSessions}</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
    headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    typeBadgeText: { fontSize: 12, fontWeight: '700' },
    batchWrap: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    batchHalf: {
        flex: 1,
        height: 60,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    batchHalfActive: {
        backgroundColor: COLORS.success,
        borderColor: COLORS.success,
    },
    batchHalfText: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textSecondary,
    },
    batchHalfTextActive: {
        color: '#fff',
    },
    tabRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: COLORS.primary },
    tabText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
    tabTextActive: { color: COLORS.primary },
    content: {
        padding: 16,
        paddingTop: 18,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    loadingText: { color: COLORS.textMuted, fontSize: 14 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
    emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
    bigCard: { borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 16 },
    bigPct: { fontSize: 64, fontWeight: '900', color: '#fff' },
    bigLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    bigSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 },
    summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    summaryBox: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14 },
    summaryNum: { fontSize: 24, fontWeight: '900' },
    summaryLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, marginTop: 3 },
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    actionBtnOutline: { backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border },
    actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    sectionCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    trendDate: { fontSize: 12, color: COLORS.textSecondary, width: 70 },
    trendPct: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },
    riskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    riskRoll: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, width: 48 },
    riskPct: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },
    allGood: { fontSize: 13, color: COLORS.present, fontWeight: '600' },
    sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border + '60' },
    sessionLeft: {
        width: 128,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    sessionDate: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
    editedPill: { backgroundColor: '#F59E0B20', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
    editedPillText: { fontSize: 9, fontWeight: '700', color: '#F59E0B' },
    sessionMid: {
        flex: 1,
        marginLeft: 6,
        marginRight: 8,
    },
    sessionRight: {
        alignItems: 'flex-end',
        width: 40,
    },
    sessionPct: { fontSize: 13, fontWeight: '800' },
    sessionCounts: { fontSize: 10, color: COLORS.textMuted },
    studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border + '60' },
    studentPct: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    studentPctText: { fontSize: 14, fontWeight: '900' },
    studentInfo: { flex: 1, gap: 4 },
    studentRoll: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    studentName: { fontSize: 11, color: COLORS.textSecondary },
    studentCounts: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
    batchTag: {
        backgroundColor: COLORS.success + '20',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 2,
    },
    batchTagText: {
        fontSize: 9,
        fontWeight: '700',
        color: COLORS.success,
    },
})
