import React from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Share,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { HomeStackParams } from '../../navigation/CRNavigator'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { getDisplayRoll } from '../../utils/rollNumberUtils'
import { showSuccessDialog, showErrorDialog } from '../../store/dialogStore'

type SummaryRoute = RouteProp<HomeStackParams, 'AttendanceSummary'>
type SummaryNav = StackNavigationProp<HomeStackParams, 'AttendanceSummary'>

function formatDateDisplay(iso: string): string {
    const [y, m, day] = iso.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${day} ${months[parseInt(m, 10) - 1]} ${y}`
}

export function AttendanceSummaryScreen() {
    const route = useRoute<SummaryRoute>()
    const navigation = useNavigation<SummaryNav>()
    const { name, role, branch, year, semester, section } = useAuthStore()

    const {
        subjectName, facultyName, subjectType, dateSelected, presentCount, absentCount,
        totalCount, absentRolls, presentRolls, batchName, durationHours, substituteTeacher,
    } = route.params

    const attendancePercent = totalCount > 0
        ? Math.round((presentCount / totalCount) * 100)
        : 0

    // ── Share text builder ─────────────────────────────────────
    function buildShareText(): string {
        const dateFormatted = (() => {
            const [y, m, day] = dateSelected.split('-')
            return `${day}-${m}-${y}`
        })()

        const absentDisplay = absentRolls.map(getDisplayRoll).join(', ') || 'None'
        const presentDisplay = presentRolls.map(getDisplayRoll).join(', ') || 'None'
        const durationText = durationHours && durationHours > 1 ? `Duration: ${durationHours} Hours` : ''
        const substituteText = substituteTeacher ? `Faculty: ${substituteTeacher} (Substitute)` : `Faculty: ${facultyName}`

        return [
            'ATTENZA ATTENDANCE SUMMARY',
            '',
            `Date: ${dateFormatted}`,
            `Section: ${branch} - ${section} | Year ${year} SEM ${semester}`,
            `Subject: ${subjectName.toUpperCase()}${batchName ? ` (${batchName})` : ''}`,
            substituteText,
            durationText,
            `Type: ${subjectType}`,
            '',
            `Present (${presentCount}):`,
            presentDisplay,
            '',
            `Absent (${absentCount}):`,
            absentDisplay,
            '',
            `Total Present: ${presentCount} | Total Absent: ${absentCount} | Strength: ${totalCount} (${attendancePercent}%)`,
            '',
            `Taken by: ${role} | ${name}`,
        ].filter(Boolean).join('\n')
    }

    async function handleCopy() {
        const text = buildShareText()
        await Clipboard.setStringAsync(text)
        showSuccessDialog('Copied!', 'Attendance report copied to clipboard.')
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

    const pctColor = attendancePercent >= 75
        ? COLORS.present
        : attendancePercent >= 60
            ? '#F59E0B'
            : COLORS.absent

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
                    <Text style={styles.backText}>Edit</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Session Summary</Text>
                <TouchableOpacity onPress={() => navigation.popToTop()} style={styles.doneBtn} activeOpacity={0.7}>
                    <Ionicons name="checkmark-done" size={16} color={COLORS.primary} style={{ marginRight: 3 }} />
                    <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Big Attendance % Card */}
                <View style={[styles.percentCard, { backgroundColor: COLORS.surface }]}>
                    <View style={styles.percentHeaderRow}>
                        <View style={[styles.statusPill, { backgroundColor: pctColor + '18', borderColor: pctColor + '40' }]}>
                            <Ionicons
                                name={attendancePercent >= 75 ? "checkmark-circle" : attendancePercent >= 60 ? "alert-circle" : "close-circle"}
                                size={13}
                                color={pctColor}
                                style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.statusPillText, { color: pctColor }]}>
                                {attendancePercent >= 75 ? 'Good Attendance' : attendancePercent >= 60 ? 'Moderate' : 'Low Attendance'}
                            </Text>
                        </View>
                        {durationHours && durationHours > 1 ? (
                            <View style={styles.durationPill}>
                                <Text style={styles.durationPillText}>{durationHours}h Session</Text>
                            </View>
                        ) : null}
                    </View>

                    <Text style={[styles.percentNum, { color: pctColor }]}>{attendancePercent}%</Text>
                    <Text style={styles.percentLabel}>Attendance Rate</Text>

                    <View style={styles.cardDivider} />

                    <Text style={styles.subjectName}>{subjectName}</Text>
                    <View style={styles.metaRow}>
                        {batchName ? <Text style={styles.batchLabel}>{batchName} • </Text> : null}
                        <Text style={styles.dateLabel}>{formatDateDisplay(dateSelected)}</Text>
                    </View>
                    <Text style={styles.facultyLabel}>
                        {substituteTeacher ? `Substitute: ${substituteTeacher}` : `Faculty: ${facultyName}`}
                    </Text>
                </View>

                {/* 3 Metrics Row */}
                <View style={styles.countRow}>
                    <View style={[styles.countBox, { backgroundColor: '#ECFDF5', borderColor: '#86EFAC' }]}>
                        <Text style={[styles.countNum, { color: '#15803D' }]}>{presentCount}</Text>
                        <Text style={[styles.countLabel, { color: '#166534' }]}>Present</Text>
                    </View>
                    <View style={[styles.countBox, { backgroundColor: '#FFF5F5', borderColor: '#FECACA' }]}>
                        <Text style={[styles.countNum, { color: '#DC2626' }]}>{absentCount}</Text>
                        <Text style={[styles.countLabel, { color: '#991B1B' }]}>Absent</Text>
                    </View>
                    <View style={[styles.countBox, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
                        <Text style={[styles.countNum, { color: COLORS.primary }]}>{totalCount}</Text>
                        <Text style={[styles.countLabel, { color: '#3730A3' }]}>Total</Text>
                    </View>
                </View>

                {/* Absentees List */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={[styles.sectionIndicator, { backgroundColor: COLORS.absent }]} />
                        <Text style={styles.sectionTitle}>Absent Students ({absentCount})</Text>
                    </View>
                    {absentRolls.length > 0 ? (
                        <View style={styles.rollWrap}>
                            {absentRolls.map((roll) => (
                                <View key={roll} style={styles.absentPill}>
                                    <Text style={styles.absentPillText}>{getDisplayRoll(roll)}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyStateBox}>
                            <Ionicons name="shield-checkmark" size={16} color="#15803D" style={{ marginRight: 6 }} />
                            <Text style={styles.emptyStateText}>Full strength! No students were absent.</Text>
                        </View>
                    )}
                </View>

                {/* Present List */}
                {presentRolls.length > 0 && (
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={[styles.sectionIndicator, { backgroundColor: COLORS.present }]} />
                            <Text style={styles.sectionTitle}>Present Students ({presentCount})</Text>
                        </View>
                        <View style={styles.rollWrap}>
                            {presentRolls.map((roll) => (
                                <View key={roll} style={styles.presentPill}>
                                    <Text style={styles.presentPillText}>{getDisplayRoll(roll)}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Share Actions */}
                <View style={styles.shareRow}>
                    <TouchableOpacity
                        style={styles.primaryShareBtn}
                        onPress={handleShare}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="share-social-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.primaryShareBtnText}>Share via WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.outlineShareBtn}
                        onPress={handleCopy}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="copy-outline" size={18} color={COLORS.textPrimary} style={{ marginRight: 6 }} />
                        <Text style={styles.outlineShareBtnText}>Copy Text Report</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 32 }} />
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    },
    headerBackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
    },
    backText: { fontSize: 15, color: COLORS.primary, fontWeight: '700' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
    doneBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    doneText: { fontSize: 15, color: COLORS.success, fontWeight: '700' },
    content: { padding: 16 },

    // Big Modern Percent Card
    percentCard: {
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    percentHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: '700',
    },
    durationPill: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    durationPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    percentNum: { fontSize: 56, fontWeight: '900', letterSpacing: -1 },
    percentLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
    cardDivider: {
        width: '100%',
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 14,
    },
    subjectName: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    batchLabel: { fontSize: 13, color: COLORS.success, fontWeight: '700' },
    dateLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
    facultyLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, fontWeight: '500' },

    // 3 Count boxes
    countRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    countBox: {
        flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
        borderWidth: 1,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    countNum: { fontSize: 24, fontWeight: '900' },
    countLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },

    // Section Cards
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
        marginBottom: 12,
    },
    sectionIndicator: {
        width: 4,
        height: 14,
        borderRadius: 2,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    rollWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

    absentPill: {
        backgroundColor: '#FFF5F5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    absentPillText: { color: '#DC2626', fontWeight: '800', fontSize: 13 },

    presentPill: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    presentPillText: { color: '#15803D', fontWeight: '800', fontSize: 13 },

    emptyStateBox: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#15803D',
    },

    // Share buttons
    shareRow: { gap: 10, marginTop: 4 },
    primaryShareBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 14,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3,
    },
    primaryShareBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    outlineShareBtn: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    outlineShareBtnText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
})
