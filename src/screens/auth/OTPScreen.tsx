import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp }           from '@react-navigation/native'
import { supabase }            from '../../api/supabase'
import { COLORS }              from '../../constants/colors'
import { AuthStackParams }     from '../../navigation/AuthNavigator'

type Props = {
  navigation: StackNavigationProp<AuthStackParams, 'OTP'>
  route:      RouteProp<AuthStackParams, 'OTP'>
}

export function OTPScreen({ navigation, route }: Props) {
  const { email } = route.params
  const [otp,       setOtp]       = useState(['', '', '', '', '', ''])
  const [loading,   setLoading]   = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const inputs = useRef<(TextInput | null)[]>([])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  function handleOtpChange(value: string, index: number) {
    if (!/^\d*$/.test(value)) return  // digits only

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-advance to next input
    if (value && index < 5) {
      inputs.current[index + 1]?.focus()
    }
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
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    setLoading(false)

    if (error) {
      Alert.alert('Invalid OTP', 'The code is incorrect or expired. Try again.')
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
      return
    }

    // Check if user already has a password set (returning user)
    // New users go to PasswordSetup, returning users are handled by RootNavigator
    if (data.user) {
      navigation.navigate('PasswordSetup', { email })
    }
  }

  async function handleResend() {
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
      Alert.alert('Error', error.message)
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

        {/* OTP Input Boxes */}
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

        {/* Verify Button */}
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

        {/* Resend */}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
  },
  backBtn: {
    marginBottom: 32,
  },
  backText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  emailText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.textPrimary,
  },
  otpBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF2FF',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 24,
  },
  resendTimer: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  resendLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
})