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
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StackNavigationProp } from '@react-navigation/stack'
import { supabase } from '../../api/supabase'
import { COLORS } from '../../constants/colors'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { check, validateCollegeEmail } from '../../utils/validation'
import { showErrorDialog } from '../../store/dialogStore'
import { VyndraFooter } from '../../components/VyndraFooter'

type Props = {
  navigation: StackNavigationProp<AuthStackParams, 'Login'>
}

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<'password' | 'otp'>('password')
  const [loading, setLoading] = useState(false)

  async function handlePasswordLogin() {
    const trimmed = email.trim().toLowerCase()

    if (!check(validateCollegeEmail(trimmed))) return
    if (!password) {
      showErrorDialog('Password Required', 'Please enter your password to continue.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    })
    setLoading(false)

    if (error) {
      showErrorDialog(
        'Login Failed',
        error.message?.includes('Invalid login credentials')
          ? 'Invalid email or password. Please check your credentials and try again.'
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
      showErrorDialog('Error Sending Code', error.message ?? 'An unexpected error occurred.')
      return
    }

    navigation.navigate('OTP', { email: trimmed, purpose: 'otp_login' })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          {/* Header Brand */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="school" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.logo}>Attenza</Text>
            <Text style={styles.tagline}>Attendance that syncs, simplified.</Text>
          </View>

          {/* Main Card Container */}
          <View style={styles.card}>
            {/* Mode Toggle Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, mode === 'password' && styles.tabActive]}
                onPress={() => setMode('password')}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="key-outline"
                  size={16}
                  color={mode === 'password' ? COLORS.primary : COLORS.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabText,
                    mode === 'password' && styles.tabTextActive,
                  ]}
                >
                  Password
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, mode === 'otp' && styles.tabActive]}
                onPress={() => setMode('otp')}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={mode === 'otp' ? COLORS.primary : COLORS.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabText,
                    mode === 'otp' && styles.tabTextActive,
                  ]}
                >
                  Email OTP
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>College Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={COLORS.textSecondary}
                    style={styles.inputPrefixIcon}
                  />
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
                </View>
                <Text style={styles.helperText}>Use your institutional college email</Text>
              </View>

              {mode === 'password' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={COLORS.textSecondary}
                      style={styles.inputPrefixIcon}
                    />
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(p => !p)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Action Button */}
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={mode === 'password' ? handlePasswordLogin : handleSendOTP}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.textOnPrimary} />
                ) : (
                  <View style={styles.buttonInner}>
                    <Text style={styles.buttonText}>
                      {mode === 'password' ? 'Sign In' : 'Send Verification Code'}
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color={COLORS.textOnPrimary}
                      style={{ marginLeft: 6 }}
                    />
                  </View>
                )}
              </TouchableOpacity>

              {/* Forgot Password */}
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => navigation.navigate('ForgotPassword')}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Informational Subtext */}
          <View style={styles.hintCard}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={COLORS.primary}
              style={{ marginRight: 8, marginTop: 1 }}
            />
            <Text style={styles.hintText}>
              {mode === 'otp'
                ? 'A 6-digit security code will be sent to your inbox to log in or register.'
                : 'First time here? Switch to Email OTP above to automatically register.'}
            </Text>
          </View>

          <VyndraFooter style={{ marginTop: 24 }} />
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
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  inner: {
    paddingVertical: 36,
  },
  header: {
    marginBottom: 28,
    alignItems: 'center',
  },
  logoBadge: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  logo: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.8,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
    fontWeight: '500',
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: COLORS.surface,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  form: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputPrefixIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  eyeBtn: {
    padding: 8,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 2,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  forgotBtn: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 2,
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  hintText: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.primaryDark,
    lineHeight: 18,
    fontWeight: '500',
  },
})
