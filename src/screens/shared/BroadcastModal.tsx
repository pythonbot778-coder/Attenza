import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Modal, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native'
import { Ionicons }              from '@expo/vector-icons'
import { COLORS }                from '../../constants/colors'
import { getClassPushTokens }    from '../../api/notificationApi'
import { sendPushNotifications } from '../../utils/notificationUtils'
import { validateTextField, check } from '../../utils/validation'

interface Props {
  visible:    boolean
  classId:    string
  classLabel: string
  onClose:    () => void
}

export function BroadcastModal({ visible, classId, classLabel, onClose }: Props) {
  const [title,    setTitle]    = useState('')
  const [message,  setMessage]  = useState('')
  const [sending,  setSending]  = useState(false)
  const [sentInfo, setSentInfo] = useState<string | null>(null)

  function reset() { setTitle(''); setMessage(''); setSentInfo(null) }

  async function handleSend() {
    if (!check(validateTextField(title,   'Title',   { max: 60  }))) return
    if (!check(validateTextField(message, 'Message', { max: 300 }))) return
    setSending(true)
    try {
      const tokens = await getClassPushTokens(classId)
      if (tokens.length === 0) {
        Alert.alert('No Recipients', 'No students have push notifications enabled.')
        return
      }
      const count = await sendPushNotifications({
        title:   title.trim(), body: message.trim(),
        tokens, classId, type: 'broadcast', data: { type: 'broadcast' },
      })
      setSentInfo(`✅ Sent to ${count} of ${tokens.length} device${tokens.length > 1 ? 's' : ''}`)
      setTitle(''); setMessage('')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSending(false)
    }
  }

  function handleClose() { reset(); onClose() }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Broadcast Message</Text>
              <Text style={styles.headerSub}>{classLabel}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.infoBanner}>
              <Ionicons name="megaphone-outline" size={16} color={COLORS.primary} />
              <Text style={styles.infoText}>
                Sends a push notification to all students in this class who have the app installed.
              </Text>
            </View>
            <Text style={styles.label}>Title <Text style={styles.limit}>(max 60)</Text></Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle}
              placeholder="e.g. Class cancelled today" placeholderTextColor={COLORS.textMuted} maxLength={60} />
            <Text style={styles.charCount}>{title.length}/60</Text>

            <Text style={[styles.label, { marginTop: 16 }]}>Message <Text style={styles.limit}>(max 300)</Text></Text>
            <TextInput style={[styles.input, styles.messageInput]} value={message} onChangeText={setMessage}
              placeholder="e.g. Lab shifted to Room 204" placeholderTextColor={COLORS.textMuted}
              multiline maxLength={300} textAlignVertical="top" />
            <Text style={styles.charCount}>{message.length}/300</Text>

            {sentInfo && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>{sentInfo}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.sendBtn, sending && { opacity: 0.6 }]}
              onPress={handleSend} disabled={sending} activeOpacity={0.85}>
              {sending ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.sendBtnText}>Send Notification</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  closeBtn:      { padding: 4 },
  headerTitle:   { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  headerSub:     { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  content:       { padding: 20 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: COLORS.primary + '10', borderWidth: 1,
    borderColor: COLORS.primary + '30', borderRadius: 12, padding: 12, marginBottom: 24,
  },
  infoText:      { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  label:         { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  limit:         { color: COLORS.textMuted, fontWeight: '400' },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: COLORS.textPrimary,
  },
  messageInput:  { minHeight: 100, paddingTop: 13 },
  charCount:     { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 4 },
  successBanner: {
    backgroundColor: COLORS.present + '15', borderWidth: 1,
    borderColor: COLORS.present + '40', borderRadius: 12, padding: 12, marginTop: 16,
  },
  successText:   { color: COLORS.present, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, marginTop: 24,
  },
  sendBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
})