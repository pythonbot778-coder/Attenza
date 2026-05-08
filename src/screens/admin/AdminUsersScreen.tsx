import React, { useCallback, useState } from 'react'
import {
    View, Text, StyleSheet, FlatList,
    ActivityIndicator, Alert, RefreshControl, TextInput,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { getAllUsers, AdminUser } from '../../api/adminApi'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string) {
    const d = new Date(iso)
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function AdminUsersScreen() {
    const [users, setUsers] = useState<AdminUser[]>([])
    const [filtered, setFiltered] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [query, setQuery] = useState('')

    async function load(refresh = false) {
        if (refresh) setRefreshing(true)
        else setLoading(true)
        try {
            const data = await getAllUsers()
            setUsers(data)
            setFiltered(data)
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

    function handleSearch(text: string) {
        setQuery(text)
        const q = text.toLowerCase()
        setFiltered(
            users.filter(u =>
                u.name?.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q)
            )
        )
    }

    function renderItem({ item }: { item: AdminUser }) {
        const isAdmin = item.role_global === 'admin'
        return (
            <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: isAdmin ? COLORS.primary : COLORS.crColor + '30' }]}>
                    <Text style={[styles.avatarText, { color: isAdmin ? '#fff' : COLORS.crColor }]}>
                        {item.name ? item.name[0].toUpperCase() : '?'}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.nameText}>{item.name ?? '—'}</Text>
                    <Text style={styles.emailText}>{item.email}</Text>
                    <Text style={styles.metaText}>Joined {fmtDate(item.created_at)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: isAdmin ? COLORS.primary + '20' : COLORS.border }]}>
                    <Text style={[styles.badgeText, { color: isAdmin ? COLORS.primary : COLORS.textSecondary }]}>
                        {isAdmin ? 'ADMIN' : 'USER'}
                    </Text>
                </View>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>All Users</Text>
                <Text style={styles.headerSub}>{users.length} registered</Text>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search name or email..."
                    placeholderTextColor={COLORS.textMuted}
                    value={query}
                    onChangeText={handleSearch}
                />
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={styles.emptyText}>No users found</Text>
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
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        margin: 16, paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: COLORS.surface,
        borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    },
    searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
    emptyText: { color: COLORS.textSecondary, fontSize: 15 },
    list: { paddingHorizontal: 16, paddingBottom: 40 },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: COLORS.surface,
        borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
        padding: 14, marginBottom: 8,
    },
    avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 16, fontWeight: '800' },
    nameText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
    emailText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    metaText: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: '800' },
})