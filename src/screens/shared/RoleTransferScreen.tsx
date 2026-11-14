import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import {
  RoleTransfer,
  acceptRoleTransfer,
  rejectRoleTransfer,
} from '../../api/roleTransferApi'
import { hydrateAuthState } from '../../store/authStore'
import {
  showErrorDialog,
  showConfirmDialog,
} from '../../store/dialogStore'

type Props = {
  transfer: RoleTransfer
  onDone: () => void
}

export function RoleTransferScreen({ transfer, onDone }: Props) {
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null)
  const roleColor = transfer.role === 'CR' ? COLORS.crColor : COLORS.lrColor

  async function handleAccept() {
    setLoading('accept')
    try {
      await acceptRoleTransfer(transfer)
      await hydrateAuthState()
      onDone()
    } catch (err: any) {
      const msg = err?.message ?? err?.toString() ?? 'Unknown error'
      console.error('[RoleTransfer] Accept failed:', msg, err)
      showErrorDialog('Accept Failed', msg)
      setLoading(null)
    }
  }

  function handleReject() {
    showConfirmDialog(
      'Decline Transfer Request?',
      `Are you sure you want to decline the nomination to become the new ${transfer.role}?`,
      async () => {
        setLoading('reject')
        try {
          await rejectRoleTransfer(transfer.id)
          onDone()
        } catch (err: any) {
          const msg = err?.message ?? err?.toString() ?? 'Unknown error'
          console.error('[RoleTransfer] Reject failed:', msg, err)
          showErrorDialog('Decline Failed', msg)
          setLoading(null)
        }
      },
      undefined,
      'Decline Nomination',
      'Cancel',
      true
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.cardWrapper}>
        {/* Glow Icon Circle */}
        <View style={[styles.iconOuterRing, { borderColor: roleColor + '30' }]}>
          <View style={[styles.iconCircle, { backgroundColor: roleColor + '18' }]}>
            <Ionicons name="swap-horizontal" size={44} color={roleColor} />
          </View>
        </View>

        <Text style={styles.title}>Role Transfer Request</Text>
        <Text style={styles.subtitle}>
          You have been nominated by your class representative to assume the role of
        </Text>

        <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
          <Ionicons name="shield-checkmark" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.roleBadgeText}>{transfer.role}</Text>
        </View>

        {/* Informational Card */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="checkmark-done-circle" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.cardText}>
              Accepting gives you full {transfer.role} privileges to take attendance, manage subject schedules, and supervise records.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={[styles.infoIconWrap, { backgroundColor: COLORS.warning + '18' }]}>
              <Ionicons name="alert-circle-outline" size={18} color={COLORS.warning} />
            </View>
            <Text style={styles.cardText}>
              Declining keeps the current {transfer.role} in charge, and your account remains a student member.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.acceptBtn, { backgroundColor: roleColor }]}
            onPress={handleAccept}
            disabled={loading !== null}
            activeOpacity={0.85}
          >
            {loading === 'accept' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnInner}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.acceptText}>Accept — Become {transfer.role}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.rejectBtn]}
            onPress={handleReject}
            disabled={loading !== null}
            activeOpacity={0.85}
          >
            {loading === 'reject' ? (
              <ActivityIndicator color={COLORS.absent} />
            ) : (
              <View style={styles.btnInner}>
                <Ionicons name="close-circle-outline" size={20} color={COLORS.absent} />
                <Text style={styles.rejectText}>Decline Nomination</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cardWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  iconOuterRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    marginBottom: 28,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 14,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  acceptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  rejectBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.absent + '50',
  },
  rejectText: {
    color: COLORS.absent,
    fontSize: 15,
    fontWeight: '800',
  },
})
