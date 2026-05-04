import React from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Share, Alert,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { HomeStackParams } from '../../navigation/CRNavigator'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { getDisplayRoll } from '../../utils/rollNumberUtils'
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
        totalCount, absentRolls, presentRolls, batchName,
    } = route.params

    const attendancePercent = totalCount > 0
        ? Math.round((presentCount / totalCount) * 100)
        : 0

    // ── Share text builder ─────────────────────────────────────
    function buildShareText(): string {
        const { facultyName, subjectType } = route.params

        const dateFormatted = (() => {
            const [y, m, day] = dateSelected.split('-')
            return `${day}-${m}-${y}`
        })()

        const absentDisplay = absentRolls.map(getDisplayRoll).join(', ') || 'None'
        const presentDisplay = presentRolls.map(getDisplayRoll).join(', ') || 'None'

        return [
            '🎓 ATTENZA',
            '',
            `📅 Date: ${dateFormatted}`,
            `🏫 Section: ${branch} - ${section} | Year ${year} SEM ${semester}`,
            `📖 Subject: ${subjectName.toUpperCase()}${batchName ? ` (${batchName})` : ''}`,
            `👨🏫 Faculty: ${facultyName}`,
            `🔖 Type: ${subjectType}`,
            '',
            `✅ Present (${presentCount}):`,
            presentDisplay,
            '',
            `❌ Absent (${absentCount}):`,
            absentDisplay,
            '',
            `Total Present: ${presentCount} | Total Absent: ${absentCount} | Strength: ${totalCount}`,
            '',
            `Taken by: ${role} | ${name}`,
        ].join('\n')
    }

    async function handleCopy() {
        const text = buildShareText()
        await Clipboard.setStringAsync(text)   // ← setStringAsync not setString
        Alert.alert('✅ Copied!', 'Attendance report copied to clipboard.')
    }

    async function handleShare() {
        try {
            await Share.share({ message: buildShareText() })
        } catch (err: any) {
            Alert.alert('Error', err.message)
        }
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>← Edit</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Summary</Text>
                <TouchableOpacity onPress={() => navigation.popToTop()}>
                    <Text style={styles.doneText}>Done ✓</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Big % card */}
                <View style={styles.percentCard}>
                    <Text style={styles.percentNum}>{attendancePercent}%</Text>
                    <Text style={styles.percentLabel}>Attendance Rate</Text>
                    <Text style={styles.subjectName}>{subjectName}</Text>
                    {batchName && <Text style={styles.batchLabel}>{batchName}</Text>}
                    <Text style={styles.dateLabel}>{formatDateDisplay(dateSelected)}</Text>
                </View>

                {/* Count row */}
                <View style={styles.countRow}>
                    <View style={[styles.countBox, { backgroundColor: COLORS.present + '18' }]}>
                        <Text style={[styles.countNum, { color: COLORS.present }]}>{presentCount}</Text>
                        <Text style={[styles.countLabel, { color: COLORS.present }]}>Present</Text>
                    </View>
                    <View style={[styles.countBox, { backgroundColor: COLORS.absent + '18' }]}>
                        <Text style={[styles.countNum, { color: COLORS.absent }]}>{absentCount}</Text>
                        <Text style={[styles.countLabel, { color: COLORS.absent }]}>Absent</Text>
                    </View>
                    <View style={[styles.countBox, { backgroundColor: COLORS.primary + '15' }]}>
                        <Text style={[styles.countNum, { color: COLORS.primary }]}>{totalCount}</Text>
                        <Text style={[styles.countLabel, { color: COLORS.primary }]}>Total</Text>
                    </View>
                </View>

                {/* Absentees */}
                {absentRolls.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            🔴 Absent ({absentCount})
                        </Text>
                        <View style={styles.rollWrap}>
                            {absentRolls.map((roll) => (
                                <View key={roll} style={styles.absentPill}>
                                    <Text style={styles.absentPillText}>{getDisplayRoll(roll)}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Present list */}
                {presentRolls.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            🟢 Present ({presentCount})
                        </Text>
                        <View style={styles.rollWrap}>
                            {presentRolls.map((roll) => (
                                <View key={roll} style={styles.presentPill}>
                                    <Text style={styles.presentPillText}>{getDisplayRoll(roll)}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Share Buttons */}
                <View style={styles.shareRow}>
                    <TouchableOpacity
                        style={[styles.shareBtn, { backgroundColor: COLORS.primary }]}
                        onPress={handleShare}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.shareBtnText}>💬 Share (WhatsApp)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.shareBtn, { backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border }]}
                        onPress={handleCopy}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.shareBtnText, { color: COLORS.textPrimary }]}>📋 Copy Text</Text>
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
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
    doneText: { fontSize: 15, color: COLORS.success, fontWeight: '700' },
    content: { padding: 20 },

    percentCard: {
        backgroundColor: COLORS.primary, borderRadius: 20,
        padding: 28, alignItems: 'center', marginBottom: 16,
    },
    percentNum: { fontSize: 64, fontWeight: '900', color: '#fff' },
    percentLabel: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
    subjectName: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 12 },
    batchLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    dateLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 },

    countRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    countBox: {
        flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    },
    countNum: { fontSize: 28, fontWeight: '900' },
    countLabel: { fontSize: 12, fontWeight: '600', marginTop: 3 },

    section: { marginBottom: 20 },
    sectionTitle: {
        fontSize: 15, fontWeight: '700',
        color: COLORS.textPrimary, marginBottom: 10,
    },
    rollWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

    absentPill: {
        backgroundColor: COLORS.absent + '18', paddingHorizontal: 14,
        paddingVertical: 7, borderRadius: 10,
        borderWidth: 1, borderColor: COLORS.absent + '50',
    },
    absentPillText: { color: COLORS.absent, fontWeight: '700', fontSize: 14 },

    presentPill: {
        backgroundColor: COLORS.present + '15', paddingHorizontal: 14,
        paddingVertical: 7, borderRadius: 10,
        borderWidth: 1, borderColor: COLORS.present + '50',
    },
    presentPillText: { color: COLORS.present, fontWeight: '700', fontSize: 14 },

    shareRow: { gap: 10, marginTop: 8 },
    shareBtn: {
        borderRadius: 12, paddingVertical: 15, alignItems: 'center',
    },
    shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})