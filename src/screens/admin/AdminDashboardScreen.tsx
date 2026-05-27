import React, { useCallback, useState } from 'react'
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../api/supabase'
import { getDashboardStats, AdminStats } from '../../api/adminApi'
import { VyndraFooter } from '../../components/VyndraFooter'

function StatCard({
    icon, label, value, color,
}: {
    icon: keyof typeof Ionicons.glyphMap
    label: string
    value: number | string
    color: string
}) {
    return (
        <View style={[styles.statCard, { borderLeftColor: color }]}>
            <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
                <Ionicons name={icon} size={22} color={color} />
            </View>
            <View style={styles.statBody}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
            </View>
        </View>
    )
}

export function AdminDashboardScreen() {
    const { name } = useAuthStore()
    const [stats, setStats] = useState<AdminStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    async function load(refresh = false) {
        if (refresh) setRefreshing(true)
        else setLoading(true)
        try {
            const s = await getDashboardStats()
            setStats(s)
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

    async function handleSignOut() {
        Alert.alert('Sign Out', 'Sign out of admin panel?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out', style: 'destructive',
                onPress: async () => {
                    await supabase.auth.signOut()
                    useAuthStore.getState().reset()
                },
            },
        ])
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Admin Panel</Text>
                    <Text style={styles.headerSub}>Welcome, {name?.split(' ')[0] ?? 'Admin'}</Text>
                </View>
                <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
                    <Ionicons name="log-out-outline" size={22} color={COLORS.absent} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />
                    }
                >
                    <Text style={styles.sectionTitle}>Overview</Text>

                    <StatCard icon="people-outline" label="Total Users" value={stats?.total_users ?? 0} color={COLORS.primary} />
                    <StatCard icon="school-outline" label="Total Classes" value={stats?.total_classes ?? 0} color={COLORS.crColor} />
                    <StatCard icon="person-outline" label="Total Members" value={stats?.total_members ?? 0} color={COLORS.lrColor} />
                    <StatCard icon="calendar-outline" label="Sessions Today" value={stats?.sessions_today ?? 0} color={COLORS.present} />
                    <StatCard icon="swap-horizontal-outline" label="Pending Transfers" value={stats?.pending_transfers ?? 0} color="#F59E0B" />
                    <StatCard icon="sync-outline" label="Pending Sync" value={stats?.pending_sync ?? 0} color={COLORS.absent} />

                    {/* Quick health indicators */}
                    {(stats?.pending_transfers ?? 0) > 0 && (
                        <View style={styles.alertBanner}>
                            <Ionicons name="warning-outline" size={18} color="#92400E" />
                            <Text style={styles.alertText}>
                                {stats!.pending_transfers} role transfer{stats!.pending_transfers > 1 ? 's' : ''} awaiting approval
                            </Text>
                        </View>
                    )}
                    {(stats?.pending_sync ?? 0) > 0 && (
                        <View style={[styles.alertBanner, { backgroundColor: COLORS.absent + '12', borderColor: COLORS.absent + '40' }]}>
                            <Ionicons name="sync-outline" size={18} color={COLORS.absent} />
                            <Text style={[styles.alertText, { color: COLORS.absent }]}>
                                {stats!.pending_sync} sync operation{stats!.pending_sync > 1 ? 's' : ''} pending
                            </Text>
                        </View>
                    )}

                    <VyndraFooter showLogo style={{ marginTop: 16 }} />
                    <View style={{ height: 24 }} />
                </ScrollView>
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
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    headerTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary },
    headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
    signOutBtn: { padding: 8 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: 16 },
    sectionTitle: {
        fontSize: 13, fontWeight: '700', color: COLORS.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
    },
    statCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 14, padding: 16, marginBottom: 10,
        borderWidth: 1, borderColor: COLORS.border,
        borderLeftWidth: 4,
        flexDirection: 'row', alignItems: 'center', gap: 14,
    },
    statIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    statBody: { flex: 1 },
    statValue: { fontSize: 26, fontWeight: '900', color: COLORS.textPrimary },
    statLabel: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
    alertBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1, borderColor: '#F59E0B40',
        borderRadius: 12, padding: 12, marginTop: 8,
    },
    alertText: { fontSize: 13, fontWeight: '600', color: '#92400E', flex: 1 },
})