import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  FlatList,
  Switch,
  TextInput,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TabView, SceneMap } from 'react-native-tab-view'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../api/supabase'
import { getClassMembers, ClassMemberRow } from '../../api/membersApi'
import { initiateRoleTransfer } from '../../api/roleTransferApi'
import { getShowNames, setShowNames } from '../../utils/attendancePrefs'
import { useNavigation } from '@react-navigation/native'

// ─── Profile Tab ──────────────────────────────────────────────
function ProfileTab() {
  const {
    userId,
    name,
    email,
    rollNumber,
    role,
    branch,
    year,
    semester,
    section,
    avatarUrl,
  } = useAuthStore()

  const [signingOut, setSigningOut] = useState(false)
  const navigation = useNavigation<any>()

  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [draftName, setDraftName] = useState(name ?? '')

  const [showNames, setShowNamesState] = useState(true)
  const [prefsLoading, setPrefsLoading] = useState(true)

  useEffect(() => {
    setDraftName(name ?? '')
  }, [name])

  useEffect(() => {
    getShowNames()
      .then((val) => setShowNamesState(val))
      .finally(() => setPrefsLoading(false))
  }, [])

  async function handleSaveName() {
    const normalizedName = draftName.trim()

    if (!normalizedName) {
      Alert.alert('Error', 'Name cannot be empty.')
      return
    }

    if (!userId) {
      Alert.alert('Error', 'No user session found.')
      return
    }

    try {
      setSavingName(true)

      const { error } = await supabase
        .from('users')
        .update({ name: normalizedName })
        .eq('id', userId)

      if (error) throw error

      useAuthStore.getState().setUser({ name: normalizedName })
      setEditingName(false)
      Alert.alert('Saved', 'Name updated successfully.')
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message ?? 'Unable to update name.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleToggleNames(val: boolean) {
    setShowNamesState(val)
    await setShowNames(val)
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          await supabase.auth.signOut()
          useAuthStore.getState().reset()
        },
      },
    ])
  }

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    )
  }

  const initials = name
    ? name
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '??'

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatarSection}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: role === 'CR' ? COLORS.crColor : COLORS.lrColor },
          ]}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>

        {editingName ? (
          <View style={styles.nameEditWrap}>
            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
              maxLength={80}
            />
            <View style={styles.nameActions}>
              <TouchableOpacity
                style={styles.nameCancelBtn}
                onPress={() => {
                  setDraftName(name ?? '')
                  setEditingName(false)
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.nameCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nameSaveBtn}
                onPress={handleSaveName}
                disabled={savingName}
                activeOpacity={0.85}
              >
                {savingName ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.nameSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{name ?? '—'}</Text>
            <TouchableOpacity
              onPress={() => setEditingName(true)}
              style={styles.editBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="pencil" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View
          style={[
            styles.roleBadge,
            { backgroundColor: role === 'CR' ? COLORS.crColor : COLORS.lrColor },
          ]}
        >
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Attendance Display</Text>
        <View style={styles.prefRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefLabel}>Show Student Names</Text>
            <Text style={styles.prefSub}>
              {showNames
                ? 'Names shown below roll numbers in grid'
                : 'Only last 3 digits of roll shown in grid'}
            </Text>
          </View>

          {prefsLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Switch
              value={showNames}
              onValueChange={handleToggleNames}
              trackColor={{
                false: COLORS.border,
                true: COLORS.primary + '80',
              }}
              thumbColor={showNames ? COLORS.primary : COLORS.textMuted}
            />
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Help</Text>
        <TouchableOpacity
          style={styles.supportRow}
          onPress={() => navigation.navigate('SupportSuggestions')}
          activeOpacity={0.85}
        >
          <View style={styles.supportLeft}>
            <View style={styles.supportIconWrap}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color={COLORS.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Support & Suggestions</Text>
              <Text style={styles.supportSub}>
                Report issues or share ideas to improve the app
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.signOutBtn, signingOut && { opacity: 0.6 }]}
        onPress={handleSignOut}
        disabled={signingOut}
        activeOpacity={0.85}
      >
        {signingOut ? (
          <ActivityIndicator color={COLORS.absent} />
        ) : (
          <Text style={styles.signOutText}>Sign Out</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// ─── Class Members Tab ────────────────────────────────────────
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
      const userMsg =
        e?.code?.startsWith('PGRST') ||
        e?.code?.startsWith('42') ||
        e?.code?.startsWith('23')
          ? 'Something went wrong. Please try again.'
          : e?.message ?? 'An unexpected error occurred.'

      Alert.alert('Error', userMsg)
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  function handleLongPress(member: ClassMemberRow) {
    if (!member.user_id) {
      Alert.alert(
        'Cannot Assign Role',
        'This student has not joined the app yet.'
      )
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
      `Do you want to make ${member.name ?? member.roll_number} the new ${targetRole}?\n\nThey will need to accept this request upon their next login.`,
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

              Alert.alert(
                'Request Sent',
                `A role transfer request for ${targetRole} has been sent to ${member.name}.`
              )
            } catch (e: any) {
              const userMsg =
                e?.code?.startsWith('PGRST') ||
                e?.code?.startsWith('42') ||
                e?.code?.startsWith('23')
                  ? 'Something went wrong. Please try again.'
                  : e?.message ?? 'An unexpected error occurred.'

              Alert.alert('Error', userMsg)
            }
          },
        },
      ]
    )
  }

  const renderItem = useCallback(
    ({ item }: { item: ClassMemberRow }) => {
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
            <View
              style={[
                styles.statusDot,
                { backgroundColor: hasJoined ? COLORS.success : COLORS.border },
              ]}
            />
            <View>
              <Text style={styles.memberRoll}>{item.roll_number}</Text>
              {hasJoined && item.name ? (
                <Text style={styles.memberName}>
                  {item.name}
                  {isMe ? ' (You)' : ''}
                </Text>
              ) : (
                <Text style={styles.memberNotJoined}>Not joined yet</Text>
              )}
            </View>
          </View>

          {item.role !== 'STUDENT' && (
            <View
              style={[
                styles.memberRoleBadge,
                {
                  backgroundColor:
                    item.role === 'CR' ? COLORS.crColor : COLORS.lrColor,
                },
              ]}
            >
              <Text style={styles.memberRoleBadgeText}>{item.role}</Text>
            </View>
          )}
        </TouchableOpacity>
      )
    },
    [userId]
  )

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

// ─── Custom Tab Bar ───────────────────────────────────────────
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

// ─── Root Screen ──────────────────────────────────────────────
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

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  navHeader: { height: 44, backgroundColor: COLORS.surface },
  content: { paddingTop: 30, paddingHorizontal: 20 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },

  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '60',
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  prefLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  prefSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  signOutBtn: {
    backgroundColor: COLORS.absent + '15',
    borderWidth: 1.5,
    borderColor: COLORS.absent + '60',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    color: COLORS.absent,
    fontSize: 16,
    fontWeight: '700',
  },

  membersHeader: {
    padding: 16,
    backgroundColor: COLORS.primary + '10',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  membersInfoText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontWeight: '500',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  memberRoll: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  memberNotJoined: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  memberRoleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberRoleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editBtn: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  nameEditWrap: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  nameInput: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  nameActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  nameCancelBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  nameCancelText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  nameSaveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  nameSaveText: {
    color: '#fff',
    fontWeight: '700',
  },

  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  supportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  supportIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  supportSub: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
})