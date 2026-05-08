import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Platform } from 'react-native'
import { COLORS } from '../constants/colors'

import { StudentDashboardScreen } from '../screens/student/StudentDashboardScreen'
import { StudentSubjectDetailScreen } from '../screens/student/StudentSubjectDetailScreen'
import { StudentHistoryScreen } from '../screens/student/StudentHistoryScreen'
import { StudentProfileScreen } from '../screens/student/StudentProfileScreen'
import { NotificationsScreen } from '../screens/shared/NotificationsScreen'
import { SupportSuggestionsScreen } from '../screens/shared/SupportSuggestionsScreen'

export type StudentStackParams = {
  StudentHome: undefined
  StudentSubjectDetail: {
    subjectId: string
    subjectName: string
    facultyName: string
    subjectType: 'CLASS' | 'LAB'
  }
  Notifications: undefined
}

export type StudentProfileStackParams = {
  StudentProfileMain: undefined
  SupportSuggestions: undefined
}

const AttStack = createStackNavigator<StudentStackParams>()
const ProfileStack = createStackNavigator<StudentProfileStackParams>()

function AttendanceStack() {
  return (
    <AttStack.Navigator screenOptions={{ headerShown: false }}>
      <AttStack.Screen name="StudentHome" component={StudentDashboardScreen} />
      <AttStack.Screen name="StudentSubjectDetail" component={StudentSubjectDetailScreen} />
      <AttStack.Screen name="Notifications" component={NotificationsScreen} />
    </AttStack.Navigator>
  )
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="StudentProfileMain" component={StudentProfileScreen} />
      <ProfileStack.Screen
        name="SupportSuggestions"
        component={SupportSuggestionsScreen}
        options={{ title: 'Support & Suggestions' }}
      />
    </ProfileStack.Navigator>
  )
}

const Tab = createBottomTabNavigator()

export function StudentNavigator() {
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 40 + insets.bottom : 48 + Math.max(insets.bottom, 12),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 12),
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          let icon: keyof typeof Ionicons.glyphMap = 'home'
          if (route.name === 'Attendance') {
            icon = focused ? 'stats-chart' : 'stats-chart-outline'
          } else if (route.name === 'History') {
            icon = focused ? 'time' : 'time-outline'
          } else if (route.name === 'Profile') {
            icon = focused ? 'person-circle' : 'person-circle-outline'
          }
          return <Ionicons name={icon} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Attendance" component={AttendanceStack} options={{ tabBarLabel: 'Attendance' }} />
      <Tab.Screen name="History" component={StudentHistoryScreen} options={{ tabBarLabel: 'History' }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  )
}