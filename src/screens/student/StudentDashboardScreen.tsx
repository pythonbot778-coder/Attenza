import React, { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import {
  getStudentDashboard,
  StudentDashboardData,
  StudentSubjectRow,
} from '../../api/studentApi'
import { StudentStackParams } from '../../navigation/StudentNavigator'

type Nav = StackNavigationProp<StudentStackParams, 'StudentHome'>

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function pctColor(pct: number): string {
  if (pct >= 75) return COLORS.present
  if (pct >= 60) return '#F59E0B'
  return COLORS.absent
}

function PctArc({ pct }: { pct: number }) {
  const color = pctColor(pct)
  return (
    <View style={[arcStyles.ring, { borderColor: color }]}>
      <Text style={[arcStyles.num, { color }]}>{pct}%</Text>
      <Text style={arcStyles.label}>combined</Text>
    </View>
  )
}

const arcStyles = StyleSheet.create({
  ring: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 6,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  num: { fontSize: 26, fontWeight: '900', color: COLORS.textPrimary },
  label: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
})

const SubjectCard = React.memo(function SubjectCard({
  item,
  onPress,
}: {
  item: StudentSubjectRow,
  onPress: (item: StudentSubjectRow) => void
}) {
  const color = pctColor(item.percent)
  const isLow = item.percent < 75

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress(item)}
    >
      {/* Left accent */}
      <View style={[styles.cardAccent, { backgroundColor: color }]} />

      <View style={styles.cardBody}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardSubject} numberOfLines={1}>{item.subject_name}</Text>
            <Text style={styles.cardFaculty}>{item.faculty_name}</Text>
          </View>
          <View style={[styles.pctBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.pctText, { color }]}>{item.percent}%</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.barTrack}>
          <View style={[styles.barFill, {
            width: `${item.percent}%` as any,
            backgroundColor: color,
          }]} />
        </View>

        {/* Bottom row */}
        <View style={styles.cardBottom}>
          <Text style={styles.cardMeta}>
            ✅ {item.present_count}  ❌ {item.absent_count}  •  {item.sessions_total} sessions
          </Text>
          {isLow && (
            <View style={styles.warnBadge}>
              <Text style={styles.warnText}>⚠️ Low</Text>
            </View>
          )}
        </View>

        {item.last_session_date && (
          <Text style={styles.lastSeen}>
            Last: {formatDate(item.last_session_date)}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </TouchableOpacity>
  )
})

export function StudentDashboardScreen() {
  const navigation = useNavigation<Nav>()
  const { userId, name, role, branch, year, semester, section } = useAuthStore()

  const [data, setData] = useState<StudentDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(isRefresh = false) {
    if (!userId) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await getStudentDashboard(userId)
      setData(res)
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, [userId]))

  const handlePress = useCallback((item: StudentSubjectRow) => {
    navigation.navigate('StudentSubjectDetail', {
      subjectId: item.subject_id,
      subjectName: item.subject_name,
      facultyName: item.faculty_name,
      subjectType: item.subject_type,
    })
  }, [navigation])

  const renderItem = useCallback(({ item }: { item: StudentSubjectRow }) => (
    <SubjectCard item={item} onPress={handlePress} />
  ), [handlePress])

  const atRiskCount = data?.subjects.filter(s => s.percent < 75).length ?? 0

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hi, {name?.split(' ')[0] ?? 'Student'} 👋</Text>
          <Text style={styles.headerSub}>
            {branch} • Year {year} • SEM {semester} • Sec {section}
          </Text>
        </View>
        <View style={[styles.roleBadge,
        { backgroundColor: role === 'CR' ? COLORS.crColor : COLORS.lrColor }]}>
          <Text style={styles.roleBadgeText}>{role ?? 'STUDENT'}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : !data ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No attendance data yet</Text>
        </View>
      ) : (
        <FlatList
          data={data.subjects}
          keyExtractor={(item) => item.subject_id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[COLORS.primary]}
            />
          }
          ListHeaderComponent={
            <View>
              {/* Combined hero */}
              <View style={styles.heroCard}>
                <PctArc pct={data.combinedPercent} />
                <View style={styles.heroStats}>
                  <View style={styles.heroStatItem}>
                    <Text style={[styles.heroStatNum, { color: COLORS.present }]}>
                      {data.totalPresent}
                    </Text>
                    <Text style={styles.heroStatLabel}>Present</Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={styles.heroStatItem}>
                    <Text style={[styles.heroStatNum, { color: COLORS.absent }]}>
                      {data.totalAbsent}
                    </Text>
                    <Text style={styles.heroStatLabel}>Absent</Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={styles.heroStatItem}>
                    <Text style={[styles.heroStatNum, { color: COLORS.primary }]}>
                      {data.totalSessions}
                    </Text>
                    <Text style={styles.heroStatLabel}>Sessions</Text>
                  </View>
                </View>
              </View>

              {/* At risk banner */}
              {atRiskCount > 0 && (
                <View style={styles.riskBanner}>
                  <Text style={styles.riskBannerText}>
                    ⚠️  {atRiskCount} subject{atRiskCount > 1 ? 's' : ''} below 75% — attend more classes!
                  </Text>
                </View>
              )}

              <Text style={styles.sectionHeader}>Subjects</Text>
            </View>
          }
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  roleBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  roleBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },

  list: { padding: 16, paddingBottom: 40 },

  heroCard: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    padding: 20, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', gap: 20,
  },
  heroStats: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  heroStatItem: { alignItems: 'center' },
  heroStatNum: { fontSize: 22, fontWeight: '900' },
  heroStatLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  heroDivider: { width: 1, height: 36, backgroundColor: COLORS.border },

  riskBanner: {
    backgroundColor: '#F59E0B15',
    borderWidth: 1, borderColor: '#F59E0B50',
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  riskBannerText: {
    color: '#92400E', fontSize: 13,
    fontWeight: '600', textAlign: 'center',
  },

  sectionHeader: {
    fontSize: 15, fontWeight: '800',
    color: COLORS.textPrimary, marginBottom: 10,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, overflow: 'hidden',
  },
  cardAccent: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 14 },
  cardTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 10, marginBottom: 10,
  },
  cardSubject: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  cardFaculty: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  pctBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  pctText: { fontSize: 14, fontWeight: '900' },

  barTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: COLORS.border,
    overflow: 'hidden', marginBottom: 8,
  },
  barFill: { height: '100%', borderRadius: 3 },

  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary },
  warnBadge: {
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  warnText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  lastSeen: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
})