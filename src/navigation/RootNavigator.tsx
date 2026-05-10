import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { NavigationContainer }  from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { supabase }             from '../api/supabase'
import { useAuthStore, hydrateAuthState } from '../store/authStore'
import { AuthNavigator }    from './AuthNavigator'
import { CRNavigator }      from './CRNavigator'
import { StudentNavigator } from './StudentNavigator'
import { AdminNavigator }   from './AdminNavigator'
import { COLORS }           from '../constants/colors'
import { ErrorBoundary }    from '../components/ErrorBoundary'
import { OfflineBanner }    from '../components/OfflineBanner'
import { AnimatedSplashScreen } from '../screens/shared/AnimatedSplashScreen'
import { RoleTransfer, getPendingTransferForUser } from '../api/roleTransferApi'
import { RoleTransferScreen } from '../screens/shared/RoleTransferScreen'
import { navigationRef }    from '././navigationRef'

const Stack = createStackNavigator()

function ClassNotSetUpScreen() {
  return (
    <View style={waitStyles.container}>
      <Text style={waitStyles.icon}>🕐</Text>
      <Text style={waitStyles.title}>Waiting for Class Setup</Text>
      <Text style={waitStyles.body}>
        Your CR/LR hasn't set up the class yet. Contact them.{'\n\n'}
        Once they create the class, you'll be linked automatically.
      </Text>
      <View style={waitStyles.retryBtn}>
        <Text style={waitStyles.retryText} onPress={() => hydrateAuthState()}>
          Retry
        </Text>
      </View>
    </View>
  )
}

const waitStyles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 32, backgroundColor: COLORS.background,
  },
  icon:      { fontSize: 56, marginBottom: 20 },
  title:     { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12, textAlign: 'center' },
  body:      { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryBtn:  { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 10 },
  retryText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
})

export function RootNavigator() {
  const {
    isAuthenticated, isLoading, role, name,
    classNotSetUp, userId, reset,
  } = useAuthStore()

  const [splashDone,      setSplashDone]      = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState<RoleTransfer | null>(null)
  const [transferChecked, setTransferChecked] = useState(false)

  // Transfer check
  useEffect(() => {
    if (!isAuthenticated || isLoading || !userId || role === 'admin') {
      setPendingTransfer(null)
      setTransferChecked(true)
      return
    }
    setTransferChecked(false)
    getPendingTransferForUser(userId)
      .then(t  => setPendingTransfer(t))
      .catch(() => setPendingTransfer(null))
      .finally(() => setTransferChecked(true))
  }, [isAuthenticated, isLoading, userId, role])

  // Auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN')       hydrateAuthState()
      if (event === 'SIGNED_OUT')      reset()
      if (event === 'TOKEN_REFRESHED') hydrateAuthState()
      if (event === 'USER_UPDATED')    hydrateAuthState()
    })
    return () => subscription.unsubscribe()
  }, [reset])

  if (!splashDone) {
    return <AnimatedSplashScreen onFinish={() => setSplashDone(true)} />
  }

  function AppNavigator() {
    if (isLoading || (isAuthenticated && !transferChecked)) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )
    }

    if (pendingTransfer) {
      return (
        <RoleTransferScreen
          transfer={pendingTransfer}
          onDone={() => setPendingTransfer(null)}
        />
      )
    }

    if (role === 'admin')               return <AdminNavigator />
    if (!name)                          return <AuthNavigator />
    if (classNotSetUp)                  return <ClassNotSetUpScreen />
    if (role === 'CR' || role === 'LR') return <CRNavigator />
    if (role === 'STUDENT')             return <StudentNavigator />
    return <AuthNavigator />
  }

  return (
    // ← navigationRef connected here so navigateTo() works globally
    <NavigationContainer ref={navigationRef}>
      <OfflineBanner />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <Stack.Screen
            name="App"
            component={() => (
              <ErrorBoundary fallbackLabel="the main app">
                <AppNavigator />
              </ErrorBoundary>
            )}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}