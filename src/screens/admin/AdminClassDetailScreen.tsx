import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react'
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl, Pressable, FlatList,
    Modal, TextInput,
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
    adminPromoteClass, adminDemoteClass, adminEditClassAcademic,
    AdminClassMember, AdminSubject, AdminSession,
} from '../../api/adminApi'
import { useAuthStore } from '../../store/authStore'
import { BroadcastModal } from '../shared/BroadcastModal'

const YEARS = [1, 2, 3, 4]
const SEMS  = [1, 2]

function parseLabel(label: string): { branch: string; year: number; semester: number; section: string } {
    // Expected format: "BRANCH Y# S# §SECTION" — fall back to safe defaults
    const m = label.match(/^(\S+)\s+Y(\d+)\s+S(\d+)\s+§(.+)$/)
    if (!m) return { branch: '', year: 1, semester: 1, section: '' }
    return { branch: m[1], year: parseInt(m[2], 10), semester: parseInt(m[3], 10), section: m[4].trim() }
}

function buildLabel(branch: string, year: number, semester: number, section: string): string {
    return `${branch} Y${year} S${semester} §${section}`
}

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

    // ── Academic state (parsed from initial label, kept in local state so UI updates) ──
    const { classId, label: initialLabel } = route.params
    const [label, setLabel] = useState(initialLabel)
    const parsed = useMemo(() => parseLabel(label), [label])

    // ── Academic edit modal state ─────────────────────────────
    const [editVisible, setEditVisible] = useState(false)
    const [editYear, setEditYear] = useState(parsed.year)
    const [editSem, setEditSem] = useState(parsed.semester)
    const [editSection, setEditSection] = useState(parsed.section)
    const [editSaving, setEditSaving] = useState(false)
    const [academicBusy, setAcademicBusy] = useState(false)
    const { userId } = useAuthStore()

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

    function applyAcademic(year: number, semester: number, section: string) {
        setLabel(buildLabel(parsed.branch, year, semester, section))
    }

    function confirmPromoteClass() {
        const next = parsed.semester === 1
            ? `Y${parsed.year} S2`
            : `Y${parsed.year + 1} S1`
        Alert.alert(
            'Promote Class?',
            `${label}\n\nwill become\n\n${parsed.branch} ${next} §${parsed.section}\n\n` +
            `All students, attendance, lab batches, and CR/LR assignments stay intact.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Promote', style: 'default', onPress: doPromoteClass },
            ]
        )
    }

    function confirmDemoteClass() {
        const prev = parsed.semester === 2
            ? `Y${parsed.year} S1`
            : `Y${parsed.year - 1} S2`
        Alert.alert(
            'Demote Class?',
            `${label}\n\nwill become\n\n${parsed.branch} ${prev} §${parsed.section}\n\n` +
            `Use this only to undo a wrong promotion. All linked data stays intact.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Demote', style: 'destructive', onPress: doDemoteClass },
            ]
        )
    }

    async function doPromoteClass() {
        if (!userId) return
        try {
            setAcademicBusy(true)
            const result = await adminPromoteClass(classId, userId)
            applyAcademic(result.to_year, result.to_sem, parsed.section)
            Alert.alert('Promoted', `Now at Y${result.to_year} S${result.to_sem}.`)
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Promotion failed.')
        } finally {
            setAcademicBusy(false)
        }
    }

    async function doDemoteClass() {
        if (!userId) return
        try {
            setAcademicBusy(true)
            const result = await adminDemoteClass(classId, userId)
            applyAcademic(result.to_year, result.to_sem, parsed.section)
            Alert.alert('Demoted', `Now at Y${result.to_year} S${result.to_sem}.`)
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Demotion failed.')
        } finally {
            setAcademicBusy(false)
        }
    }

    function openEdit() {
        setEditYear(parsed.year)
        setEditSem(parsed.semester)
        setEditSection(parsed.section)
        setEditVisible(true)
    }

    async function saveEdit() {
        if (!userId) return
        const sec = editSection.trim().toUpperCase()
        if (!sec) {
            Alert.alert('Required', 'Section cannot be empty.')
            return
        }
        if (editYear === parsed.year && editSem === parsed.semester && sec === parsed.section) {
            setEditVisible(false)
            return
        }
        Alert.alert(
            'Apply Changes?',
            `${label}\n\nwill become\n\n${buildLabel(parsed.branch, editYear, editSem, sec)}\n\n` +
            `All linked data (students, attendance, labs, CR/LR) stays intact.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Save', style: 'default',
                    onPress: async () => {
                        try {
                            setEditSaving(true)
                            await adminEditClassAcademic(classId, editYear, editSem, sec, userId)
                            applyAcademic(editYear, editSem, sec)
                            setEditVisible(false)
                            Alert.alert('Updated', 'Class academic details updated.')
                        } catch (e: any) {
                            Alert.alert('Error', e?.message ?? 'Update failed.')
                        } finally {
                            setEditSaving(false)
                        }
                    },
                },
            ]
        )
    }

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
                {/* Header — back + title + actions */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{label}</Text>
                        <Text style={styles.headerSub}>{members.length} total members</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => setBroadcastVisible(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="megaphone-outline" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>

                {/* Academic action row */}
                <View style={styles.academicRow}>
                    {academicBusy ? (
                        <View style={styles.academicBusyWrap}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.academicBusyText}>Updating academic details…</Text>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.academicBtn, styles.academicBtnDemote]}
                                onPress={confirmDemoteClass}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="arrow-back" size={14} color={COLORS.absent} />
                                <Text style={[styles.academicBtnText, { color: COLORS.absent }]}>Demote</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.academicBtn, styles.academicBtnPromote]}
                                onPress={confirmPromoteClass}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="arrow-forward" size={14} color="#fff" />
                                <Text style={[styles.academicBtnText, { color: '#fff' }]}>Promote</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.academicBtn, styles.academicBtnEdit]}
                                onPress={openEdit}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                                <Text style={[styles.academicBtnText, { color: COLORS.primary }]}>Edit</Text>
                            </TouchableOpacity>
                        </>
                    )}
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

            {/* Edit Academic Details modal */}
            <Modal
                visible={editVisible}
                animationType="slide"
                transparent
                onRequestClose={() => !editSaving && setEditVisible(false)}
            >
                <View style={styles.editOverlay}>
                    <View style={styles.editSheet}>
                        <View style={styles.editHandle} />
                        <Text style={styles.editTitle}>Edit Academic Details</Text>
                        <Text style={styles.editSub}>{parsed.branch} · current: {label}</Text>

                        <Text style={styles.editLabel}>Year</Text>
                        <View style={styles.pillRow}>
                            {YEARS.map(y => (
                                <TouchableOpacity
                                    key={y}
                                    style={[styles.pill, editYear === y && styles.pillActive]}
                                    onPress={() => setEditYear(y)}
                                    disabled={editSaving}
                                >
                                    <Text style={[styles.pillText, editYear === y && styles.pillTextActive]}>
                                        Year {y}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.editLabel}>Semester</Text>
                        <View style={styles.pillRow}>
                            {SEMS.map(s => (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.pill, editSem === s && styles.pillActive]}
                                    onPress={() => setEditSem(s)}
                                    disabled={editSaving}
                                >
                                    <Text style={[styles.pillText, editSem === s && styles.pillTextActive]}>
                                        Sem {s}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.editLabel}>Section</Text>
                        <TextInput
                            style={styles.editInput}
                            value={editSection}
                            onChangeText={(t) => setEditSection(t.toUpperCase())}
                            placeholder="e.g. A"
                            placeholderTextColor={COLORS.textMuted}
                            autoCapitalize="characters"
                            maxLength={4}
                            editable={!editSaving}
                        />

                        <Text style={styles.editHint}>
                            Branch ({parsed.branch}) is not editable here. All linked students, attendance,
                            lab batches, and CR/LR assignments remain intact.
                        </Text>

                        <View style={styles.editActions}>
                            <TouchableOpacity
                                style={styles.editCancelBtn}
                                onPress={() => setEditVisible(false)}
                                disabled={editSaving}
                            >
                                <Text style={styles.editCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.editSaveBtn, editSaving && { opacity: 0.6 }]}
                                onPress={saveEdit}
                                disabled={editSaving}
                            >
                                {editSaving
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.editSaveText}>Save</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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

    // ─── Header icon button (replaces broadcastBtn slot) ──────────
    headerIconBtn: {
        padding: 8,
        borderRadius: 999,
        backgroundColor: COLORS.primary + '12',
    },

    // ─── Academic action row ──────────────────────────────────────
    academicRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    academicBusyWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
    },
    academicBusyText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    academicBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1.5,
    },
    academicBtnPromote: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    academicBtnDemote: {
        backgroundColor: COLORS.absent + '10',
        borderColor: COLORS.absent + '60',
    },
    academicBtnEdit: {
        backgroundColor: COLORS.primary + '10',
        borderColor: COLORS.primary + '60',
    },
    academicBtnText: {
        fontSize: 12,
        fontWeight: '800',
    },

    // ─── Edit modal ───────────────────────────────────────────────
    editOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    editSheet: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 32,
    },
    editHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        alignSelf: 'center',
        marginBottom: 16,
    },
    editTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    editSub: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 4,
        marginBottom: 16,
    },
    editLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 10,
        marginBottom: 8,
    },
    pillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    pillActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    pillText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textSecondary,
    },
    pillTextActive: {
        color: '#fff',
    },
    editInput: {
        backgroundColor: COLORS.surface,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    editHint: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginTop: 14,
        lineHeight: 16,
    },
    editActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    editCancelBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        backgroundColor: COLORS.surface,
    },
    editCancelText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    editSaveBtn: {
        flex: 2,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: COLORS.primary,
    },
    editSaveText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
})