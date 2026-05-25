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
import { check, validateCollegeEmail } from '../../utils/validation'

type Props = {
  navigation: StackNavigationProp<AuthStackParams, 'ForgotPassword'>
}

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSendOTP() {
    const trimmed = email.trim().toLowerCase()
    if (!check(validateCollegeEmail(trimmed))) return

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: false },
    })
    setLoading(false)

    if (error) {
      const msg = error.message?.toLowerCase().includes('user not found') ||
                  error.message?.toLowerCase().includes('invalid')
        ? 'No account found with this email. Please check and try again.'
        : error.message ?? 'An unexpected error occurred.'
      Alert.alert('Error', msg)
      return
    }

    navigation.navigate('OTP', { email: trimmed, purpose: 'forgot_password' })
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
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter your college email and we'll send a code to reset your password.
          </Text>
        </View>

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

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendOTP}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={COLORS.textOnPrimary} />
            : <Text style={styles.buttonText}>Send Reset Code</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, paddingHorizontal: 28, paddingTop: 60 },
  backBtn: { marginBottom: 32 },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 16, color: COLORS.textPrimary,
  },
  button: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.textOnPrimary, fontSize: 16, fontWeight: '700' },
})
