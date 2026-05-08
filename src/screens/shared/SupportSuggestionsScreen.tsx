import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { COLORS } from '../../constants/colors'
import { supabase } from '../../api/supabase'
import { useAuthStore } from '../../store/authStore'

type RequestType = 'support' | 'suggestion'
type Priority = 'low' | 'medium' | 'high'

export function SupportSuggestionsScreen() {
  const { userId, name, email, role, classId } = useAuthStore()

  const [type, setType] = useState<RequestType>('support')
  const [priority, setPriority] = useState<Priority>('medium')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isSupport = type === 'support'

  const placeholder = useMemo(() => {
    if (isSupport) {
      return 'Describe the issue clearly.\n\nExample:\n- What happened?\n- Which screen?\n- What did you expect instead?'
    }
    return 'Share your idea to improve the app.\n\nExample:\n- What feature do you want?\n- Why would it help students or CR/LR?'
  }, [isSupport])

  async function handleSubmit() {
    const normalizedSubject = subject.trim()
    const normalizedMessage = message.trim()

    if (!normalizedSubject) {
      return Alert.alert('Missing Subject', 'Please enter a subject.')
    }

    if (normalizedSubject.length < 4) {
      return Alert.alert('Invalid Subject', 'Subject should be at least 4 characters long.')
    }

    if (!normalizedMessage) {
      return Alert.alert('Missing Message', 'Please enter your message.')
    }

    if (normalizedMessage.length < 10) {
      return Alert.alert('Invalid Message', 'Please describe your support request or suggestion in more detail.')
    }

    if (!userId) {
      return Alert.alert('Error', 'No active session found. Please login again.')
    }

    try {
      setSubmitting(true)

      const { error } = await supabase.from('support_requests').insert({
        user_id: userId,
        class_id: classId ?? null,
        name: name ?? null,
        email: email ?? null,
        role: role ?? 'STUDENT',
        type,
        priority: isSupport ? priority : null,
        status: 'open',
        subject: normalizedSubject,
        message: normalizedMessage,
      })

      if (error) throw error

      setSubject('')
      setMessage('')
      setPriority('medium')
      setType('support')

      Alert.alert(
        'Submitted',
        isSupport
          ? 'Your support request has been submitted.'
          : 'Your suggestion has been submitted. Thank you!'
      )
    } catch (e: any) {
      Alert.alert('Submission Failed', e?.message ?? 'Unable to submit right now.')
    } finally {
      setSubmitting(false)
    }
  }

  function SegmentedOption({
    label,
    active,
    onPress,
  }: {
    label: string
    active: boolean
    onPress: () => void
  }) {
    return (
      <TouchableOpacity
        style={[styles.segmentBtn, active && styles.segmentBtnActive]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  function PriorityChip({
    value,
    label,
  }: {
    value: Priority
    label: string
  }) {
    const active = priority === value
    return (
      <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => setPriority(value)}
        activeOpacity={0.85}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Support & Suggestions</Text>
          <Text style={styles.subtitle}>
            Need help or have an idea to improve the app? Send it here.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.segmentRow}>
            <SegmentedOption
              label="Support"
              active={type === 'support'}
              onPress={() => setType('support')}
            />
            <SegmentedOption
              label="Suggestion"
              active={type === 'suggestion'}
              onPress={() => setType('suggestion')}
            />
          </View>

          {isSupport && (
            <>
              <Text style={styles.sectionLabel}>Priority</Text>
              <View style={styles.chipRow}>
                <PriorityChip value="low" label="Low" />
                <PriorityChip value="medium" label="Medium" />
                <PriorityChip value="high" label="High" />
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder={isSupport ? 'e.g. Unable to mark attendance' : 'e.g. Add attendance export feature'}
            placeholderTextColor={COLORS.textMuted}
            maxLength={100}
          />

          <Text style={styles.sectionLabel}>Message</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={1200}
          />

          <View style={styles.metaBox}>
            <Text style={styles.metaText}>From: {name ?? '—'}</Text>
            <Text style={styles.metaText}>Email: {email ?? '—'}</Text>
            <Text style={styles.metaText}>Role: {role ?? 'STUDENT'}</Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.disabledBtn]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.textOnPrimary} />
            ) : (
              <Text style={styles.submitText}>
                {isSupport ? 'Submit Support Request' : 'Submit Suggestion'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingTop: 28, paddingBottom: 32 },
  header: { marginBottom: 18 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: COLORS.textOnPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.textOnPrimary,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  textarea: {
    minHeight: 150,
    paddingTop: 12,
  },
  metaBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.65,
  },
})