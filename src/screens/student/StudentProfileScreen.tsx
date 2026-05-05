import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../api/supabase'

export function StudentProfileScreen() {
  const {
    name, email, role, branch, year,
    semester, section, rollNumber, reset,
  } = useAuthStore()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          await supabase.auth.signOut()
          reset()
          setSigningOut(false)
        },
      },
    ])
  }

  function InfoRow({ icon, label, value }: {
    icon: keyof typeof Ionicons.glyphMap
    label: string
    value: string | null | undefined
  }) {
    return (
      <View style={styles.infoRow}>
        <View style={styles.infoIcon}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value ?? '—'}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSub}>Your account details</Text>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.avatarName}>{name}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>{role ?? 'STUDENT'}</Text>
        </View>
      </View>

      {/* Info cards */}
      <View style={styles.card}>
        <InfoRow icon="mail-outline" label="Email" value={email} />
        <View style={styles.divider} />
        <InfoRow icon="card-outline" label="Roll Number" value={rollNumber} />
        <View style={styles.divider} />
        <InfoRow icon="school-outline" label="Branch" value={branch} />
        <View style={styles.divider} />
        <InfoRow icon="layers-outline" label="Year / SEM" value={`Year ${year} • SEM ${semester}`} />
        <View style={styles.divider} />
        <InfoRow icon="people-outline" label="Section" value={`Section ${section}`} />
      </View>

      {/* Sign out */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={handleSignOut}
        disabled={signingOut}
        activeOpacity={0.85}
      >
        {signingOut
          ? <ActivityIndicator color="#fff" />
          : <>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </>
        }
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  avatarSection: {
    alignItems: 'center', paddingVertical: 28,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  avatarName: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  rolePill: {
    marginTop: 8, backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
  },
  rolePillText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  card: {
    backgroundColor: COLORS.surface, marginHorizontal: 16,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  infoIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  infoLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  infoValue: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border },
  signOutBtn: {
    margin: 24, backgroundColor: COLORS.absent,
    borderRadius: 14, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 8,
  },
  signOutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})