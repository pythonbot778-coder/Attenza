import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { LoginScreen } from '../screens/auth/LoginScreen'
import { OTPScreen } from '../screens/auth/OTPScreen'
import { PasswordSetupScreen } from '../screens/auth/PasswordSetupScreen'
import { ProfileSetupScreen } from '../screens/auth/ProfileSetupScreen'
import { RollRangeSetupScreen } from '../screens/auth/RollRangeSetupScreen'
import { useAuthStore } from '../store/authStore'

export type AuthStackParams = {
  Login: undefined
  OTP: { email: string }
  PasswordSetup: { email: string }
  ProfileSetup: undefined
  RollRangeSetup: {
    branch: string
    year: number
    semester: number
    section: string
    role: 'CR' | 'LR'
    name: string
    rollNumber: string
  }
}

const Stack = createStackNavigator<AuthStackParams>()

export function AuthNavigator() {
  const { isAuthenticated, profileComplete, name, mobileNumber } = useAuthStore()

  // Determine where in the setup flow this user is
  const getInitialRoute = (): keyof AuthStackParams => {
    if (!isAuthenticated) return 'Login'
    // Authenticated but no name/mobile = password was just set, go to profile
    if (!name || !mobileNumber) return 'ProfileSetup'
    // Profile complete but got here somehow = login
    return 'Login'
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={getInitialRoute()}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="PasswordSetup" component={PasswordSetupScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="RollRangeSetup" component={RollRangeSetupScreen} />
    </Stack.Navigator>
  )
}