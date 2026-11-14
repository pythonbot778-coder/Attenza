import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { HomeStackParams } from '../../navigation/CRNavigator'
import { COLORS } from '../../constants/colors'
import { updateSubject, deleteSubject } from '../../api/subjectApi'
import {
  showErrorDialog,
  showSuccessDialog,
  showConfirmDialog,
} from '../../store/dialogStore'
import { useCacheStore } from '../../store/cacheStore'

type EditRoute = RouteProp<HomeStackParams, 'EditSubject'>
type EditNav = StackNavigationProp<HomeStackParams, 'EditSubject'>

export function EditSubjectScreen() {
  const route = useRoute<EditRoute>()
  const navigation = useNavigation<EditNav>()

  const { subjectId, subjectName, facultyName, type } = route.params
  const isMutating = useRef(false)

  const [name, setName] = useState(subjectName)
  const [faculty, setFaculty] = useState(facultyName)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    const trimmedName = name.trim()
    const trimmedFaculty = faculty.trim()

    if (!trimmedName) {
      showErrorDialog('Validation Error', 'Subject name cannot be empty.')
      return
    }
    if (!trimmedFaculty) {
      showErrorDialog('Validation Error', 'Faculty name cannot be empty.')
      return
    }

    if (isMutating.current) return
    isMutating.current = true
    setSaving(true)

    try {
      await updateSubject(subjectId, trimmedName, trimmedFaculty)
      useCacheStore.getState().invalidateSubjects()
      showSuccessDialog('Subject Updated', 'Subject details have been saved.', () => {
        navigation.goBack()
      })
    } catch (err: any) {
      const userMsg =
        err?.code?.startsWith('PGRST') ||
        err?.code?.startsWith('42') ||
        err?.code?.startsWith('23')
          ? 'Something went wrong while updating the subject. Please try again.'
          : err?.message ?? 'An unexpected error occurred.'
      showErrorDialog('Update Failed', userMsg)
    } finally {
      isMutating.current = false
      setSaving(false)
    }
  }

  function confirmDelete() {
    showConfirmDialog(
      'Delete Subject?',
      `"${subjectName}" and ALL of its past attendance sessions will be permanently deleted.\n\nThis action cannot be undone.`,
      async () => {
        if (isMutating.current) return
        isMutating.current = true
        setDeleting(true)
        try {
          await deleteSubject(subjectId)
          useCacheStore.getState().invalidateSubjects()
          useCacheStore.getState().invalidateHistory()
          navigation.popToTop()
        } catch (err: any) {
          const userMsg =
            err?.code?.startsWith('PGRST') ||
            err?.code?.startsWith('42') ||
            err?.code?.startsWith('23')
              ? 'Something went wrong while deleting subject. Please try again.'
              : err?.message ?? 'An unexpected error occurred.'
          showErrorDialog('Delete Failed', userMsg)
        } finally {
          isMutating.current = false
          setDeleting(false)
        }
      },
      undefined,
      'Delete Subject',
      'Cancel',
      true
    )
  }

  const isLab = type === 'LAB'

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Subject</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || deleting}
            style={[styles.saveBtn, (saving || deleting) && { opacity: 0.6 }]}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Subject Type Pill Badge */}
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: isLab ? COLORS.success + '15' : COLORS.primary + '15' },
            ]}
          >
            <Ionicons
              name={isLab ? 'flask' : 'school'}
              size={16}
              color={isLab ? COLORS.success : COLORS.primary}
            />
            <Text
              style={[
                styles.typeBadgeText,
                { color: isLab ? COLORS.success : COLORS.primary },
              ]}
            >
              {isLab ? 'Practical Lab Subject' : 'Theory Class Subject'}
            </Text>
          </View>

          {/* Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Subject Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Subject Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="book-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Subject name"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  maxLength={100}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text style={styles.label}>Faculty Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={faculty}
                  onChangeText={setFaculty}
                  placeholder="Faculty name"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  maxLength={80}
                />
              </View>
            </View>
          </View>

          {/* Notice Note */}
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.noteText}>
              Roll number ranges and lab batches cannot be modified after creation. Delete and recreate the subject to update batch boundaries.
            </Text>
          </View>

          {/* Danger Zone */}
          <View style={styles.dangerCard}>
            <View style={styles.dangerHeader}>
              <View style={styles.dangerIconWrap}>
                <Ionicons name="warning" size={18} color={COLORS.absent} />
              </View>
              <Text style={styles.dangerTitle}>Danger Zone</Text>
            </View>
            <Text style={styles.dangerDesc}>
              Permanently delete this subject along with all logged attendance sessions, stats, and records.
            </Text>

            <TouchableOpacity
              style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
              onPress={confirmDelete}
              disabled={deleting || saving}
              activeOpacity={0.85}
            >
              {deleting ? (
                <ActivityIndicator color={COLORS.absent} />
              ) : (
                <View style={styles.deleteInner}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.absent} />
                  <Text style={styles.deleteBtnText}>Delete Subject</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    padding: 16,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  inputGroup: {},
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  dangerCard: {
    backgroundColor: COLORS.absent + '08',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.absent + '30',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dangerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.absent + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.absent,
  },
  dangerDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  deleteBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.absent + '50',
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  deleteInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtnText: {
    color: COLORS.absent,
    fontSize: 14,
    fontWeight: '800',
  },
})
