import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { supabase } from '../../api/supabase'
import { useAuthStore } from '../../store/authStore'
import { COLORS } from '../../constants/colors'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { check, validateCollegeEmail } from '../../utils/validation'

type Props = {
  navigation: StackNavigationProp<AuthStackParams, 'OTP'>
  route: RouteProp<AuthStackParams, 'OTP'>
}

export function OTPScreen({ navigation, route }: Props) {
  const { email, purpose } = route.params
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const inputs = useRef<(TextInput | null)[]>([])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  function handleOtpChange(value: string, index: number) {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) inputs.current[index + 1]?.focus()
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  async function handleVerify() {
    const code = otp.join('')
    if (code.length < 6) {
      Alert.alert('Incomplete', 'Please enter the full 6-digit code.')
      return
    }

    setLoading(true)

    // Set the recovery authStep BEFORE calling verifyOtp so that when Supabase
    // fires SIGNED_IN on onAuthStateChange (which can happen before the promise
    // resolves), the guard in authStore already sees FORGOT_PASSWORD_OTP_VERIFIED
    // and skips hydrateAuthState.
    if (purpose === 'forgot_password') {
      useAuthStore.getState().setUser({ authStep: 'FORGOT_PASSWORD_OTP_VERIFIED' })
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    setLoading(false)

    if (error) {
      // Revert the early authStep set on failure so the store isn't stuck.
      if (purpose === 'forgot_password') {
        useAuthStore.getState().setUser({ authStep: 'UNAUTHENTICATED' })
      }
      Alert.alert('Invalid OTP', 'The code is incorrect or expired. Try again.')
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
      return
    }

    if (data.user) {
      if (purpose === 'forgot_password') {
        navigation.replace('ChangePassword', { email })
      } else {
        // Normal OTP login — new account setup flow.
        useAuthStore.getState().setUser({
          isAuthenticated: true,
          userId: data.user.id,
          email: data.user.email ?? email,
          authStep: 'OTP_VERIFIED',
          isLoading: false,
        })
        navigation.replace('PasswordSetup', { email })
      }
    }
  }

  async function handleResend() {
    if (!check(validateCollegeEmail(email))) return

    setResending(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    setResending(false)

    if (!error) {
      setCountdown(60)
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
      Alert.alert('Sent!', 'A new code has been sent to your email.')
    } else {
      const userMsg =
        error?.code?.startsWith('PGRST') ||
        error?.code?.startsWith('42') ||
        error?.code?.startsWith('23')
          ? 'Something went wrong. Please try again.'
          : error?.message ?? 'An unexpected error occurred.'
      Alert.alert('Error', userMsg)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailText}>{email}</Text>
          </Text>
        </View>

        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => { inputs.current[index] = ref }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(v) => handleOtpChange(v, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!loading}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={COLORS.textOnPrimary} />
            : <Text style={styles.buttonText}>Verify</Text>
          }
        </TouchableOpacity>

        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.resendTimer}>Resend code in {countdown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              {resending
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Text style={styles.resendLink}>Resend code</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, paddingHorizontal: 28, paddingTop: 60 },
  backBtn: { marginBottom: 32 },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  header: { marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
  emailText: { color: COLORS.primary, fontWeight: '600' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  otpBox: {
    width: 48, height: 56,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, backgroundColor: COLORS.surface,
    fontSize: 24, fontWeight: '700', textAlign: 'center', color: COLORS.textPrimary,
  },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  button: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.textOnPrimary, fontSize: 16, fontWeight: '700' },
  resendRow: { alignItems: 'center', marginTop: 24 },
  resendTimer: { color: COLORS.textMuted, fontSize: 14 },
  resendLink: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
})
