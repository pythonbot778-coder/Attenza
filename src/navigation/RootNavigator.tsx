import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { supabase } from '../api/supabase'
import { useAuthStore, hydrateAuthState } from '../store/authStore'
import { AuthNavigator } from './AuthNavigator'
import { CRNavigator } from './CRNavigator'
import { StudentNavigator } from './StudentNavigator'
import { AdminNavigator } from './AdminNavigator'
import { COLORS } from '../constants/colors'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { OfflineBanner } from '../components/OfflineBanner'
import { AnimatedSplashScreen } from '../screens/shared/AnimatedSplashScreen'
import { RoleTransfer, getPendingTransferForUser } from '../api/roleTransferApi'
import { RoleTransferScreen } from '../screens/shared/RoleTransferScreen'
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
  const { isAuthenticated, role, reset, profileComplete } = useAuthStore()
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') hydrateAuthState()
      if (event === 'SIGNED_OUT') reset()
      if (event === 'TOKEN_REFRESHED') hydrateAuthState()
      if (event === 'USER_UPDATED') hydrateAuthState()
      if (event === 'INITIAL_SESSION' && session?.user) hydrateAuthState()
    })
    return () => subscription.unsubscribe()
  }, [reset])

  if (!splashDone) {
    return <AnimatedSplashScreen onFinish={() => setSplashDone(true)} />
  }

  return (
    <NavigationContainer>
      <OfflineBanner />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated || !role || !profileComplete ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <Stack.Screen name="App" component={AppScreenWrapper} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}