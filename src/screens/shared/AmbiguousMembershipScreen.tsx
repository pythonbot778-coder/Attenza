import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'
import { supabase } from '../../api/supabase'
import { VyndraFooter } from '../../components/VyndraFooter'

export function AmbiguousMembershipScreen() {
  const { userId, email, rollNumber, reset } = useAuthStore()
  const [refreshing, setRefreshing] = React.useState(false)
  const [signingOut, setSigningOut] = React.useState(false)

  async function handleRetry() {
    try {
      setRefreshing(true)
      await hydrateAuthState()
    } catch {
      // handled inside hydrateAuthState
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          try {
            await supabase.auth.signOut({ scope: 'global' })
          } catch {
            // best-effort
          }
          reset()
          setSigningOut(false)
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="warning" size={36} color="#DC2626" />
        </View>

        <Text style={styles.title}>Account Configuration Required</Text>
        <Text style={styles.body}>
          Multiple active class memberships were detected for your account. To prevent unauthorized or cross-class access, your account has been safely paused.
        </Text>

        <View style={styles.detailsBox}>
          <Text style={styles.detailLabel}>Email: <Text style={styles.detailVal}>{email ?? '—'}</Text></Text>
          <Text style={styles.detailLabel}>Roll Number: <Text style={styles.detailVal}>{rollNumber ?? '—'}</Text></Text>
          <Text style={styles.detailLabel}>User ID: <Text style={styles.detailVal}>{userId ?? '—'}</Text></Text>
        </View>

        <Text style={styles.actionPrompt}>
          Please contact your college administrator to resolve duplicate class assignments.
        </Text>

        <TouchableOpacity
          style={styles.retryBtn}
          onPress={handleRetry}
          disabled={refreshing}
          activeOpacity={0.85}
        >
          {refreshing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.retryBtnText}>Retry Verification</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.85}
        >
          {signingOut ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>
      </View>

      <VyndraFooter style={{ marginTop: 24 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  detailVal: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  actionPrompt: {
    fontSize: 12,
    color: '#B91C1C',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 20,
    lineHeight: 17,
  },
  retryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    marginBottom: 10,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  signOutBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
})
