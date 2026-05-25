import React from 'react'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'

type Props = {
  visible: boolean
  archivedLabel: string | null
  onDownload: () => void
  onClose: () => void
}

export function PromotionReminderModal({ visible, archivedLabel, onDownload, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Ionicons name="trophy" size={26} color={COLORS.primary} />
          </View>

          <Text style={styles.title}>Class Promoted</Text>
          {archivedLabel ? (
            <Text style={styles.subtitle}>
              Your previous semester ({archivedLabel}) attendance has been archived.
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              Your previous semester attendance has been archived.
            </Text>
          )}

          <Text style={styles.body}>
            Download the previous semester's attendance CSV from your Profile so you have a permanent record before continuing.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onDownload}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Download CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.dismissText}>Remind me later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: 24,
    paddingTop: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginBottom: 12,
    width: '100%',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  dismissText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
    paddingVertical: 6,
  },
})
