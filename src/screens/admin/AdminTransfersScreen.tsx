import React, { useCallback, useState, useRef } from 'react'
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { getAllTransfers, adminApproveTransfer, AdminTransfer } from '../../api/adminApi'

const STATUS_COLOR: Record<string, string> = {
    pending: '#F59E0B',
    accepted: COLORS.present,
    rejected: COLORS.absent,
    approved: COLORS.primary,
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string) {
    const d = new Date(iso)
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function AdminTransfersScreen() {
    const [transfers, setTransfers] = useState<AdminTransfer[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [approving, setApproving] = useState<string | null>(null)
    const isMutating = useRef(false)

    async function load(refresh = false) {
        if (refresh) setRefreshing(true)
        else setLoading(true)
        try {
            setTransfers(await getAllTransfers())
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

    async function handleApprove(item: AdminTransfer) {
        Alert.alert(
            'Approve Transfer',
            `Force-approve ${item.role} transfer from ${item.from_name ?? item.from_email} to ${item.to_name ?? item.to_email}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve', style: 'default',
                    onPress: async () => {
                        if (isMutating.current) return
                        isMutating.current = true
                        setApproving(item.id)
                        try {
                            await adminApproveTransfer(item.id)
                            await load()
                        } catch (e: any) {
                            const userMsg =
                              e?.code?.startsWith('PGRST') ||
                              e?.code?.startsWith('42') ||
                              e?.code?.startsWith('23')
                                ? 'Something went wrong. Please try again.'
                                : e?.message ?? 'An unexpected error occurred.'
                            Alert.alert('Error', userMsg)
                        } finally {
                            isMutating.current = false
                            setApproving(null)
                        }
                    },
                },
            ]
        )
    }

    function renderItem({ item }: { item: AdminTransfer }) {
        const statusColor = STATUS_COLOR[item.status] ?? COLORS.textMuted
        const classLabel = `${item.branch} Y${item.year} S${item.semester} §${item.section}`
        const isPending = item.status === 'pending'

        return (
            <View style={styles.card}>
                {/* Top row */}
                <View style={styles.cardTop}>
                    <View style={[styles.rolePill, { backgroundColor: item.role === 'CR' ? COLORS.crColor : COLORS.lrColor }]}>
                        <Text style={styles.rolePillText}>{item.role}</Text>
                    </View>
                    <Text style={styles.classLabel}>{classLabel}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>

                {/* People */}
                <View style={styles.peopleRow}>
                    <View style={styles.person}>
                        <Ionicons name="arrow-up-circle-outline" size={16} color={COLORS.textMuted} />
                        <View>
                            <Text style={styles.personName}>{item.from_name ?? '—'}</Text>
                            <Text style={styles.personEmail}>{item.from_email}</Text>
                        </View>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={COLORS.textMuted} />
                    <View style={styles.person}>
                        <Ionicons name="arrow-down-circle-outline" size={16} color={COLORS.present} />
                        <View>
                            <Text style={styles.personName}>{item.to_name ?? '—'}</Text>
                            <Text style={styles.personEmail}>{item.to_email}</Text>
                        </View>
                    </View>
                </View>

                {/* Date + action */}
                <View style={styles.cardBottom}>
                    <Text style={styles.dateMeta}>Requested {fmtDate(item.requested_at)}</Text>
                    {isPending && (
                        approving === item.id
                            ? <ActivityIndicator size="small" color={COLORS.primary} />
                            : (
                                <TouchableOpacity
                                    style={styles.approveBtn}
                                    onPress={() => handleApprove(item)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.approveBtnText}>Force Approve</Text>
                                </TouchableOpacity>
                            )
                    )}
                </View>
            </View>
        )
    }

    const pending = transfers.filter(t => t.status === 'pending').length

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Role Transfers</Text>
                <Text style={styles.headerSub}>
                    {pending > 0 ? `${pending} pending · ` : ''}{transfers.length} total
                </Text>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={transfers}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={styles.emptyIcon}>🔁</Text>
                            <Text style={styles.emptyText}>No transfers yet</Text>
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

    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
        padding: 16, marginBottom: 12,
    },
    cardTop: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
    },
    rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    rolePillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    classLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: '800' },

    peopleRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: COLORS.background, borderRadius: 10, padding: 10, marginBottom: 10,
    },
    person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    personName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
    personEmail: { fontSize: 11, color: COLORS.textSecondary },

    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateMeta: { fontSize: 11, color: COLORS.textMuted },
    approveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
    approveBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
})