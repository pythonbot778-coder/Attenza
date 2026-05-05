import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { supabase } from '../api/supabase'
import { useAuthStore, hydrateAuthState } from '../store/authStore'
import { AuthNavigator }    from './AuthNavigator'
import { CRNavigator }      from './CRNavigator'
import { StudentNavigator } from './StudentNavigator'
import { AdminNavigator }   from './AdminNavigator'
import { COLORS }           from '../constants/colors'
import { RoleTransfer, getPendingTransferForUser } from '../api/roleTransferApi'
import { RoleTransferScreen } from '../screens/shared/RoleTransferScreen'

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
    </View>
  )
}

const waitStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: COLORS.background },
  icon:  { fontSize: 56, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12, textAlign: 'center' },
  body:  { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
})

export function RootNavigator() {
  const { isAuthenticated, isLoading, role, classNotSetUp, userId, reset } = useAuthStore()
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
      .then(t => setPendingTransfer(t))
      .catch(() => setPendingTransfer(null))
      .finally(() => setTransferChecked(true))
  }, [isAuthenticated, isLoading, userId, role])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN')  hydrateAuthState()
      if (event === 'SIGNED_OUT') reset()
    })
    return () => subscription.unsubscribe()
  }, [reset])

  if (isLoading) return null

  function AppNavigator() {
    if (isAuthenticated && !transferChecked) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )
    }
    if (pendingTransfer) {
      return <RoleTransferScreen transfer={pendingTransfer} onDone={() => setPendingTransfer(null)} />
    }
    if (role === 'admin')               return <AdminNavigator />
    if (classNotSetUp)                  return <ClassNotSetUpScreen />
    if (role === 'CR' || role === 'LR') return <CRNavigator />
    if (role === 'STUDENT')             return <StudentNavigator />
    return <AuthNavigator />
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated || !role ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <Stack.Screen name="App" component={AppNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}