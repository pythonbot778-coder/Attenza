import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { supabase } from '../../api/supabase'
import { useAuthStore } from '../../store/authStore'
import { COLORS } from '../../constants/colors'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { check, validateCollegeEmail } from '../../utils/validation'
import { showDialog, showErrorDialog } from '../../store/dialogStore'

type Props = {
  navigation: StackNavigationProp<AuthStackParams, 'OTP'>
  route: RouteProp<AuthStackParams, 'OTP'>
}

const OTP_EXPIRY_SECONDS = 15 * 60

function formatMmSs(total: number): string {
  const m = Math.max(0, Math.floor(total / 60))
  const s = Math.max(0, total % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function OTPScreen({ navigation, route }: Props) {
  const { email, purpose } = route.params
  const [code, setCode] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(true)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [expirySeconds, setExpirySeconds] = useState(OTP_EXPIRY_SECONDS)
  const inputRef = useRef<React.ComponentRef<typeof TextInput> | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  useEffect(() => {
    if (expirySeconds <= 0) return
    const timer = setTimeout(() => setExpirySeconds(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [expirySeconds])

  const isExpired = expirySeconds <= 0

  async function handlePasteFromClipboard() {
    try {
      const text = await Clipboard.getStringAsync()
      const cleaned = text.replace(/\D/g, '').slice(0, 6)
      if (cleaned.length > 0) {
        setCode(cleaned)
      }
    } catch {
      // ignore clipboard error
    }
  }

  async function handleVerify() {
    if (code.length < 6) {
      showErrorDialog('Incomplete Code', 'Please enter the full 6-digit verification code.')
      return
    }
    if (isExpired) {
      showDialog({
        type: 'warning',
        title: 'Code Expired',
        message: 'This verification code is no longer valid. Tap "Resend Code" to get a fresh one.',
      })
      return
    }

    setLoading(true)

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
      if (purpose === 'forgot_password') {
        useAuthStore.getState().setUser({ authStep: 'UNAUTHENTICATED' })
      }
      showErrorDialog('Invalid Code', 'The code is incorrect or expired. Please check and try again.')
      setCode('')
      inputRef.current?.focus()
      return
    }

    if (data.user) {
      if (purpose === 'forgot_password') {
        navigation.replace('ChangePassword', { email })
      } else {
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
      options: { shouldCreateUser: purpose !== 'forgot_password' },
    })

    setResending(false)

    if (!error) {
      setCountdown(60)
      setExpirySeconds(OTP_EXPIRY_SECONDS)
      setCode('')
      inputRef.current?.focus()
      showDialog({
        type: 'success',
        title: 'Code Sent',
        message: 'A fresh 6-digit verification code has been sent to your email.',
      })
    } else {
      const userMsg =
        error?.code?.startsWith('PGRST') ||
        error?.code?.startsWith('42') ||
        error?.code?.startsWith('23')
          ? 'Something went wrong. Please try again.'
          : error?.message ?? 'An unexpected error occurred.'
      showErrorDialog('Error', userMsg)
    }
  }

  const isComplete = code.length === 6

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          {/* Back Navigation Button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="mail-unread-outline" size={30} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit security code to:
            </Text>
            <View style={styles.emailPill}>
              <Ionicons name="at" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.emailText} numberOfLines={1}>{email}</Text>
            </View>
          </View>

          {/* Main Card Container */}
          <View style={styles.card}>
            {/* Expiry Pill */}
            <View style={[styles.expiryRow, isExpired && styles.expiryRowExpired]}>
              <Ionicons
                name={isExpired ? 'alert-circle' : 'time-outline'}
                size={16}
                color={isExpired ? COLORS.absent : COLORS.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.expiryText, isExpired && styles.expiryTextExpired]}>
                {isExpired
                  ? 'Code expired — tap Resend below'
                  : `Code expires in ${formatMmSs(expirySeconds)}`}
              </Text>
            </View>

            {/* Segmented 6-digit Pill Inputs with Hidden Unified Native TextInput */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              style={styles.otpRow}
            >
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const digit = code[index] || ''
                const isFocusedBox = isInputFocused && index === Math.min(code.length, 5)
                const isFilled = digit.length > 0
                return (
                  <View
                    key={index}
                    style={[
                      styles.otpBoxContainer,
                      isFilled && styles.otpBoxFilled,
                      isFocusedBox && styles.otpBoxFocused,
                      isExpired && styles.otpBoxExpired,
                    ]}
                  >
                    <Text style={styles.otpBoxText}>{digit}</Text>
                  </View>
                )
              })}

              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, '').slice(0, 6)
                  setCode(cleaned)
                }}
                keyboardType="number-pad"
                maxLength={6}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                editable={!loading && !isExpired}
                style={styles.hiddenInput}
              />
            </TouchableOpacity>

            {/* Auto-paste Chip Button */}
            <TouchableOpacity
              style={styles.pasteChip}
              onPress={handlePasteFromClipboard}
              activeOpacity={0.7}
            >
              <Ionicons name="clipboard-outline" size={14} color={COLORS.primary} style={{ marginRight: 5 }} />
              <Text style={styles.pasteChipText}>Paste code from clipboard</Text>
            </TouchableOpacity>

            {/* Primary Verify Button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!isComplete || loading || isExpired) && styles.buttonDisabled,
              ]}
              onPress={handleVerify}
              disabled={loading || isExpired}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.textOnPrimary} />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>Verify & Continue</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={COLORS.textOnPrimary}
                    style={{ marginLeft: 6 }}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Resend Action Pill */}
            <View style={styles.resendSection}>
              {countdown > 0 ? (
                <View style={styles.timerBadge}>
                  <Ionicons name="hourglass-outline" size={14} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={styles.resendTimer}>Resend available in {countdown}s</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={handleResend}
                  disabled={resending}
                  activeOpacity={0.8}
                >
                  {resending ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.resendBtnText}>Resend New Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60,
  },
  inner: {
    paddingVertical: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    marginBottom: 24,
  },
  backText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
    marginLeft: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 26,
  },
  headerIconBadge: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    maxWidth: '90%',
  },
  emailText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 22,
    alignSelf: 'center',
  },
  expiryRowExpired: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  expiryText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  expiryTextExpired: {
    color: COLORS.absent,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  otpBoxContainer: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    backgroundColor: '#EEF2FF',
    borderColor: '#A5B4FC',
  },
  otpBoxFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  otpBoxExpired: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.7,
  },
  otpBoxText: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    color: COLORS.textPrimary,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.01,
    color: 'transparent',
  },
  pasteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 22,
  },
  pasteChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  resendSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resendTimer: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  resendBtnText: {
    color: COLORS.primary,
    fontSize: 13.5,
    fontWeight: '700',
  },
})
