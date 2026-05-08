import React, { Component, ReactNode } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native'
import { COLORS } from '../constants/colors'

interface Props {
  children: ReactNode
  fallbackLabel?: string   // optional context label e.g. "Student Dashboard"
}

interface State {
  hasError:   boolean
  error:      Error | null
  errorInfo:  string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production, send to your error tracker (Sentry, etc.)
    console.error('[ErrorBoundary]', error.message, info.componentStack)
    this.setState({ errorInfo: info.componentStack ?? null })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const label = this.props.fallbackLabel ?? 'this screen'

    return (
      <View style={styles.container}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          An unexpected error occurred in {label}.{'\n'}
          Your data is safe — please try again.
        </Text>

        <TouchableOpacity style={styles.btn} onPress={this.handleReset} activeOpacity={0.85}>
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>

        {/* Dev-only stack trace */}
        {__DEV__ && this.state.error && (
          <ScrollView style={styles.devBox} showsVerticalScrollIndicator={false}>
            <Text style={styles.devTitle}>{this.state.error.message}</Text>
            {this.state.errorInfo && (
              <Text style={styles.devStack}>{this.state.errorInfo}</Text>
            )}
          </ScrollView>
        )}
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, padding: 32,
  },
  icon:     { fontSize: 52, marginBottom: 16 },
  title:    { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  btn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  devBox: {
    marginTop: 24, backgroundColor: '#1E293B',
    borderRadius: 10, padding: 12,
    maxHeight: 200, width: '100%',
  },
  devTitle: { color: '#F87171', fontWeight: '700', fontSize: 12, marginBottom: 6 },
  devStack: { color: '#94A3B8', fontSize: 10, fontFamily: 'monospace' },
})