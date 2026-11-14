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
import { RouteProp } from '@react-navigation/native'
import { supabase } from '../../api/supabase'
import { useAuthStore, hydrateAuthState } from '../../store/authStore'
import { COLORS } from '../../constants/colors'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { showDialog, showErrorDialog } from '../../store/dialogStore'

type Props = {
  navigation: StackNavigationProp<AuthStackParams, 'ChangePassword'>
  route: RouteProp<AuthStackParams, 'ChangePassword'>
}

export function ChangePasswordScreen({ navigation, route }: Props) {
  const { email } = route.params
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const isStrong = password.length >= 8
  const isMatch = password === confirm && confirm.length > 0

  function getStrengthLabel(): { label: string; color: string; percent: number } {
    if (password.length === 0) return { label: 'Enter password', color: COLORS.textMuted, percent: 0 }
    if (password.length < 8) return { label: 'Too short (min 8 chars)', color: COLORS.error, percent: 30 }
    if (password.length < 12) return { label: 'Good password', color: COLORS.warning, percent: 70 }
    return { label: 'Strong password', color: COLORS.success, percent: 100 }
  }

  const strength = getStrengthLabel()

  async function handleChangePassword() {
    if (!isStrong) {
      showErrorDialog('Weak Password', 'Password must be at least 8 characters long.')
      return
    }
    if (!isMatch) {
      showErrorDialog('Passwords Mismatch', 'The passwords you entered do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      showErrorDialog('Error', error.message ?? 'Could not update password. Please try again.')
      return
    }

    // Password updated. Show custom success dialog, then hand off to hydrateAuthState
    showDialog({
      type: 'success',
      title: 'Password Updated',
      message: 'Your password has been changed successfully. You are now logged in.',
      buttons: [
        {
          text: 'Continue to Dashboard →',
          style: 'primary',
          onPress: async () => {
            useAuthStore.getState().setUser({ authStep: 'ONBOARDED', isLoading: true })
            await hydrateAuthState()
          },
        },
      ],
    })
  }

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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Ionicons name="shield-checkmark-outline" size={30} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>
              Choose a strong new password for your account:
            </Text>
            <View style={styles.emailPill}>
              <Ionicons name="at" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.emailText} numberOfLines={1}>{email}</Text>
            </View>
          </View>

          {/* Main Card */}
          <View style={styles.card}>
            {/* New Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New Password</Text>
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
                  placeholder="Min. 8 characters"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPass(p => !p)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Strength Indicator */}
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: `${strength.percent}%`,
                        backgroundColor: strength.color,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={COLORS.textSecondary}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Re-enter password"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirm(p => !p)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {confirm.length > 0 && (
                <View
                  style={[
                    styles.matchBadge,
                    isMatch ? styles.matchBadgeSuccess : styles.matchBadgeError,
                  ]}
                >
                  <Ionicons
                    name={isMatch ? 'checkmark-circle' : 'close-circle'}
                    size={14}
                    color={isMatch ? COLORS.success : COLORS.error}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.matchText,
                      { color: isMatch ? COLORS.success : COLORS.error },
                    ]}
                  >
                    {isMatch ? 'Passwords match' : 'Passwords do not match'}
                  </Text>
                </View>
              )}
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!isStrong || !isMatch || loading) && styles.buttonDisabled,
              ]}
              onPress={handleChangePassword}
              disabled={!isStrong || !isMatch || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.textOnPrimary} />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>Update Password & Sign In</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={COLORS.textOnPrimary}
                    style={{ marginLeft: 6 }}
                  />
                </View>
              )}
            </TouchableOpacity>
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
    paddingTop: 32,
    paddingBottom: 60,
  },
  inner: {
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconBadge: {
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
    gap: 18,
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
  strengthContainer: {
    marginTop: 6,
    gap: 4,
  },
  strengthBar: {
    height: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  matchBadgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  matchBadgeError: {
    backgroundColor: '#FEE2E2',
  },
  matchText: {
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
    opacity: 0.45,
  },
  buttonText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
})
