import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { useAuthStore } from '../store/authStore'
import { AuthNavigator } from './AuthNavigator'
import { CRNavigator } from './CRNavigator'
import { StudentNavigator } from './StudentNavigator'
import { AdminNavigator } from './AdminNavigator'
import { COLORS } from '../constants/colors'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { OfflineBanner } from '../components/OfflineBanner'
import { AnimatedSplashScreen } from '../screens/shared/AnimatedSplashScreen'
import { RoleTransfer, getPendingTransferForUser, RoleTransferScreen } from '../api/roleTransferApi'
import { ClassNotSetUpScreen } from '../screens/shared/ClassNotSetUpScreen'

const Stack = createStackNavigator()

function AppScreenWrapper() {
  const { isLoading, role, classNotSetUp, userId, isAuthenticated } = useAuthStore()
  const [pendingTransfer, setPendingTransfer] = useState<RoleTransfer | null>(null)
  const [transferChecked, setTransferChecked] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || isLoading || !userId || role === 'admin') {
      setPendingTransfer(null)
      setTransferChecked(true)
      return
    }

    setTransferChecked(false)
    getPendingTransferForUser(userId)
      .then((t) => setPendingTransfer(t))
      .catch(() => setPendingTransfer(null))
      .finally(() => setTransferChecked(true))
  }, [isAuthenticated, isLoading, userId, role])

  return (
    <ErrorBoundary fallbackLabel="the main app">
      {isLoading || (isAuthenticated && !transferChecked) ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : pendingTransfer ? (
        <RoleTransferScreen transfer={pendingTransfer} onDone={() => setPendingTransfer(null)} />
      ) : role === 'admin' ? (
        <AdminNavigator />
      ) : classNotSetUp ? (
        <ClassNotSetUpScreen />
      ) : role === 'CR' || role === 'LR' ? (
        <CRNavigator />
      ) : role === 'STUDENT' ? (
        <StudentNavigator />
      ) : (
        <AuthNavigator />
      )}
    </ErrorBoundary>
  )
}

export function RootNavigator() {
  const { isAuthenticated, role, profileComplete, authStep, isLoading } = useAuthStore()
  const [splashDone, setSplashDone] = useState(false)
  // Latch: once we decide to show App, we don't flip back to Auth due to
  // transient loading state. This prevents AuthNavigator from being remounted
  // mid-flow (which would reset its stack to initialRouteName).
  const [showApp, setShowApp] = useState(false)
  // Once the very first boot finishes (splash animation done AND hydration done),
  // we latch this flag so subsequent loading states (e.g. token refresh) never
  // re-trigger the splash. Without this we'd get a blank flash on slow networks
  // when hydration outruns the splash animation.
  const [bootComplete, setBootComplete] = useState(false)

  const readyForApp =
    isAuthenticated &&
    !!role &&
    profileComplete &&
    !isLoading &&
    authStep !== 'FORGOT_PASSWORD_OTP_VERIFIED' &&
    authStep !== 'OTP_VERIFIED' &&
    authStep !== 'UNAUTHENTICATED'

  // Only ever transition Auth→App, never App→Auth (sign-out is handled by reset()).
  // This prevents intermediate store updates from flip-flopping the stack.
  React.useEffect(() => {
    if (readyForApp) setShowApp(true)
    // Sign-out: reset() sets isAuthenticated=false, which makes readyForApp false.
    if (!isAuthenticated && !isLoading) setShowApp(false)
  }, [readyForApp, isAuthenticated, isLoading])

  // Latch boot completion: splash animation finished AND auth store has settled.
  React.useEffect(() => {
    if (splashDone && !isLoading) setBootComplete(true)
  }, [splashDone, isLoading])

  if (!bootComplete) {
    return <AnimatedSplashScreen onFinish={() => setSplashDone(true)} />
  }

  return (
    <NavigationContainer>
      <OfflineBanner />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!showApp ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <Stack.Screen name="App" component={AppScreenWrapper} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}