import React, { useEffect, useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { getSubjectsByClass } from '../../api/subjectApi'
import { HomeStackParams } from '../../navigation/CRNavigator'
import { semesterLabel } from '../../api/attendanceApi'
import { syncPromotionState, dismissReminder } from '../../utils/promotionTracker'
import { PromotionReminderModal } from '../../components/PromotionReminderModal'
import { showErrorDialog } from '../../store/dialogStore'
import { HomeCardSkeleton } from '../../components/SkeletonLoader'
import { useCacheStore } from '../../store/cacheStore'
import { WelcomeGuideModal } from '../../components/WelcomeGuideModal'
import AsyncStorage from '@react-native-async-storage/async-storage'

type Subject = {
  id: string
  name: string
  faculty_name: string
  type: 'CLASS' | 'LAB'
  lab_batches: { id: string; batch_name: string }[]
}

const SubjectCard = React.memo(function SubjectCard({
  item,
  onPress,
  onLongPress,
  onEdit,
}: {
  item: Subject,
  onPress: (item: Subject) => void,
  onLongPress: (item: Subject) => void,
  onEdit: (item: Subject) => void,
}) {
  const isLab = item.type === 'LAB'
  return (
    <TouchableOpacity
      style={styles.subjectCard}
      activeOpacity={0.8}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
    >
      <View style={styles.cardMain}>
        <View style={[
          styles.iconBadge,
          {
            backgroundColor: isLab ? '#DCFCE7' : '#EEF2FF',
            borderColor: isLab ? '#86EFAC' : '#C7D2FE',
          }
        ]}>
          <Ionicons
            name={isLab ? 'flask-outline' : 'book-outline'}
            size={22}
            color={isLab ? '#15803D' : COLORS.primary}
          />
        </View>

        <View style={styles.subjectInfo}>
          <Text style={styles.subjectName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.facultyRow}>
            <Ionicons name="person-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.subjectFaculty} numberOfLines={1}>{item.faculty_name}</Text>
          </View>
          {isLab && item.lab_batches.length > 0 && (
            <View style={styles.batchRow}>
              {item.lab_batches.map((b) => (
                <View key={b.id} style={styles.batchPill}>
                  <Text style={styles.batchPillText}>{b.batch_name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Right side — type badge + edit button */}
      <View style={styles.cardRight}>
        <View style={[
          styles.typeBadge,
          {
            backgroundColor: isLab ? '#DCFCE7' : '#EEF2FF',
            borderColor: isLab ? '#86EFAC' : '#C7D2FE',
          }
        ]}>
          <Text style={[
            styles.typeBadgeText,
            { color: isLab ? '#15803D' : COLORS.primary }
          ]}>
            {item.type}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.editIconBtn}
          onPress={() => onEdit(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={17} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})

export function HomeScreen() {
  const navigation = useNavigation<StackNavigationProp<HomeStackParams>>()
  const { name, role, branch, year, semester, section, classId } = useAuthStore()

  const cachedSubjects = classId ? useCacheStore.getState().subjects[classId] : undefined
  const [subjects, setSubjects] = useState<Subject[]>(cachedSubjects ? (cachedSubjects as Subject[]) : [])
  const [loading, setLoading] = useState(!cachedSubjects || cachedSubjects.length === 0)
  const [refreshing, setRefreshing] = useState(false)

  const [reminderVisible, setReminderVisible] = useState(false)
  const [reminderLabel, setReminderLabel] = useState<string | null>(null)
  const [guideVisible, setGuideVisible] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('@attenza_guide_completed_v1')
      .then((val) => {
        if (!val) setGuideVisible(true)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!classId || year == null || semester == null) return
    const curLabel = semesterLabel(Number(year), Number(semester))
    syncPromotionState(classId, curLabel).then((pending) => {
      if (pending) {
        setReminderLabel(pending.label)
        setReminderVisible(true)
      }
    }).catch(() => {})
  }, [classId, year, semester])

  async function handleReminderClose() {
    setReminderVisible(false)
    if (classId) await dismissReminder(classId)
  }

  function handleReminderDownload() {
    setReminderVisible(false)
    const parent = navigation.getParent()
    if (parent) {
      parent.navigate('ProfileTab' as any)
    }
  }

  async function loadSubjects(force = false) {
    if (!classId) return
    const isStale = useCacheStore.getState().subjectsStale
    const cachedData = useCacheStore.getState().subjects[classId]

    // Strict local cache check: if data exists and not stale, do NOT query database
    if (!force && !isStale && cachedData && cachedData.length > 0) {
      setSubjects(cachedData as Subject[])
      setLoading(false)
      return
    }

    try {
      if (!cachedData || cachedData.length === 0) {
        setLoading(true)
      }
      const data = await getSubjectsByClass(classId)
      setSubjects(data as Subject[])
      useCacheStore.getState().setSubjects(classId, data as any)
    } catch (err: any) {
      const userMsg =
        err?.code?.startsWith('PGRST') ||
        err?.code?.startsWith('42') ||
        err?.code?.startsWith('23')
          ? 'Something went wrong. Please try again.'
          : err?.message ?? 'An unexpected error occurred.'
      showErrorDialog('Error', userMsg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => { loadSubjects(false) }, [classId])
  )

  function onRefresh() {
    setRefreshing(true)
    loadSubjects(true)
  }

  const handlePress = useCallback((item: Subject) => {
    navigation.navigate('Attendance', {
      subjectId: item.id,
      subjectName: item.name,
      facultyName: item.faculty_name,
      type: item.type,
      batches: item.type === 'LAB' ? item.lab_batches as any : undefined,
    })
  }, [navigation])

  const handleLongPress = useCallback((item: Subject) => {
    navigation.navigate('SubjectStats', {
      subjectId: item.id,
      subjectName: item.name,
      facultyName: item.faculty_name,
      type: item.type,
      batches: item.type === 'LAB' ? item.lab_batches as any : undefined,
    })
  }, [navigation])

  const handleEdit = useCallback((item: Subject) => {
    navigation.navigate('EditSubject', {
      subjectId: item.id,
      subjectName: item.name,
      facultyName: item.faculty_name,
      type: item.type,
    })
  }, [navigation])

  const renderSubject = useCallback(({ item }: { item: Subject }) => (
    <SubjectCard
      item={item}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onEdit={handleEdit}
    />
  ), [handlePress, handleLongPress, handleEdit])

  const classSubjectsCount = subjects.filter(s => s.type === 'CLASS').length
  const labSubjectsCount   = subjects.filter(s => s.type === 'LAB').length

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hi, {name?.split(' ')[0] ?? 'Representative'}</Text>
          <Text style={styles.classInfo}>
            {branch} • Year {year} • SEM {semester} • Sec {section}
          </Text>
        </View>
        <View style={[
          styles.roleBadge,
          {
            backgroundColor: role === 'CR' ? COLORS.crLight : COLORS.lrLight,
            borderColor: role === 'CR' ? COLORS.crBorder : COLORS.lrBorder,
          }
        ]}>
          <Ionicons
            name={role === 'CR' ? "shield-checkmark" : "sparkles"}
            size={13}
            color={role === 'CR' ? COLORS.crColor : COLORS.lrColor}
          />
          <Text style={[styles.roleBadgeText, { color: role === 'CR' ? COLORS.crColor : COLORS.lrColor }]}>
            {role}
          </Text>
        </View>
      </View>

      {/* Subject Count Bar */}
      {!loading && (
        <View style={styles.statsRow}>
          <View style={styles.statsPill}>
            <Ionicons name="layers-outline" size={13} color={COLORS.primary} />
            <Text style={styles.statsPillText}>
              {subjects.length} Total
            </Text>
          </View>
          <View style={styles.statsPill}>
            <Ionicons name="book-outline" size={13} color="#2563EB" />
            <Text style={styles.statsPillText}>
              {classSubjectsCount} Theory
            </Text>
          </View>
          <View style={styles.statsPill}>
            <Ionicons name="flask-outline" size={13} color="#7C3AED" />
            <Text style={styles.statsPillText}>
              {labSubjectsCount} Labs
            </Text>
          </View>
        </View>
      )}

      {/* Subject List */}
      {loading ? (
        <View style={styles.list}>
          <HomeCardSkeleton />
          <HomeCardSkeleton />
          <HomeCardSkeleton />
          <HomeCardSkeleton />
          <HomeCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.id}
          renderItem={renderSubject}
          contentContainerStyle={styles.list}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListFooterComponent={
            subjects.length > 0 ? (
              <Text style={styles.hintText}>Long press a subject to view detailed stats</Text>
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconBadge}>
                <Ionicons name="sparkles" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>Ready to start your semester! 🚀</Text>
              <Text style={styles.emptySubtitle}>
                Add your first theory class or lab subject to mark attendance and track attendance rates with ease.
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => navigation.navigate('CreateSubject')}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyActionBtnText}>Add Your First Subject</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateSubject')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <PromotionReminderModal
        visible={reminderVisible}
        archivedLabel={reminderLabel}
        onDownload={handleReminderDownload}
        onClose={handleReminderClose}
      />

      <WelcomeGuideModal
        visible={guideVisible}
        onClose={() => setGuideVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  classInfo: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, fontWeight: '500' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  roleBadgeText: { fontWeight: '800', fontSize: 12 },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  statsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statsPillText: { fontSize: 12, color: '#0F172A', fontWeight: '700' },
  list: { padding: 16, gap: 12, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Refined Subject Card
  subjectCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  subjectInfo: {
    flex: 1,
    paddingRight: 8,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  facultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  subjectFaculty: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  batchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  batchPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  batchPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 56,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 16,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 22,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  hintText: {
    textAlign: 'center', fontSize: 12,
    color: COLORS.textMuted, paddingVertical: 12,
  },
  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },
})
