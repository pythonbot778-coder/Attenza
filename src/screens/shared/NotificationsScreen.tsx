import React, { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, Alert, RefreshControl, TouchableOpacity,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons }    from '@expo/vector-icons'
import { COLORS }      from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { getClassNotifications, ClassNotification } from '../../api/notificationApi'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  attendance: { icon: 'checkmark-circle-outline', color: COLORS.present, label: 'Attendance' },
  broadcast:  { icon: 'megaphone-outline',         color: COLORS.primary, label: 'Announcement' },
}

export function NotificationsScreen() {
  const navigation  = useNavigation()
  const { classId } = useAuthStore()
  const [notifications, setNotifications] = useState<ClassNotification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)

  async function load(refresh = false) {
    if (!classId) { setLoading(false); return }
    if (refresh) setRefreshing(true); else setLoading(true)
    try {
      setNotifications(await getClassNotifications(classId, 50))
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, [classId]))

  function renderItem({ item }: { item: ClassNotification }) {
    const meta = TYPE_META[item.type] ?? TYPE_META.broadcast
    return (
      <View style={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.typePill, { backgroundColor: meta.color + '18' }]}>
              <Text style={[styles.typePillText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
          <Text style={styles.cardBodyText} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.cardMeta}>
            {fmtDateTime(item.created_at)}{item.sent_by_name ? ` · ${item.sent_by_name}` : ''}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>{notifications.length} recent</Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySubText}>You'll be notified when attendance is marked</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:      { padding: 4 },
  headerTitle:  { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary },
  headerSub:    { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, paddingTop: 60 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  emptySubText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  list:         { padding: 16, paddingBottom: 40 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, marginBottom: 10,
  },
  iconCircle:   { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardBody:     { flex: 1 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle:    { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  typePill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typePillText: { fontSize: 10, fontWeight: '700' },
  cardBodyText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 6 },
  cardMeta:     { fontSize: 11, color: COLORS.textMuted },
})