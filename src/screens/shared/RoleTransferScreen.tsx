import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import {
  RoleTransfer,
  acceptRoleTransfer,
  rejectRoleTransfer,
} from '../../api/roleTransferApi'
import { hydrateAuthState } from '../../store/authStore'

type Props = {
  transfer: RoleTransfer
  onDone: () => void   // called after accept or reject — clears the gate
}

export function RoleTransferScreen({ transfer, onDone }: Props) {
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null)
  const roleColor = transfer.role === 'CR' ? COLORS.crColor : COLORS.lrColor

  async function handleAccept() {
    setLoading('accept')
    try {
      await acceptRoleTransfer(transfer)
      await hydrateAuthState()   // re-hydrate so role updates in store
      onDone()
    } catch (err: any) {
      Alert.alert('Error', err.message)
      setLoading(null)
    }
  }

  async function handleReject() {
    Alert.alert(
      'Decline Transfer',
      `Are you sure you want to decline the ${transfer.role} role? The current ${transfer.role} will keep their role.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setLoading('reject')
            try {
              await rejectRoleTransfer(transfer.id)
              onDone()
            } catch (err: any) {
              Alert.alert('Error', err.message)
              setLoading(null)
            }
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      {/* Icon */}
      <View style={[styles.iconCircle, { backgroundColor: roleColor + '18' }]}>
        <Ionicons name="swap-horizontal" size={48} color={roleColor} />
      </View>

      {/* Heading */}
      <Text style={styles.title}>Role Transfer Request</Text>
      <Text style={styles.subtitle}>
        You have been selected to become the new
      </Text>

      {/* Role badge */}
      <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
        <Text style={styles.roleBadgeText}>{transfer.role}</Text>
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.textSecondary} />
          <Text style={styles.cardText}>
            The current {transfer.role} has initiated this transfer. Accepting will
            give you full {transfer.role} privileges — you can mark attendance and
            manage subjects.
          </Text>
        </View>
        <View style={[styles.cardRow, { marginTop: 12 }]}>
          <Ionicons name="warning-outline" size={18} color="#F59E0B" />
          <Text style={[styles.cardText, { color: '#92400E' }]}>
            If you decline, the current {transfer.role} retains their role and
            you remain a student.
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.acceptBtn, { backgroundColor: roleColor }]}
          onPress={handleAccept}
          disabled={loading !== null}
          activeOpacity={0.85}
        >
          {loading === 'accept'
            ? <ActivityIndicator color="#fff" />
            : <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.acceptText}>Accept — Become {transfer.role}</Text>
            </>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.rejectBtn]}
          onPress={handleReject}
          disabled={loading !== null}
          activeOpacity={0.85}
        >
          {loading === 'reject'
            ? <ActivityIndicator color={COLORS.absent} />
            : <>
              <Ionicons name="close-circle-outline" size={20} color={COLORS.absent} />
              <Text style={styles.rejectText}>Decline</Text>
            </>
          }
        </TouchableOpacity>
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
    padding: 28,
  },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24, fontWeight: '900',
    color: COLORS.textPrimary, textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15, color: COLORS.textSecondary,
    textAlign: 'center', marginBottom: 14,
  },
  roleBadge: {
    paddingHorizontal: 28, paddingVertical: 8,
    borderRadius: 24, marginBottom: 28,
  },
  roleBadgeText: {
    color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    width: '100%', marginBottom: 32,
  },
  cardRow: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
  },
  cardText: {
    flex: 1, fontSize: 13,
    color: COLORS.textSecondary, lineHeight: 20,
  },
  actions: { width: '100%', gap: 12 },
  btn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 15,
  },
  acceptBtn: {},
  acceptText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  rejectBtn: {
    backgroundColor: COLORS.absent + '12',
    borderWidth: 1.5, borderColor: COLORS.absent + '50',
  },
  rejectText: { color: COLORS.absent, fontSize: 15, fontWeight: '700' },
})