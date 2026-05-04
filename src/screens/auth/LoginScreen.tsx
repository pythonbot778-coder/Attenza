import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { supabase } from '../../api/supabase'
import { COLORS } from '../../constants/colors'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { useAuthStore } from '../../store/authStore'
import { getClassByUser } from '../../api/classApi'

type Props = {
  navigation: StackNavigationProp<AuthStackParams, 'Login'>
}

export function LoginScreen({ navigation }: Props) {
  const { setUser } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'password' | 'otp'>('password')
  const [loading, setLoading] = useState(false)

  const isValidEmail = (e: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.toLowerCase())

  // ── Password Login (returning users) ──────────────────────
  async function handlePasswordLogin() {
    const trimmed = email.trim().toLowerCase()
    if (!isValidEmail(trimmed)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.')
      return
    }
    if (!password) {
      Alert.alert('Required', 'Please enter your password.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password: password,
    })
    setLoading(false)

    if (error) {
      Alert.alert('Login Failed', error.message)
      return
    }

    // Restore user session + role from DB
    await restoreUserSession(data.user.id, data.user.email ?? '')
  }

  // ── OTP Login (new users / forgot password) ───────────────
  async function handleSendOTP() {
    const trimmed = email.trim().toLowerCase()
    if (!isValidEmail(trimmed)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    })
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    navigation.navigate('OTP', { email: trimmed })
  }

  // ── Restore session after login ────────────────────────────
  async function restoreUserSession(userId: string, email: string) {
    try {
      // Get user profile
      const { data: userData } = await supabase
        .from('users')
        .select('name, mobile_number')
        .eq('id', userId)
        .maybeSingle()

      if (!userData?.name) {
        // New user — no profile yet → go to ProfileSetup
        setUser({ userId, email, isAuthenticated: true, isLoading: false })
        navigation.navigate('ProfileSetup')
        return
      }

      // Get class + role
      const classMember = await getClassByUser(userId)

      if (!classMember) {
        // Has profile but no class yet → go to ProfileSetup
        setUser({ userId, email, name: userData.name, isAuthenticated: true, isLoading: false })
        navigation.navigate('ProfileSetup')
        return
      }

      const cg = classMember.class_groups as any

      // Restore full session
      setUser({
        userId,
        email,
        name: userData.name,
        rollNumber: classMember.roll_number,
        isAuthenticated: true,
        isLoading: false,
        branch: cg.branch,
        year: cg.year,
        semester: cg.semester,
        section: cg.section,
        classId: classMember.class_id,
        role: classMember.role as any,
      })

      // Navigate based on role (handled automatically by RootNavigator when role is set)

    } catch (err: any) {
      Alert.alert('Error restoring session', err.message)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>

        {/* Logo */}
        <View style={styles.header}>
          <Text style={styles.logo}>Attenza</Text>
          <Text style={styles.tagline}>Student-led attendance, simplified.</Text>
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'password' && styles.modeBtnActive]}
            onPress={() => setMode('password')}
          >
            <Text style={[styles.modeBtnText, mode === 'password' && styles.modeBtnTextActive]}>
              🔑 Password
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'otp' && styles.modeBtnActive]}
            onPress={() => setMode('otp')}
          >
            <Text style={[styles.modeBtnText, mode === 'otp' && styles.modeBtnTextActive]}>
              📧 Email OTP
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>College Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="yourname@svce.edu.in"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          {mode === 'password' && (
            <>
              <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={mode === 'password' ? handlePasswordLogin : handleSendOTP}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.textOnPrimary} />
              : <Text style={styles.buttonText}>
                {mode === 'password' ? 'Login' : 'Send OTP'}
              </Text>
            }
          </TouchableOpacity>

          {mode === 'password' && (
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => setMode('otp')}
            >
              <Text style={styles.forgotText}>
                Forgot password? Use Email OTP instead
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.footer}>
          {mode === 'otp'
            ? 'A 6-digit code will be sent to your email.'
            : 'New user? Switch to Email OTP to register.'}
        </Text>

      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: {
    flex: 1, justifyContent: 'center', paddingHorizontal: 28,
  },
  header: { marginBottom: 36, alignItems: 'center' },
  logo: {
    fontSize: 42, fontWeight: '800',
    color: COLORS.primary, letterSpacing: -1,
  },
  tagline: { fontSize: 15, color: COLORS.textSecondary, marginTop: 6 },
  modeRow: {
    flexDirection: 'row', gap: 10, marginBottom: 24,
  },
  modeBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: COLORS.primary, borderColor: COLORS.primary,
  },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  modeBtnTextActive: { color: COLORS.textOnPrimary },
  form: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1.5,
    borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: COLORS.textPrimary,
  },
  button: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: COLORS.textOnPrimary, fontSize: 16, fontWeight: '700',
  },
  forgotBtn: { alignItems: 'center', marginTop: 14 },
  forgotText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  footer: {
    textAlign: 'center', color: COLORS.textMuted,
    fontSize: 13, marginTop: 24,
  },
})