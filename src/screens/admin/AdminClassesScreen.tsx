import React, { useCallback, useMemo, useState } from 'react'
import {
    View, Text, StyleSheet, SectionList,
    TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import {
    getAllClasses, adminPromoteYear, adminDemoteYear,
    AdminClass,
} from '../../api/adminApi'
import { useAuthStore } from '../../store/authStore'
import { AdminClassStackParams } from '../../navigation/AdminNavigator'

type Nav = StackNavigationProp<AdminClassStackParams, 'AdminClassesList'>

const YEAR_LABELS: Record<number, string> = {
    1: 'First Year',
    2: 'Second Year',
    3: 'Third Year',
    4: 'Fourth Year',
}

export function AdminClassesScreen() {
    const navigation = useNavigation<Nav>()
    const { userId } = useAuthStore()
    const [classes, setClasses] = useState<AdminClass[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [busyYear, setBusyYear] = useState<number | null>(null)

    async function load(refresh = false) {
        if (refresh) setRefreshing(true)
        else setLoading(true)
        try {
            setClasses(await getAllClasses())
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
    }

    useFocusEffect(useCallback(() => { load() }, []))

    function confirmPromoteYear(year: number) {
        const label = YEAR_LABELS[year] ?? `Year ${year}`
        Alert.alert(
            `Promote ${label}?`,
            `All classes in ${label} will be promoted one semester forward.\n\n` +
            `• Sem 1 → Sem 2 (same year)\n` +
            `• Sem 2 → next year Sem 1\n\n` +
            `Existing class IDs, students, attendance, lab batches, and CR/LR assignments are preserved.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Promote', style: 'default', onPress: () => doPromoteYear(year) },
            ]
        )
    }

    function confirmDemoteYear(year: number) {
        const label = YEAR_LABELS[year] ?? `Year ${year}`
        Alert.alert(
            `Demote ${label}?`,
            `All classes in ${label} will be demoted one semester backward.\n\n` +
            `• Sem 2 → Sem 1 (same year)\n` +
            `• Sem 1 → previous year Sem 2\n\n` +
            `Use this only to undo a wrong promotion. Existing relations are preserved.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Demote', style: 'destructive', onPress: () => doDemoteYear(year) },
            ]
        )
    }

    async function doPromoteYear(year: number) {
        if (!userId) return
        try {
            setBusyYear(year)
            const result = await adminPromoteYear(year, userId)
            const failedNote = result.failed > 0
                ? `\n\n${result.failed} class(es) failed:\n${result.errors.slice(0, 3).map(e => '• ' + e.error).join('\n')}`
                : ''
            Alert.alert('Promoted', `${result.promoted ?? 0} class(es) promoted.${failedNote}`)
            await load(true)
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Promotion failed.')
        } finally {
            setBusyYear(null)
        }
    }

    async function doDemoteYear(year: number) {
        if (!userId) return
        try {
            setBusyYear(year)
            const result = await adminDemoteYear(year, userId)
            const failedNote = result.failed > 0
                ? `\n\n${result.failed} class(es) failed:\n${result.errors.slice(0, 3).map(e => '• ' + e.error).join('\n')}`
                : ''
            Alert.alert('Demoted', `${result.demoted ?? 0} class(es) demoted.${failedNote}`)
            await load(true)
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Demotion failed.')
        } finally {
            setBusyYear(null)
        }
    }

    const sections = useMemo(() => {
        const grouped: Record<number, AdminClass[]> = {}
        classes.forEach(c => {
            if (!grouped[c.year]) grouped[c.year] = []
            grouped[c.year].push(c)
        })
        return Object.keys(grouped)
            .map(Number)
            .sort((a, b) => a - b)
            .map(year => ({
                title: YEAR_LABELS[year] ?? `Year ${year}`,
                year,
                data: grouped[year].sort((a, b) =>
                    a.semester - b.semester
                    || a.branch.localeCompare(b.branch)
                    || a.section.localeCompare(b.section)
                ),
            }))
    }, [classes])

    function renderItem({ item }: { item: AdminClass }) {
        const label = `${item.branch} Y${item.year} S${item.semester} §${item.section}`
        const joinPct = item.member_count > 0
            ? Math.round((item.joined_count / item.member_count) * 100)
            : 0

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('AdminClassDetail', { classId: item.id, label })}
            >
                <View style={styles.cardLeft}>
                    <Text style={styles.cardLabel}>{label}</Text>
                    <Text style={styles.cardMeta}>
                        {item.member_count} students · {item.joined_count} joined ({joinPct}%)
                    </Text>
                    <Text style={styles.cardMeta}>
                        Rolls: {item.start_roll} → {item.end_roll}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
        )
    }

    function renderSectionHeader({ section }: { section: { title: string; year: number; data: AdminClass[] } }) {
        const count = section.data.length
        const isBusy = busyYear === section.year
        return (
            <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionCount}>
                        {count} {count === 1 ? 'class' : 'classes'}
                    </Text>
                </View>
                <View style={styles.sectionActions}>
                    {isBusy ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.yearActionBtn, styles.yearActionDemote]}
                                onPress={() => confirmDemoteYear(section.year)}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="arrow-back" size={12} color={COLORS.absent} />
                                <Text style={[styles.yearActionText, { color: COLORS.absent }]}>Demote</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.yearActionBtn, styles.yearActionPromote]}
                                onPress={() => confirmPromoteYear(section.year)}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="arrow-forward" size={12} color="#fff" />
                                <Text style={[styles.yearActionText, { color: '#fff' }]}>Promote</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>All Classes</Text>
                <Text style={styles.headerSub}>{classes.length} classes registered</Text>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    stickySectionHeadersEnabled={false}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={styles.emptyIcon}>🏫</Text>
                            <Text style={styles.emptyText}>No classes yet</Text>
                        </View>
                    }
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    headerTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary },
    headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyIcon: { fontSize: 40, marginBottom: 10 },
    emptyText: { fontSize: 15, color: COLORS.textSecondary },
    list: { padding: 16, paddingBottom: 40 },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        marginTop: 10,
        marginBottom: 6,
        gap: 8,
    },
    sectionHeaderLeft: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionCount: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: '600',
        marginTop: 2,
    },
    sectionActions: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    yearActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    yearActionPromote: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    yearActionDemote: {
        backgroundColor: COLORS.absent + '10',
        borderColor: COLORS.absent + '60',
    },
    yearActionText: {
        fontSize: 11,
        fontWeight: '800',
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
        padding: 16, marginBottom: 10,
        flexDirection: 'row', alignItems: 'center',
    },
    cardLeft: { flex: 1 },
    cardLabel: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
    cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
})
