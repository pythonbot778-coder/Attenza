import React, { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert,
} from 'react-native'
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import {
  getStudentSubjectSessions,
  StudentSubjectSession,
} from '../../api/studentDetailApi'
import { StudentStackParams } from '../../navigation/StudentNavigator'

type Route = RouteProp<StudentStackParams, 'StudentSubjectDetail'>
type Nav = StackNavigationProp<StudentStackParams, 'StudentSubjectDetail'>

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

export function StudentSubjectDetailScreen() {
  const route = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const { userId } = useAuthStore()

  const { subjectId, subjectName, facultyName, subjectType } = route.params
  const isLab = subjectType === 'LAB'

  const [sessions, setSessions] = useState<StudentSubjectSession[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getStudentSubjectSessions(userId, subjectId)
      setSessions(data)
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, [userId, subjectId]))

  const present = sessions.filter(s => s.status === 'present').length
  const total = sessions.length
  const pct = total > 0 ? Math.round((present / total) * 100) : 0
  const color = pctColor(pct)

  // Need to attend = ceil to reach 75%
  const needToAttend = (): string => {
    if (pct >= 75 || total === 0) return ''
    let extra = 0
    while (Math.round(((present + extra) / (total + extra)) * 100) < 75) extra++
    return `Attend ${extra} more class${extra > 1 ? 'es' : ''} to reach 75%`
  }

  const canMiss = (): string => {
    if (pct < 75 || total === 0) return ''
    let miss = 0
    while (Math.round((present / (total + miss + 1)) * 100) >= 75) miss++
    return miss > 0 ? `Can miss ${miss} class${miss > 1 ? 'es' : ''} and stay above 75%` : ''
  }

  function renderSession({ item }: { item: StudentSubjectSession }) {
    const isPresent = item.status === 'present'
    return (
      <View style={styles.row}>
        <View style={[styles.statusDot,
        { backgroundColor: isPresent ? COLORS.present : COLORS.absent }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.date}>{formatDate(item.date_selected)}</Text>
          {item.batch_name && (
            <Text style={styles.batchLabel}>{item.batch_name}</Text>
          )}
        </View>
        <View style={styles.rowRight}>
          <View style={[styles.statusBadge,
          { backgroundColor: isPresent ? COLORS.present + '20' : COLORS.absent + '20' }]}>
            <Text style={[styles.statusText,
            { color: isPresent ? COLORS.present : COLORS.absent }]}>
              {isPresent ? 'Present' : 'Absent'}
            </Text>
          </View>
          {item.is_edited && (
            <View style={styles.editedPill}>
              <Text style={styles.editedText}>edited</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{subjectName}</Text>
          <Text style={styles.headerSub}>{facultyName}</Text>
        </View>
        <View style={[styles.typeBadge,
        { backgroundColor: isLab ? COLORS.success + '20' : COLORS.primary + '20' }]}>
          <Text style={[styles.typeBadgeText,
          { color: isLab ? COLORS.success : COLORS.primary }]}>
            {subjectType}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              {/* Hero card */}
              <View style={[styles.heroCard, { borderColor: color }]}>
                <Text style={[styles.heroPct, { color }]}>{pct}%</Text>
                <Text style={styles.heroLabel}>Personal Attendance</Text>
                <View style={styles.heroRow}>
                  <View style={[styles.heroStat,
                  { backgroundColor: COLORS.present + '15' }]}>
                    <Text style={[styles.heroStatNum,
                    { color: COLORS.present }]}>{present}</Text>
                    <Text style={styles.heroStatLabel}>Present</Text>
                  </View>
                  <View style={[styles.heroStat,
                  { backgroundColor: COLORS.absent + '15' }]}>
                    <Text style={[styles.heroStatNum,
                    { color: COLORS.absent }]}>{total - present}</Text>
                    <Text style={styles.heroStatLabel}>Absent</Text>
                  </View>
                  <View style={[styles.heroStat,
                  { backgroundColor: COLORS.primary + '15' }]}>
                    <Text style={[styles.heroStatNum,
                    { color: COLORS.primary }]}>{total}</Text>
                    <Text style={styles.heroStatLabel}>Total</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.heroBar}>
                  <View style={[styles.heroBarFill,
                  { width: `${pct}%` as any, backgroundColor: color }]} />
                </View>
              </View>

              {/* Smart advice */}
              {needToAttend() !== '' && (
                <View style={styles.adviceBad}>
                  <Ionicons name="warning" size={16} color="#92400E" />
                  <Text style={styles.adviceBadText}>{needToAttend()}</Text>
                </View>
              )}
              {canMiss() !== '' && (
                <View style={styles.adviceGood}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.present} />
                  <Text style={styles.adviceGoodText}>{canMiss()}</Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>Session History</Text>
            </View>
          }
          renderItem={renderSession}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No sessions yet</Text>
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },

  list: { padding: 16, paddingBottom: 40 },

  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20, borderWidth: 2,
    padding: 20, alignItems: 'center', marginBottom: 14,
  },
  heroPct: { fontSize: 56, fontWeight: '900' },
  heroLabel: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, marginBottom: 16 },
  heroRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  heroStat: {
    flex: 1, alignItems: 'center',
    paddingVertical: 10, borderRadius: 12,
  },
  heroStatNum: { fontSize: 22, fontWeight: '900' },
  heroStatLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  heroBar: {
    height: 8, borderRadius: 4,
    backgroundColor: COLORS.border,
    overflow: 'hidden', width: '100%',
  },
  heroBarFill: { height: '100%', borderRadius: 4 },

  adviceBad: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1, borderColor: '#F59E0B60',
    borderRadius: 12, padding: 12, marginBottom: 10,
  },
  adviceBadText: { color: '#92400E', fontSize: 13, fontWeight: '600', flex: 1 },

  adviceGood: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.present + '10',
    borderWidth: 1, borderColor: COLORS.present + '50',
    borderRadius: 12, padding: 12, marginBottom: 10,
  },
  adviceGoodText: { color: COLORS.present, fontSize: 13, fontWeight: '600', flex: 1 },

  sectionTitle: {
    fontSize: 15, fontWeight: '800',
    color: COLORS.textPrimary, marginBottom: 10,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  date: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  batchLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  editedPill: {
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  editedText: { fontSize: 10, fontWeight: '700', color: '#F59E0B' },
})