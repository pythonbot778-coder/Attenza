import React, { useCallback, useState } from 'react'
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { getAllClasses, AdminClass } from '../../api/adminApi'
import { AdminClassStackParams } from '../../navigation/AdminNavigator'

type Nav = StackNavigationProp<AdminClassStackParams, 'AdminClassesList'>

export function AdminClassesScreen() {
    const navigation = useNavigation<Nav>()
    const [classes, setClasses] = useState<AdminClass[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    async function load(refresh = false) {
        if (refresh) setRefreshing(true)
        else setLoading(true)
        try {
            setClasses(await getAllClasses())
        } catch (e: any) {
            Alert.alert('Error', e.message)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useFocusEffect(useCallback(() => { load() }, []))

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
                <FlatList
                    data={classes}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
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