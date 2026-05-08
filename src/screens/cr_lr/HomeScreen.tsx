import React, { useEffect, useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { getSubjectsByClass } from '../../api/subjectApi'
import { HomeStackParams } from '../../navigation/CRNavigator'

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
      activeOpacity={0.85}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
    >
      <View style={styles.subjectLeft}>
        <View style={[styles.typeDot,
        { backgroundColor: isLab ? COLORS.success : COLORS.primary }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.subjectName}>{item.name}</Text>
          <Text style={styles.subjectFaculty}>{item.faculty_name}</Text>
          {isLab && (
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
      <View style={styles.subjectRight}>
        <View style={[styles.typeBadge,
        { backgroundColor: isLab ? COLORS.success + '20' : COLORS.primary + '20' }]}>
          <Text style={[styles.typeBadgeText,
          { color: isLab ? COLORS.success : COLORS.primary }]}>
            {item.type}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.editIconBtn}
          onPress={() => onEdit(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})

export function HomeScreen() {
  const navigation = useNavigation<StackNavigationProp<HomeStackParams>>()
  const { name, role, branch, year, semester, section, classId } = useAuthStore()

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadSubjects() {
    if (!classId) return
    try {
      const data = await getSubjectsByClass(classId)
      setSubjects(data as Subject[])
    } catch (err: any) {
      const userMsg =
        err?.code?.startsWith('PGRST') ||
        err?.code?.startsWith('42') ||
        err?.code?.startsWith('23')
          ? 'Something went wrong. Please try again.'
          : err?.message ?? 'An unexpected error occurred.'
      Alert.alert('Error', userMsg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Reload subjects every time screen comes into focus
  useFocusEffect(
    useCallback(() => { loadSubjects() }, [classId])
  )

  function onRefresh() {
    setRefreshing(true)
    loadSubjects()
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hi, {name?.split(' ')[0]}! 👋</Text>
          <Text style={styles.classInfo}>
            {branch} • Year {year} • SEM {semester} • Sec {section}
          </Text>
        </View>
        <View style={[styles.roleBadge,
        { backgroundColor: role === 'CR' ? COLORS.crColor : COLORS.lrColor }]}>
          <Text style={styles.roleBadgeText}>{role}</Text>
        </View>
      </View>

      {/* Subject Count */}
      {!loading && (
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>
            {subjects.length} Subject{subjects.length !== 1 ? 's' : ''}
            {'  •  '}
            {subjects.filter(s => s.type === 'CLASS').length} Class
            {'  •  '}
            {subjects.filter(s => s.type === 'LAB').length} Lab
          </Text>
        </View>
      )}

      {/* Subject List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyTitle}>No subjects yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap ＋ to add your first class or lab subject
              </Text>
            </View>
          }
        />
      )}
      {subjects.length > 0 && (
        <Text style={styles.hintText}>Long press a subject to view stats</Text>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateSubject')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 24, paddingTop: 60,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  classInfo: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  roleBadge: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  roleBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  statsRow: {
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  statsText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  list: { padding: 16, gap: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  subjectCard: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'space-between',
  },
  subjectLeft: {
    flexDirection: 'row', alignItems: 'flex-start',
    flex: 1, gap: 12,
  },
  typeDot: {
    width: 10, height: 10, borderRadius: 5, marginTop: 5,
  },
  subjectName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  subjectFaculty: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  batchRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  batchPill: {
    backgroundColor: COLORS.success + '20', paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 10,
  },
  batchPillText: { fontSize: 11, fontWeight: '600', color: COLORS.success },
  typeBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  empty: {
    flex: 1, alignItems: 'center', paddingTop: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  emptySubtitle: {
    fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', marginTop: 8,
  },
  hintText: {
    textAlign: 'center', fontSize: 12,
    color: COLORS.textMuted, paddingVertical: 12,
  },
  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 34 },
  subjectRight: {
    alignItems: 'flex-end', gap: 8,
  },
  editIconBtn: {
    padding: 4,
  },
})