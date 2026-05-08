import React, { useCallback, useState } from 'react'
import {
    View, Text, StyleSheet, FlatList,
    ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { getAdminLogs, AdminLog } from '../../api/adminApi'

const ACTION_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    CHANGE_ROLE: { icon: 'person-outline', color: COLORS.primary },
    UPDATE_CLASS: { icon: 'school-outline', color: COLORS.crColor },
    EDIT_ATTENDANCE: { icon: 'create-outline', color: '#F59E0B' },
    DELETE_SESSION: { icon: 'trash-outline', color: COLORS.absent },
    APPROVE_TRANSFER: { icon: 'swap-horizontal-outline', color: COLORS.present },
    RETRY_SYNC: { icon: 'sync-outline', color: COLORS.lrColor },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDateTime(iso: string) {
    const d = new Date(iso)
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${time}`
}

export function AdminLogsScreen() {
    const [logs, setLogs] = useState<AdminLog[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    async function load(refresh = false) {
        if (refresh) setRefreshing(true)
        else setLoading(true)
        try {
            setLogs(await getAdminLogs(200))
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

    function renderItem({ item }: { item: AdminLog }) {
        const meta = ACTION_META[item.action_type] ?? { icon: 'ellipse-outline', color: COLORS.textMuted }
        return (
            <View style={styles.row}>
                <View style={[styles.iconCircle, { backgroundColor: meta.color + '18' }]}>
                    <Ionicons name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.actionType}>{item.action_type.replace(/_/g, ' ')}</Text>
                    {item.description && (
                        <Text style={styles.description}>{item.description}</Text>
                    )}
                    <Text style={styles.meta}>
                        {item.admin_name ?? item.admin_email ?? 'Unknown'} · {fmtDateTime(item.created_at)}
                    </Text>
                </View>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Admin Logs</Text>
                <Text style={styles.headerSub}>Last {logs.length} actions</Text>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={logs}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={styles.emptyIcon}>📋</Text>
                            <Text style={styles.emptyText}>No logs yet</Text>
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
    row: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        backgroundColor: COLORS.surface,
        borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
        padding: 14, marginBottom: 8,
    },
    iconCircle: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    actionType: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, textTransform: 'capitalize' },
    description: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    meta: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
})