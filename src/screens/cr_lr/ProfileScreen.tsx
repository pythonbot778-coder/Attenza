import React, { useState, useEffect, useCallback } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Alert, ActivityIndicator,
    useWindowDimensions, FlatList
} from 'react-native'
import { TabView, SceneMap } from 'react-native-tab-view'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../api/supabase'
import { getClassMembers, ClassMemberRow } from '../../api/membersApi'
import { getDisplayRoll } from '../../utils/rollNumberUtils'
import { initiateRoleTransfer } from '../../api/roleTransferApi'

function ProfileTab() {
    const {
        name, email, rollNumber, role, branch,
        year, semester, section,
    } = useAuthStore()
    const [signingOut, setSigningOut] = useState(false)

    async function handleSignOut() {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out', style: 'destructive',
                    onPress: async () => {
                        setSigningOut(true)
                        await supabase.auth.signOut()
                        useAuthStore.getState().reset()
                    },
                },
            ]
        )
    }

    function InfoRow({ label, value }: { label: string; value: string }) {
        return (
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
            </View>
        )
    }

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.avatarSection}>
                <View style={[styles.avatar,
                { backgroundColor: role === 'CR' ? COLORS.crColor : COLORS.lrColor }]}>
                    <Text style={styles.avatarText}>
                        {name ? name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() : '??'}
                    </Text>
                </View>
                <Text style={styles.profileName}>{name ?? '—'}</Text>
                <View style={[styles.roleBadge,
                { backgroundColor: role === 'CR' ? COLORS.crColor : COLORS.lrColor }]}>
                    <Text style={styles.roleBadgeText}>{role}</Text>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Account Info</Text>
                <InfoRow label="Email" value={email ?? '—'} />
                <InfoRow label="Roll Number" value={rollNumber ?? '—'} />
                <InfoRow label="Role" value={role ?? '—'} />
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Class Info</Text>
                <InfoRow label="Branch" value={branch ?? '—'} />
                <InfoRow label="Year" value={year?.toString() ?? '—'} />
                <InfoRow label="Semester" value={semester?.toString() ?? '—'} />
                <InfoRow label="Section" value={section ?? '—'} />
            </View>

            <TouchableOpacity
                style={[styles.signOutBtn, signingOut && { opacity: 0.6 }]}
                onPress={handleSignOut}
                disabled={signingOut}
                activeOpacity={0.85}
            >
                {signingOut
                    ? <ActivityIndicator color={COLORS.absent} />
                    : <Text style={styles.signOutText}>Sign Out</Text>
                }
            </TouchableOpacity>

            <View style={{ height: 40 }} />
        </ScrollView>
    )
}

function ClassMembersTab() {
    const { classId, userId, role: myRole } = useAuthStore()
    const [members, setMembers] = useState<ClassMemberRow[]>([])
    const [loading, setLoading] = useState(true)

    const loadMembers = useCallback(async () => {
        if (!classId) return
        try {
            const data = await getClassMembers(classId)
            setMembers(data)
        } catch (e: any) {
            Alert.alert('Error', e.message)
        } finally {
            setLoading(false)
        }
    }, [classId])

    useEffect(() => { loadMembers() }, [loadMembers])

    function handleLongPress(member: ClassMemberRow) {
        if (!member.user_id) {
            Alert.alert('Cannot Assign Role', 'This student has not joined the app yet.')
            return
        }
        if (member.user_id === userId) return
        if (member.role === 'CR' || member.role === 'LR') {
            Alert.alert('Already Assigned', `This student is already a ${member.role}.`)
            return
        }
        const targetRole = myRole
        Alert.alert(
            `Transfer ${targetRole} Role?`,
            `Do you want to make ${member.name ?? getDisplayRoll(member.roll_number)} the new ${targetRole}?\n\nThey will need to accept this request upon their next login.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: `Assign as ${targetRole}`,
                    style: 'default',
                    onPress: async () => {
                        try {
                            await initiateRoleTransfer({
                                classId: classId!,
                                fromUserId: userId!,
                                toUserId: member.user_id!,
                                role: targetRole as 'CR' | 'LR',
                            })
                            Alert.alert('Request Sent', `A role transfer request for ${targetRole} has been sent to ${member.name}.`)
                        } catch (e: any) {
                            Alert.alert('Error', e.message)
                        }
                    }
                }
            ]
        )
    }

    const renderItem = useCallback(({ item }: { item: ClassMemberRow }) => {
        const hasJoined = !!item.user_id
        const isMe = item.user_id === userId
        return (
            <TouchableOpacity
                style={styles.memberRow}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={400}
                activeOpacity={0.7}
            >
                <View style={styles.memberLeft}>
                    <View style={[styles.statusDot, { backgroundColor: hasJoined ? COLORS.success : COLORS.border }]} />
                    <View>
                        <Text style={styles.memberRoll}>{getDisplayRoll(item.roll_number)}</Text>
                        {hasJoined && item.name ? (
                            <Text style={styles.memberName}>{item.name}{isMe ? ' (You)' : ''}</Text>
                        ) : (
                            <Text style={styles.memberNotJoined}>Not joined yet</Text>
                        )}
                    </View>
                </View>
                {item.role !== 'STUDENT' && (
                    <View style={[styles.memberRoleBadge,
                    { backgroundColor: item.role === 'CR' ? COLORS.crColor : COLORS.lrColor }]}>
                        <Text style={styles.memberRoleBadgeText}>{item.role}</Text>
                    </View>
                )}
            </TouchableOpacity>
        )
    }, [userId])

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
        )
    }

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.membersHeader}>
                <Text style={styles.membersInfoText}>
                    Long-press a joined student to assign them as {myRole}.
                </Text>
            </View>
            <FlatList
                data={members}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            />
        </View>
    )
}

// Custom tab bar — avoids TabBar version incompatibilities entirely
function CustomTabBar({
    routes,
    index,
    onIndexChange,
}: {
    routes: { key: string; title: string }[]
    index: number
    onIndexChange: (i: number) => void
}) {
    return (
        <View style={styles.tabBar}>
            {routes.map((route, i) => {
                const active = i === index
                return (
                    <TouchableOpacity
                        key={route.key}
                        style={styles.tabItem}
                        onPress={() => onIndexChange(i)}
                        activeOpacity={0.75}
                    >
                        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                            {route.title}
                        </Text>
                        {active && <View style={styles.tabIndicator} />}
                    </TouchableOpacity>
                )
            })}
        </View>
    )
}

export function ProfileScreen() {
    const layout = useWindowDimensions()
    const [index, setIndex] = useState(0)
    const [routes] = useState([
        { key: 'profile', title: 'Profile' },
        { key: 'members', title: 'Class Members' },
    ])

    const renderScene = SceneMap({
        profile: ProfileTab,
        members: ClassMembersTab,
    })

    return (
        <View style={styles.container}>
            <View style={styles.navHeader} />
            <TabView
                navigationState={{ index, routes }}
                renderScene={renderScene}
                onIndexChange={setIndex}
                initialLayout={{ width: layout.width }}
                renderTabBar={() => (
                    <CustomTabBar
                        routes={routes}
                        index={index}
                        onIndexChange={setIndex}
                    />
                )}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    navHeader: { height: 44, backgroundColor: COLORS.surface },
    content:   { paddingTop: 30, paddingHorizontal: 20 },

    // Custom tab bar
    tabBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    tabItem: {
        flex: 1, alignItems: 'center',
        paddingVertical: 14, position: 'relative',
    },
    tabLabel: {
        fontSize: 13, fontWeight: '600',
        color: COLORS.textSecondary,
    },
    tabLabelActive: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    tabIndicator: {
        position: 'absolute', bottom: 0,
        left: 16, right: 16, height: 2,
        backgroundColor: COLORS.primary,
        borderRadius: 2,
    },

    avatarSection: { alignItems: 'center', marginBottom: 28 },
    avatar: {
        width: 84, height: 84, borderRadius: 42,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
    },
    avatarText:  { fontSize: 30, fontWeight: '800', color: '#fff' },
    profileName: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
    roleBadge:   { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20 },
    roleBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    card: {
        backgroundColor: COLORS.surface, borderRadius: 16,
        padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: COLORS.border,
    },
    cardTitle: {
        fontSize: 13, fontWeight: '700', color: COLORS.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: COLORS.border + '60',
    },
    infoLabel: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
    infoValue: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },

    signOutBtn: {
        backgroundColor: COLORS.absent + '15',
        borderWidth: 1.5, borderColor: COLORS.absent + '60',
        borderRadius: 12, paddingVertical: 15,
        alignItems: 'center', marginTop: 8,
    },
    signOutText: { color: COLORS.absent, fontSize: 16, fontWeight: '700' },

    membersHeader: {
        padding: 16, backgroundColor: COLORS.primary + '10',
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    membersInfoText: {
        fontSize: 13, color: COLORS.textPrimary,
        textAlign: 'center', fontWeight: '500',
    },
    memberRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: COLORS.surface, padding: 16, borderRadius: 12,
        marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    },
    memberLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
    statusDot:       { width: 10, height: 10, borderRadius: 5 },
    memberRoll:      { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
    memberName:      { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginTop: 2 },
    memberNotJoined: { fontSize: 13, fontWeight: '400', color: COLORS.textMuted, marginTop: 2, fontStyle: 'italic' },
    memberRoleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    memberRoleBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
})