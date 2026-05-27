import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { supabase } from '../../api/supabase'
import { COLORS } from '../../constants/colors'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { hydrateAuthState } from '../../store/authStore'
import { check, validateCollegeEmail } from '../../utils/validation'
import { VyndraFooter } from '../../components/VyndraFooter'

type Props = {
  navigation: StackNavigationProp<AuthStackParams, 'Login'>
}

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'password' | 'otp'>('password')
  const [loading, setLoading] = useState(false)

  async function handlePasswordLogin() {
    const trimmed = email.trim().toLowerCase()

    if (!check(validateCollegeEmail(trimmed))) return
    if (!password) {
      Alert.alert('Required', 'Please enter your password.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    })
    setLoading(false)

    if (error) {
      Alert.alert(
        'Login Failed',
        error.message?.includes('Invalid login credentials')
          ? 'Invalid email or password.'
          : error.message ?? 'Login failed. Please try again.',
      )
      return
    }
  }

  async function handleSendOTP() {
    const trimmed = email.trim().toLowerCase()

    if (!check(validateCollegeEmail(trimmed))) return

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    })
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message ?? 'An unexpected error occurred.')
      return
    }

    navigation.navigate('OTP', { email: trimmed, purpose: 'otp_login' })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // important: also behave on Android so content moves up
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.logo}>Attenza</Text>
            <Text style={styles.tagline}>Attendance that syncs, simplified.</Text>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'password' && styles.modeBtnActive]}
              onPress={() => setMode('password')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  mode === 'password' && styles.modeBtnTextActive,
                ]}
              >
                🔑 Password
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'otp' && styles.modeBtnActive]}
              onPress={() => setMode('otp')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  mode === 'otp' && styles.modeBtnTextActive,
                ]}
              >
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
              placeholder="yourname@college.edu"
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
              {loading ? (
                <ActivityIndicator color={COLORS.textOnPrimary} />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === 'password' ? 'Login' : 'Send OTP'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Forgot Password reachable from both modes — recovery shouldn't depend on
                the user picking the right tab first. */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.85}
            >
              <Text style={styles.forgotText}>
                Forgot password?
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            {mode === 'otp'
              ? 'A 6-digit code will be sent to your email.'
              : 'New user? Switch to Email OTP to register.'}
          </Text>

          <VyndraFooter style={{ marginTop: 28 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // new: controls how content sits *inside* the ScrollView
  scrollContent: {
    flexGrow: 1,              // allows scroll when content + keyboard exceed height
    justifyContent: 'center', // keeps form centered when there's extra space
    paddingHorizontal: 28,
  },

  // inner no longer needs flex:1, just vertical spacing
  inner: { paddingVertical: 40 },

  header: { marginBottom: 36, alignItems: 'center' },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -1,
  },
  tagline: { fontSize: 15, color: COLORS.textSecondary, marginTop: 6 },

  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  modeBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  modeBtnTextActive: { color: COLORS.textOnPrimary },

  form: { gap: 6 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.textOnPrimary, fontSize: 16, fontWeight: '700' },
  forgotBtn: { alignItems: 'center', marginTop: 14 },
  forgotText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  footer: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 24,
  },
})