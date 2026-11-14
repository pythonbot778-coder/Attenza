import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { COLORS } from '../../constants/colors'
import { supabase } from '../../api/supabase'
import { useAuthStore } from '../../store/authStore'
import {
  showErrorDialog,
  showSuccessDialog,
} from '../../store/dialogStore'

type RequestType = 'support' | 'suggestion'
type Priority = 'low' | 'medium' | 'high'

export function SupportSuggestionsScreen() {
  const navigation = useNavigation<any>()
  const { userId, name, email, role, classId } = useAuthStore()

  const [type, setType] = useState<RequestType>('support')
  const [priority, setPriority] = useState<Priority>('medium')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isSupport = type === 'support'

  const placeholder = useMemo(() => {
    if (isSupport) {
      return 'Describe the issue clearly.\n\n• What happened?\n• Which screen or feature?\n• What did you expect to happen instead?'
    }
    return 'Share your thoughts and ideas.\n\n• What feature or improvement would you like to see?\n• How would it help students or CR/LR?'
  }, [isSupport])

  async function handleSubmit() {
    const normalizedSubject = subject.trim()
    const normalizedMessage = message.trim()

    if (!normalizedSubject) {
      showErrorDialog('Missing Subject', 'Please enter a subject.')
      return
    }

    if (normalizedSubject.length < 4) {
      showErrorDialog('Invalid Subject', 'Subject must be at least 4 characters long.')
      return
    }

    if (!normalizedMessage) {
      showErrorDialog('Missing Message', 'Please enter your message.')
      return
    }

    if (normalizedMessage.length < 10) {
      showErrorDialog('Invalid Message', 'Please describe your request in more detail (at least 10 characters).')
      return
    }

    if (!userId) {
      showErrorDialog('Session Error', 'No active session found. Please login again.')
      return
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

      showSuccessDialog(
        'Submission Received',
        isSupport
          ? 'Your support request has been recorded. Our team will review it.'
          : 'Thank you for your suggestion! We are constantly improving Attenza.',
        () => {
          if (navigation.canGoBack()) navigation.goBack()
        }
      )
    } catch (e: any) {
      showErrorDialog('Submission Failed', e?.message ?? 'Unable to submit right now.')
    } finally {
      setSubmitting(false)
    }
  }

  const priorityConfigs: Record<Priority, { label: string; color: string; bg: string }> = {
    low: { label: 'Low', color: COLORS.success, bg: COLORS.success + '15' },
    medium: { label: 'Medium', color: COLORS.warning, bg: COLORS.warning + '15' },
    high: { label: 'High', color: COLORS.absent, bg: COLORS.absent + '15' },
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {navigation.canGoBack() && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Support & Feedback</Text>
            <Text style={styles.headerSubtitle}>We're here to help make Attenza better</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Segmented Switcher Card */}
          <View style={styles.segmentCard}>
            <TouchableOpacity
              style={[styles.segmentBtn, isSupport && styles.segmentBtnActive]}
              onPress={() => setType('support')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="construct-outline"
                size={17}
                color={isSupport ? '#fff' : COLORS.textSecondary}
              />
              <Text style={[styles.segmentText, isSupport && styles.segmentTextActive]}>
                Report an Issue
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, !isSupport && styles.segmentBtnActive]}
              onPress={() => setType('suggestion')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="bulb-outline"
                size={17}
                color={!isSupport ? '#fff' : COLORS.textSecondary}
              />
              <Text style={[styles.segmentText, !isSupport && styles.segmentTextActive]}>
                Feature Idea
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {isSupport && (
              <View style={styles.formGroup}>
                <Text style={styles.sectionLabel}>Urgency / Priority</Text>
                <View style={styles.priorityRow}>
                  {(['low', 'medium', 'high'] as Priority[]).map((p) => {
                    const active = priority === p
                    const cfg = priorityConfigs[p]
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.priorityChip,
                          active && { backgroundColor: cfg.bg, borderColor: cfg.color },
                        ]}
                        onPress={() => setPriority(p)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.priorityDot,
                            { backgroundColor: cfg.color },
                          ]}
                        />
                        <Text
                          style={[
                            styles.priorityChipText,
                            active && { color: cfg.color, fontWeight: '800' },
                          ]}
                        >
                          {cfg.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.sectionLabel}>Subject</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name={isSupport ? 'alert-circle-outline' : 'chatbubble-ellipses-outline'}
                  size={18}
                  color={COLORS.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder={
                    isSupport
                      ? 'e.g. Session did not sync offline'
                      : 'e.g. Dark mode option for attendance'
                  }
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={100}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.sectionLabel}>Detailed Message</Text>
                <Text style={styles.charCount}>{message.length}/1200</Text>
              </View>
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
            </View>

            {/* Submitter Info Strip */}
            <View style={styles.metaBox}>
              <View style={styles.metaRow}>
                <Ionicons name="person-circle-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>Sender: <Text style={styles.metaBold}>{name ?? '—'}</Text> ({role ?? 'STUDENT'})</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="mail-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{email ?? '—'}</Text>
              </View>
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
                <View style={styles.submitBtnInner}>
                  <Ionicons name="send" size={17} color="#fff" />
                  <Text style={styles.submitText}>
                    {isSupport ? 'Submit Support Request' : 'Send Feedback'}
                  </Text>
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
    gap: 12,
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
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  content: {
    padding: 16,
  },
  segmentCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
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
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  textarea: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    minHeight: 140,
  },
  metaBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
    marginBottom: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  metaBold: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
