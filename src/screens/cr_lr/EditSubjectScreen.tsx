import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { HomeStackParams } from '../../navigation/CRNavigator'
import { COLORS } from '../../constants/colors'
import { updateSubject, deleteSubject } from '../../api/subjectApi'

type EditRoute = RouteProp<HomeStackParams, 'EditSubject'>
type EditNav = StackNavigationProp<HomeStackParams, 'EditSubject'>

export function EditSubjectScreen() {
  const route = useRoute<EditRoute>()
  const navigation = useNavigation<EditNav>()

  const { subjectId, subjectName, facultyName, type } = route.params

  const [name, setName] = useState(subjectName)
  const [faculty, setFaculty] = useState(facultyName)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Required', 'Enter subject name.'); return }
    if (!faculty.trim()) { Alert.alert('Required', 'Enter faculty name.'); return }

    setSaving(true)
    try {
      await updateSubject(subjectId, name, faculty)
      navigation.goBack()
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete Subject?',
      `"${subjectName}" and ALL its attendance records will be permanently deleted.\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              await deleteSubject(subjectId)
              navigation.popToTop()
            } catch (err: any) {
              Alert.alert('Error', err.message)
            } finally {
              setDeleting(false)
            }
          },
        },
      ]
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Subject</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Type badge */}
          <View style={[styles.typeBadge,
          { backgroundColor: type === 'LAB' ? COLORS.success + '20' : COLORS.primary + '20' }]}>
            <Text style={[styles.typeBadgeText,
            { color: type === 'LAB' ? COLORS.success : COLORS.primary }]}>
              {type === 'LAB' ? '🔬 Lab Subject' : '🏫 Class Subject'}
            </Text>
          </View>

          {/* Edit fields */}
          <View style={styles.card}>
            <Text style={styles.label}>Subject Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Subject name"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Faculty Name</Text>
            <TextInput
              style={styles.input}
              value={faculty}
              onChangeText={setFaculty}
              placeholder="Faculty name"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
            />
          </View>

          <Text style={styles.noteText}>
            ℹ️ Batch roll ranges cannot be changed after creation.
            Delete and recreate the subject to change batches.
          </Text>

          {/* Danger zone */}
          <View style={styles.dangerCard}>
            <Text style={styles.dangerTitle}>Danger Zone</Text>
            <Text style={styles.dangerDesc}>
              Deleting this subject will permanently remove all attendance sessions
              and records associated with it.
            </Text>
            <TouchableOpacity
              style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
              onPress={confirmDelete}
              disabled={deleting}
              activeOpacity={0.85}
            >
              {deleting
                ? <ActivityIndicator color={COLORS.absent} />
                : <>
                  <Ionicons name="trash-outline" size={18} color={COLORS.absent} />
                  <Text style={styles.deleteBtnText}>Delete Subject</Text>
                </>
              }
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    minWidth: 60, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  content: { padding: 20 },

  typeBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 20, marginBottom: 20,
  },
  typeBadgeText: { fontSize: 14, fontWeight: '700' },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 16,
  },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5,
    borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: COLORS.textPrimary,
  },

  noteText: {
    fontSize: 13, color: COLORS.textMuted,
    lineHeight: 18, marginBottom: 20,
    paddingHorizontal: 4,
  },

  dangerCard: {
    backgroundColor: COLORS.absent + '08',
    borderRadius: 16, padding: 20,
    borderWidth: 1.5, borderColor: COLORS.absent + '30',
  },
  dangerTitle: {
    fontSize: 15, fontWeight: '700',
    color: COLORS.absent, marginBottom: 8,
  },
  dangerDesc: {
    fontSize: 13, color: COLORS.textSecondary,
    lineHeight: 18, marginBottom: 16,
  },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.absent + '60',
    borderRadius: 12, paddingVertical: 13,
    backgroundColor: COLORS.absent + '10',
  },
  deleteBtnText: { color: COLORS.absent, fontSize: 15, fontWeight: '700' },
})