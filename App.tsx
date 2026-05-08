import React, { useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ErrorBoundary } from './src/components/ErrorBoundary'
import { RootNavigator } from './src/navigation/RootNavigator'
import { hydrateAuthState, useAuthStore } from './src/store/authStore'
import { registerForPushNotifications, setupNotificationListeners } from './src/utils/notificationUtils'

const HYDRATION_TIMEOUT_MS = 8000

export default function App() {
  const cleanupListeners = useRef<(() => void) | null>(null)

  useEffect(() => {
    hydrateAuthState()

    const timer = setTimeout(() => {
      const { isLoading, reset } = useAuthStore.getState()
      if (isLoading) {
        console.warn('[App] hydration timed out')
        reset()
      }
    }, HYDRATION_TIMEOUT_MS)

    cleanupListeners.current = setupNotificationListeners()

    return () => {
      clearTimeout(timer)
      cleanupListeners.current?.()
    }
  }, [])

  const { isAuthenticated, isLoading, role } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated || isLoading || role === null) return

    registerForPushNotifications().catch((e) =>
      console.log('[App] Push registration failed silently:', e)
    )
  }, [isAuthenticated, isLoading, role])

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary fallbackLabel="the app">
          <StatusBar style="auto" />
          <RootNavigator />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})