import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { LoginScreen }         from '../screens/auth/LoginScreen'
import { OTPScreen }           from '../screens/auth/OTPScreen'
import { PasswordSetupScreen } from '../screens/auth/PasswordSetupScreen'
import { ProfileSetupScreen }  from '../screens/auth/ProfileSetupScreen'
import { RollRangeSetupScreen } from '../screens/auth/RollRangeSetupScreen'
import { useAuthStore }        from '../store/authStore'

export type AuthStackParams = {
  Login:        undefined
  OTP:          { email: string }
  PasswordSetup: { email: string }
  ProfileSetup: undefined
  RollRangeSetup: {
    branch:     string
    year:       number
    semester:   number
    section:    string
    role:       'CR' | 'LR'
    name:       string
    rollNumber: string
  }
}

const Stack = createStackNavigator<AuthStackParams>()

export function AuthNavigator() {
  const { isAuthenticated } = useAuthStore()
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={isAuthenticated ? 'ProfileSetup' : 'Login'}
    >
      <Stack.Screen name="Login"          component={LoginScreen} />
      <Stack.Screen name="OTP"            component={OTPScreen} />
      <Stack.Screen name="PasswordSetup"  component={PasswordSetupScreen} />
      <Stack.Screen name="ProfileSetup"   component={ProfileSetupScreen} />
      <Stack.Screen name="RollRangeSetup" component={RollRangeSetupScreen} />
    </Stack.Navigator>
  )
}