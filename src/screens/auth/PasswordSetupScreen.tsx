import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { supabase } from '../../api/supabase'
import { useAuthStore } from '../../store/authStore'
import { COLORS } from '../../constants/colors'
import { AuthStackParams } from '../../navigation/AuthNavigator'

type Props = {
  navigation: StackNavigationProp<AuthStackParams, 'PasswordSetup'>
  route: RouteProp<AuthStackParams, 'PasswordSetup'>
}

export function PasswordSetupScreen({ navigation, route }: Props) {
  const { email } = route.params
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const isStrong = password.length >= 8
  const isMatch  = password === confirm && confirm.length > 0

  async function handleSetPassword() {
    if (!isStrong) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.')
      return
    }
    if (!isMatch) {
      Alert.alert('Mismatch', 'Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      const userMsg =
        error?.code?.startsWith('PGRST') ||
        error?.code?.startsWith('42') ||
        error?.code?.startsWith('23')
          ? 'Something went wrong. Please try again.'
          : error?.message ?? 'An unexpected error occurred.'
      Alert.alert('Error', userMsg)
      return
    }

    // Password is set — advance the onboarding step.
    // RootNavigator sees PASSWORD_SET and keeps user in AuthNavigator → ProfileSetup.
    useAuthStore.getState().setUser({ authStep: 'PASSWORD_SET' })

    // Use replace so back button can't return to PasswordSetup
    navigation.replace('ProfileSetup')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Password</Text>
          <Text style={styles.subtitle}>
            Set a secure password for{'\n'}
            <Text style={styles.emailText}>{email}</Text>
          </Text>
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 8 characters"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              editable={!loading}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(p => !p)}>
              <Ionicons
                name={showPass ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.textSecondary}
                accessibilityLabel={showPass ? 'Hide password' : 'Show password'}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.strengthBar}>
            <View style={[
              styles.strengthFill,
              {
                width: `${Math.min((password.length / 12) * 100, 100)}%`,
                backgroundColor: password.length >= 8 ? COLORS.success : COLORS.warning,
              }
            ]} />
          </View>
          <Text style={styles.strengthText}>
            {password.length === 0 ? '' : password.length < 8 ? 'Too short' : password.length < 12 ? 'Good' : 'Strong'}
          </Text>
        </View>

        {/* Confirm Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter password"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              editable={!loading}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(p => !p)}>
              <Ionicons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.textSecondary}
                accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              />
            </TouchableOpacity>
          </View>
          {confirm.length > 0 && (
            <Text style={{ color: isMatch ? COLORS.success : COLORS.error, fontSize: 13, marginTop: 4 }}>
              {isMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, (!isStrong || !isMatch || loading) && styles.buttonDisabled]}
          onPress={handleSetPassword}
          disabled={!isStrong || !isMatch || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={COLORS.textOnPrimary} />
            : <Text style={styles.buttonText}>Set Password & Continue</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, paddingHorizontal: 28, paddingTop: 80 },
  header: { marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
  emailText: { color: COLORS.primary, fontWeight: '600' },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
  },
  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.textPrimary },
  inputFlex: { flex: 1 },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 18 },
  strengthBar: {
    height: 4, backgroundColor: COLORS.borderLight,
    borderRadius: 2, marginTop: 8, overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthText: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  button: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 12,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: COLORS.textOnPrimary, fontSize: 16, fontWeight: '700' },
})
