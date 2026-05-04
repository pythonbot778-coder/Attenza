import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { StudentDashboardScreen }  from '../screens/student/StudentDashboardScreen'
import { StudentSubjectDetailScreen } from '../screens/student/StudentSubjectDetailScreen'
import { StudentHistoryScreen }    from '../screens/student/StudentHistoryScreen'
import { StudentProfileScreen }    from '../screens/student/StudentProfileScreen'

// ── types ──────────────────────────────────────────────────────────────
export type StudentStackParams = {
  StudentHome: undefined
  StudentSubjectDetail: {
    subjectId:   string
    subjectName: string
    facultyName: string
    subjectType: 'CLASS' | 'LAB'
  }
}

// ── Attendance tab (stack so SubjectDetail can push on top) ─────────────
const AttStack = createStackNavigator<StudentStackParams>()

function AttendanceStack() {
  return (
    <AttStack.Navigator screenOptions={{ headerShown: false }}>
      <AttStack.Screen name="StudentHome"          component={StudentDashboardScreen} />
      <AttStack.Screen name="StudentSubjectDetail" component={StudentSubjectDetailScreen} />
    </AttStack.Navigator>
  )
}

// ── Bottom tab ──────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator()

export function StudentNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor:  COLORS.border,
          borderTopWidth:  1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          let icon: keyof typeof Ionicons.glyphMap = 'home'
          if (route.name === 'Attendance') {
            icon = focused ? 'stats-chart'         : 'stats-chart-outline'
          } else if (route.name === 'History') {
            icon = focused ? 'time'                : 'time-outline'
          } else if (route.name === 'Profile') {
            icon = focused ? 'person-circle'       : 'person-circle-outline'
          }
          return <Ionicons name={icon} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen
        name="Attendance"
        component={AttendanceStack}
        options={{ tabBarLabel: 'Attendance' }}
      />
      <Tab.Screen
        name="History"
        component={StudentHistoryScreen}
        options={{ tabBarLabel: 'History' }}
      />
      <Tab.Screen
        name="Profile"
        component={StudentProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  )
}