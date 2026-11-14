import React from 'react'
import { StyleSheet, Platform } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../constants/colors'

import { HomeScreen } from '../screens/cr_lr/HomeScreen'
import { HistoryScreen } from '../screens/cr_lr/HistoryScreen'
import { SessionDetailScreen } from '../screens/cr_lr/SessionDetailScreen'
import { CreateSubjectScreen } from '../screens/cr_lr/CreateSubjectScreen'
import { AttendanceScreen } from '../screens/cr_lr/AttendanceScreen'
import { AttendanceSummaryScreen } from '../screens/cr_lr/AttendanceSummaryScreen'
import { ProfileScreen } from '../screens/cr_lr/ProfileScreen'
import { SubjectStatsScreen } from '../screens/cr_lr/SubjectStatsScreen'
import { EditSubjectScreen } from '../screens/cr_lr/EditSubjectScreen'
// Preserved for future restoration:
// import { StudentNavigator } from './StudentNavigator'
import { SupportSuggestionsScreen } from '../screens/shared/SupportSuggestionsScreen'

export type HomeStackParams = {
  HomeMain: undefined
  CreateSubject: undefined
  Attendance: {
    subjectId: string
    subjectName: string
    facultyName: string
    type: 'CLASS' | 'LAB'
    batches?: { id: string; batch_name: string; start_roll: string; end_roll: string }[]
  }
  AttendanceSummary: {
    subjectName: string
    facultyName: string
    subjectType: 'CLASS' | 'LAB'
    dateSelected: string
    presentCount: number
    absentCount: number
    totalCount: number
    absentRolls: string[]
    presentRolls: string[]
    batchName?: string | null
    sessionId: string
    durationHours?: number
    substituteTeacher?: string | null
  }
  SubjectStats: {
    subjectId: string
    subjectName: string
    facultyName: string
    type: 'CLASS' | 'LAB'
    batches?: { id: string; batch_name: string; start_roll: string; end_roll: string }[]
  }
  EditSubject: {
    subjectId: string
    subjectName: string
    facultyName: string
    type: 'CLASS' | 'LAB'
  }
}

export type HistoryStackParams = {
  HistoryMain: undefined
  SessionDetail: {
    sessionId: string
    session: any
  }
}

export type ProfileStackParams = {
  ProfileMain: undefined
  SupportSuggestions: undefined
}

const HomeStack = createStackNavigator<HomeStackParams>()
const HistoryStack = createStackNavigator<HistoryStackParams>()
const ProfileStack = createStackNavigator<ProfileStackParams>()

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="CreateSubject" component={CreateSubjectScreen} />
      <HomeStack.Screen name="Attendance" component={AttendanceScreen} />
      <HomeStack.Screen name="AttendanceSummary" component={AttendanceSummaryScreen} />
      <HomeStack.Screen name="SubjectStats" component={SubjectStatsScreen} />
      <HomeStack.Screen name="EditSubject" component={EditSubjectScreen} />
    </HomeStack.Navigator>
  )
}

function HistoryStackNavigator() {
  return (
    <HistoryStack.Navigator screenOptions={{ headerShown: false }}>
      <HistoryStack.Screen name="HistoryMain" component={HistoryScreen} />
      <HistoryStack.Screen name="SessionDetail" component={SessionDetailScreen} />
    </HistoryStack.Navigator>
  )
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen
        name="SupportSuggestions"
        component={SupportSuggestionsScreen}
        options={{ title: 'Support & Suggestions' }}
      />
    </ProfileStack.Navigator>
  )
}

const Tab = createBottomTabNavigator()

export function CRNavigator() {
  const insets = useSafeAreaInsets()
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 8)

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#64748B',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: 56 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          elevation: 8,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}
