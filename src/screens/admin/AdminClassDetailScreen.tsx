import React, { useCallback, useState, useRef, useEffect } from 'react'
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl, Pressable, FlatList,
} from 'react-native'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp }           from '@react-navigation/native'
import { Ionicons }            from '@expo/vector-icons'
import { COLORS }              from '../../constants/colors'
import { AdminClassStackParams } from '../../navigation/AdminNavigator'
import {
    getClassMembers, getClassSubjects, getClassSessions,
    adminChangeRole, adminDeleteMember, adminDeleteSession,
    AdminClassMember, AdminSubject, AdminSession,
} from '../../api/adminApi'
import { BroadcastModal } from '../shared/BroadcastModal'

type Nav   = StackNavigationProp<AdminClassStackParams, 'AdminClassDetail'>
type Route = RouteProp<AdminClassStackParams, 'AdminClassDetail'>

export function AdminClassDetailScreen() {
    const navigation = useNavigation<Nav>()
    const route      = useRoute<Route>()
    const isMutating = useRef(false)
    const isMounted  = useRef(true)

    const [members,  setMembers]  = useState<AdminClassMember[]>([])
    const [subjects, setSubjects] = useState<AdminSubject[]>([])
    const [sessions, setSessions] = useState<AdminSession[]>([])
    const [loading,    setLoading]    = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [expandedRole, setExpandedRole] = useState<string | null>(null)
    const [syncLoading,  setSyncLoading]  = useState(false)

    // ── Broadcast modal state ─────────────────────────────────
    const [broadcastVisible, setBroadcastVisible] = useState(false)

    const { classId, label } = route.params

    useEffect(() => { return () => { isMounted.current = false } }, [])

    async function load(refresh = false) {
        if (!classId) return
        if (refresh) setRefreshing(true); else setLoading(true)
        try {
            const [membersData, subjectsData, sessionsData] = await Promise.all([
                getClassMembers(classId),
                getClassSubjects(classId),
                getClassSessions(classId),
            ])
            if (isMounted.current) {
                setMembers(membersData)
                setSubjects(subjectsData)
                setSessions(sessionsData)
            }
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Something went wrong.')
        } finally {
            if (isMounted.current) { setLoading(false); setRefreshing(false) }
        }
    }

    useFocusEffect(useCallback(() => { if (classId) load() }, [classId]))

    async function handleChangeRole(memberId: string, newRole: 'CR' | 'LR' | 'STUDENT') {
        if (isMutating.current) return
        isMutating.current = true
        setSyncLoading(true)
        try {
            await adminChangeRole(classId, memberId, newRole)
            Alert.alert('Success', 'Role updated')
            load()
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Something went wrong.')
        } finally {
            isMutating.current = false; setSyncLoading(false); setExpandedRole(null)
        }
    }

    async function handleDeleteMember(memberId: string, rollNumber: string) {
        Alert.alert('Delete Member', `Remove ${rollNumber} from class?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    if (isMutating.current) return
                    isMutating.current = true; setSyncLoading(true)
                    try {
                        await adminDeleteMember(memberId)
                        Alert.alert('Success', 'Member removed'); load()
                    } catch (e: any) {
                        Alert.alert('Error', e?.message ?? 'Something went wrong.')
                    } finally { isMutating.current = false; setSyncLoading(false) }
                },
            },
        ])
    }

    async function handleDeleteSession(sessionId: string, date: string) {
        Alert.alert('Delete Session', `Remove attendance session for ${date}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    if (isMutating.current) return
                    isMutating.current = true; setSyncLoading(true)
                    try {
                        await adminDeleteSession(sessionId)
                        Alert.alert('Success', 'Session deleted'); load()
                    } catch (e: any) {
                        Alert.alert('Error', e?.message ?? 'Something went wrong.')
                    } finally { isMutating.current = false; setSyncLoading(false) }
                },
            },
        ])
    }

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    }

    const crCount      = members.filter(m => m.role === 'CR').length
    const lrCount      = members.filter(m => m.role === 'LR').length
    const studentCount = members.filter(m => m.role === 'STUDENT').length

    return (
        <>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />}
            >
                {/* Header — back + title + broadcast bell */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{label}</Text>
                        <Text style={styles.headerSub}>{members.length} total members</Text>
                    </View>
                    {/* Broadcast button */}
                    <TouchableOpacity
                        style={styles.broadcastBtn}
                        onPress={() => setBroadcastVisible(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="megaphone-outline" size={22} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={[styles.stat, { borderLeftColor: COLORS.crColor }]}>
                        <Text style={styles.statValue}>{crCount}</Text>
                        <Text style={styles.statLabel}>CR</Text>
                    </View>
                    <View style={[styles.stat, { borderLeftColor: COLORS.lrColor }]}>
                        <Text style={styles.statValue}>{lrCount}</Text>
                        <Text style={styles.statLabel}>LR</Text>
                    </View>
                    <View style={[styles.stat, { borderLeftColor: COLORS.studentColor }]}>
                        <Text style={styles.statValue}>{studentCount}</Text>
                        <Text style={styles.statLabel}>Students</Text>
                    </View>
                </View>

                {/* Members */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>👥 Class Members ({members.length})</Text>
                    {members.length === 0 ? (
                        <Text style={styles.emptyText}>No members found</Text>
                    ) : (
                        <FlatList
                            data={members}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item: member }) => (
                                <View style={styles.memberCard}>
                                    <View style={styles.memberLeft}>
                                        <Text style={styles.memberRoll}>{member.roll_number}</Text>
                                        <Text style={styles.memberName}>{member.name || 'Unnamed'}</Text>
                                        <View style={styles.memberMeta}>
                                            <View style={[styles.roleBadge, {
                                                backgroundColor:
                                                    member.role === 'CR' ? COLORS.crColor + '20' :
                                                    member.role === 'LR' ? COLORS.lrColor + '20' :
                                                    COLORS.studentColor + '20'
                                            }]}>
                                                <Text style={[styles.roleBadgeText, {
                                                    color:
                                                        member.role === 'CR' ? COLORS.crColor :
                                                        member.role === 'LR' ? COLORS.lrColor :
                                                        COLORS.studentColor
                                                }]}>{member.role}</Text>
                                            </View>
                                            <View style={[styles.statusBadge, {
                                                backgroundColor: member.status === 'active' ? COLORS.success + '20' : COLORS.absent + '20'
                                            }]}>
                                                <Text style={[styles.statusText, {
                                                    color: member.status === 'active' ? COLORS.success : COLORS.absent
                                                }]}>{member.status}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={styles.memberActions}>
                                        {expandedRole === member.id ? (
                                            <View style={styles.roleMenu}>
                                                {(['CR', 'LR', 'STUDENT'] as const).map((role) => (
                                                    <Pressable
                                                        key={role}
                                                        style={[styles.roleOption, member.role === role && styles.roleOptionActive]}
                                                        onPress={() => handleChangeRole(member.id, role)}
                                                        disabled={syncLoading}
                                                    >
                                                        <Text style={[styles.roleOptionText, member.role === role && styles.roleOptionTextActive]}>
                                                            {role}
                                                        </Text>
                                                    </Pressable>
                                                ))}
                                            </View>
                                        ) : (
                                            <>
                                                <TouchableOpacity style={styles.actionBtn} onPress={() => setExpandedRole(member.id)}>
                                                    <Ionicons name="swap-horizontal" size={18} color={COLORS.primary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.actionBtn}
                                                    onPress={() => handleDeleteMember(member.id, member.roll_number)}
                                                    disabled={syncLoading}
                                                >
                                                    <Ionicons name="trash-outline" size={18} color={COLORS.absent} />
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </View>
                                </View>
                            )}
                            initialNumToRender={20}
                            maxToRenderPerBatch={20}
                            windowSize={5}
                            removeClippedSubviews={true}
                            scrollEnabled={false}
                        />
                    )}
                </View>

                {/* Subjects */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📚 Subjects ({subjects.length})</Text>
                    {subjects.length === 0 ? (
                        <Text style={styles.emptyText}>No subjects created</Text>
                    ) : (
                        subjects.map((subject) => (
                            <View key={subject.id} style={styles.subjectCard}>
                                <View style={styles.subjectIcon}>
                                    <Text style={styles.iconText}>{subject.type === 'CLASS' ? '🏫' : '🔬'}</Text>
                                </View>
                                <View style={styles.subjectBody}>
                                    <Text style={styles.subjectName}>{subject.name}</Text>
                                    <Text style={styles.subjectFaculty}>Faculty: {subject.faculty_name}</Text>
                                    <Text style={styles.subjectType}>{subject.type}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* Sessions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📅 Attendance Sessions ({sessions.length})</Text>
                    {sessions.length === 0 ? (
                        <Text style={styles.emptyText}>No sessions recorded</Text>
                    ) : (
                        sessions.map((session) => (
                            <View key={session.id} style={styles.sessionCard}>
                                <View style={styles.sessionLeft}>
                                    <Text style={styles.sessionDate}>{session.date_selected}</Text>
                                    <Text style={styles.sessionSubject}>{session.subject_name}</Text>
                                    <View style={styles.sessionMeta}>
                                        <Text style={styles.sessionMetaText}>{session.present_count}/{session.record_count} present</Text>
                                        {session.batch_name && (
                                            <Text style={styles.batchBadge}>{session.batch_name}</Text>
                                        )}
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.deleteSessionBtn}
                                    onPress={() => handleDeleteSession(session.id, session.date_selected)}
                                    disabled={syncLoading}
                                >
                                    <Ionicons name="trash-outline" size={18} color={COLORS.absent} />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Broadcast modal */}
            <BroadcastModal
                visible={broadcastVisible}
                classId={classId}
                classLabel={label}
                onClose={() => setBroadcastVisible(false)}
            />
        </>
    )
}

const styles = StyleSheet.create({
    container:    { flex: 1, backgroundColor: COLORS.background },
    content:      { paddingBottom: 40 },
    centered:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backBtn:       { marginRight: 12 },
    headerTitle:   { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
    headerSub:     { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
    broadcastBtn:  { padding: 6, marginLeft: 8 },
    statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
    stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: COLORS.surface, borderRadius: 12, borderLeftWidth: 4 },
    statValue:     { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    statLabel:     { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
    section:       { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
    sectionTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
    emptyText:     { fontSize: 14, color: COLORS.textMuted, fontStyle: 'italic' },
    memberCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.surface, borderRadius: 12,
        paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10,
        borderWidth: 1, borderColor: COLORS.border,
    },
    memberLeft:          { flex: 1 },
    memberRoll:          { fontSize: 14, fontWeight: '700', color: COLORS.primary },
    memberName:          { fontSize: 13, color: COLORS.textPrimary, marginTop: 2 },
    memberMeta:          { flexDirection: 'row', gap: 8, marginTop: 6 },
    roleBadge:           { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    roleBadgeText:       { fontSize: 11, fontWeight: '600' },
    statusBadge:         { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText:          { fontSize: 11, fontWeight: '600' },
    memberActions:       { marginLeft: 12 },
    actionBtn:           { paddingHorizontal: 8, paddingVertical: 6 },
    roleMenu:            { backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
    roleOption:          { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
    roleOptionActive:    { backgroundColor: COLORS.primary + '20' },
    roleOptionText:      { fontSize: 12, color: COLORS.textPrimary, fontWeight: '600' },
    roleOptionTextActive:{ color: COLORS.primary },
    subjectCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.surface, borderRadius: 12,
        paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10,
        borderWidth: 1, borderColor: COLORS.border,
    },
    subjectIcon:    { marginRight: 12 },
    iconText:       { fontSize: 24 },
    subjectBody:    { flex: 1 },
    subjectName:    { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    subjectFaculty: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    subjectType:    { fontSize: 11, color: COLORS.textMuted, marginTop: 2, fontStyle: 'italic' },
    sessionCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: COLORS.surface, borderRadius: 12,
        paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10,
        borderWidth: 1, borderColor: COLORS.border,
    },
    sessionLeft:      { flex: 1 },
    sessionDate:      { fontSize: 14, fontWeight: '700', color: COLORS.primary },
    sessionSubject:   { fontSize: 13, color: COLORS.textPrimary, marginTop: 2 },
    sessionMeta:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    sessionMetaText:  { fontSize: 12, color: COLORS.textSecondary },
    batchBadge:       { fontSize: 11, backgroundColor: COLORS.primaryLight + '30', color: COLORS.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, fontWeight: '600' },
    deleteSessionBtn: { paddingHorizontal: 8, paddingVertical: 6 },
})