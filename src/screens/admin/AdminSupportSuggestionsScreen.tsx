import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native'
import { COLORS } from '../../constants/colors'
import { supabase } from '../../api/supabase'

type FeedbackType = 'support' | 'suggestion'
type FeedbackStatus = 'open' | 'in_progress' | 'resolved'

type SupportRequestRow = {
  id: string
  user_id: string | null
  class_id: string | null
  name: string | null
  email: string | null
  role: string | null
  type: FeedbackType
  priority: 'low' | 'medium' | 'high' | null
  status: FeedbackStatus
  subject: string
  message: string
  admin_note: string | null
  created_at: string
}

const FILTERS = ['all', 'support', 'suggestion', 'open', 'in_progress', 'resolved'] as const
type FilterType = typeof FILTERS[number]

export function AdminSupportSuggestionsScreen() {
  const [items, setItems] = useState<SupportRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all')
  const [selectedItem, setSelectedItem] = useState<SupportRequestRow | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [adminNote, setAdminNote] = useState('')

  const loadItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('support_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems((data ?? []) as SupportRequestRow[])
    } catch (e: any) {
      Alert.alert('Load Failed', e?.message ?? 'Unable to fetch support requests.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    if (selectedItem) setAdminNote(selectedItem.admin_note ?? '')
  }, [selectedItem])

  const filteredItems = useMemo(() => {
    if (selectedFilter === 'all') return items
    if (selectedFilter === 'support' || selectedFilter === 'suggestion') {
      return items.filter((item) => item.type === selectedFilter)
    }
    return items.filter((item) => item.status === selectedFilter)
  }, [items, selectedFilter])

  async function updateStatus(status: FeedbackStatus) {
    if (!selectedItem) return

    try {
      setSavingStatus(true)

      const note = adminNote.trim() || null
      const { error } = await supabase
        .from('support_requests')
        .update({
          status,
          admin_note: note,
        })
        .eq('id', selectedItem.id)

      if (error) throw error

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id ? { ...item, status, admin_note: note } : item
        )
      )

      setSelectedItem((prev) => (prev ? { ...prev, status, admin_note: note } : prev))
      Alert.alert('Updated', `Marked as ${status.replace('_', ' ')}.`)
    } catch (e: any) {
      Alert.alert('Update Failed', e?.message ?? 'Unable to update status.')
    } finally {
      setSavingStatus(false)
    }
  }

  function getStatusColor(status: FeedbackStatus) {
    if (status === 'open') return COLORS.warning || '#E59E0B'
    if (status === 'in_progress') return COLORS.primary
    return COLORS.success
  }

  function getTypeColor(type: FeedbackType) {
    return type === 'support' ? (COLORS.absent || '#D9534F') : COLORS.primary
  }

  function renderFilter(filter: FilterType) {
    const active = selectedFilter === filter
    return (
      <TouchableOpacity
        key={filter}
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={() => setSelectedFilter(filter)}
        activeOpacity={0.85}
      >
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
          {filter.replace('_', ' ').toUpperCase()}
        </Text>
      </TouchableOpacity>
    )
  }

  function renderItem({ item }: { item: SupportRequestRow }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelectedItem(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + '20' }]}>
            <Text style={[styles.typeBadgeText, { color: getTypeColor(item.type) }]}>
              {item.type.toUpperCase()}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.subject}>{item.subject}</Text>
        <Text style={styles.messagePreview} numberOfLines={2}>
          {item.message}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {item.name ?? 'Unknown'} • {item.role ?? '—'}
          </Text>
          <Text style={styles.meta}>
            {item.priority ? item.priority.toUpperCase() : '—'}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Support & Suggestions</Text>
        <Text style={styles.subtitle}>Manage user feedback from one place</Text>
      </View>

      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(renderFilter)}
        </ScrollView>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              loadItems()
            }}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptySub}>There are no requests in this filter.</Text>
          </View>
        }
      />

      <Modal
        visible={!!selectedItem}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{selectedItem?.subject}</Text>

              <View style={styles.modalMetaBox}>
                <Text style={styles.modalMeta}>Type: {selectedItem?.type ?? '—'}</Text>
                <Text style={styles.modalMeta}>
                  Status: {selectedItem?.status?.replace('_', ' ') ?? '—'}
                </Text>
                <Text style={styles.modalMeta}>Priority: {selectedItem?.priority ?? '—'}</Text>
                <Text style={styles.modalMeta}>Name: {selectedItem?.name ?? '—'}</Text>
                <Text style={styles.modalMeta}>Email: {selectedItem?.email ?? '—'}</Text>
                <Text style={styles.modalMeta}>Role: {selectedItem?.role ?? '—'}</Text>
              </View>

              <Text style={styles.messageFull}>{selectedItem?.message ?? ''}</Text>

              <Text style={styles.noteLabel}>Admin Note</Text>
              <TextInput
                style={[styles.noteInput, { minHeight: 110 }]}
                value={adminNote}
                onChangeText={setAdminNote}
                placeholder="Add internal note or response summary"
                placeholderTextColor={COLORS.textMuted}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.statusActionRow}>
                <TouchableOpacity
                  style={[
                    styles.statusActionBtn,
                    { backgroundColor: (COLORS.warning || '#E59E0B') + '20' },
                  ]}
                  onPress={() => updateStatus('open')}
                  disabled={savingStatus}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.statusActionText, { color: COLORS.warning || '#E59E0B' }]}>
                    Open
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusActionBtn, { backgroundColor: COLORS.primary + '20' }]}
                  onPress={() => updateStatus('in_progress')}
                  disabled={savingStatus}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.statusActionText, { color: COLORS.primary }]}>
                    In Progress
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusActionBtn, { backgroundColor: COLORS.success + '20' }]}
                  onPress={() => updateStatus('resolved')}
                  disabled={savingStatus}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.statusActionText, { color: COLORS.success }]}>
                    Resolved
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedItem(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  filtersWrap: {
    minHeight: 52,
    justifyContent: 'center',
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    minWidth: 84,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.textOnPrimary,
  },

  listContent: {
    padding: 16,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  subject: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  messagePreview: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  meta: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 56,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  modalMetaBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    gap: 4,
    marginBottom: 14,
  },
  modalMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  messageFull: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  noteInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  statusActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statusActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  closeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
})