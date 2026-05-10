import React, { useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native'
import { ErrorBoundary }  from './src/components/ErrorBoundary'
import { RootNavigator }  from './src/navigation/RootNavigator'
import { hydrateAuthState, useAuthStore } from './src/store/authStore'
import {
  registerForPushNotifications,
  setupNotificationListeners,
  handleInitialNotification,
} from './src/utils/notificationUtils'
import { NotificationBanner } from './src/components/NotificationBanner'

const HYDRATION_TIMEOUT_MS = 8000

export default function App() {
  const cleanupListeners = useRef<(() => void) | null>(null)

  useEffect(() => {
    // hydrate auth from storage
    hydrateAuthState()

    // safety timeout for hydration
    const timer = setTimeout(() => {
      const { isLoading, reset } = useAuthStore.getState()
      if (isLoading) {
        console.warn('[App] Hydration timed out')
        reset()
      }
    }, HYDRATION_TIMEOUT_MS)

    // Set up foreground + tap listeners
    cleanupListeners.current = setupNotificationListeners()

    // Handle case where app was launched by tapping a notification
    handleInitialNotification()

    return () => {
      clearTimeout(timer)
      cleanupListeners.current?.()
    }
  }, [])

  // Register push token after auth resolves
  const { isAuthenticated, isLoading, role } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated || isLoading || role === null) return
    registerForPushNotifications().catch(e =>
      console.log('[App] Push registration failed:', e)
    )
  }, [isAuthenticated, isLoading, role])

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary fallbackLabel="the app">
        <StatusBar style="auto" />
        {/* Global in-app banner, overlays on top of all screens */}
        <NotificationBanner />
        <RootNavigator />
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })