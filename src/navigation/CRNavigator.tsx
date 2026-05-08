import React from 'react'
import { View, StyleSheet, Platform } from 'react-native'
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
import { StudentNavigator } from './StudentNavigator'
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

function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={24} color={focused ? COLORS.primary : COLORS.textMuted} />
      {focused && <View style={styles.dot} />}
    </View>
  )
}

export function CRNavigator() {
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 40 + insets.bottom : 48 + Math.max(insets.bottom, 12),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 12),
          paddingTop: 6,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'time' : 'time-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="StudentTab"
        component={StudentNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'school' : 'school-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} /> }}
      />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
})