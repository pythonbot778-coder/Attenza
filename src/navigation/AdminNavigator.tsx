import React from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../constants/colors'

import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen'
import { AdminClassesScreen } from '../screens/admin/AdminClassesScreen'
import { AdminClassDetailScreen } from '../screens/admin/AdminClassDetailScreen'
import { AdminTransfersScreen } from '../screens/admin/AdminTransfersScreen'
import { AdminLogsScreen } from '../screens/admin/AdminLogsScreen'
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen'
import { AdminSupportSuggestionsScreen } from '../screens/admin/AdminSupportSuggestionsScreen'

export type AdminClassStackParams = {
  AdminClassesList: undefined
  AdminClassDetail: { classId: string; label: string }
}

const ClassStack = createStackNavigator<AdminClassStackParams>()

function ClassStackNavigator() {
  return (
    <ClassStack.Navigator screenOptions={{ headerShown: false }}>
      <ClassStack.Screen name="AdminClassesList" component={AdminClassesScreen} />
      <ClassStack.Screen name="AdminClassDetail" component={AdminClassDetailScreen} />
    </ClassStack.Navigator>
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

export function AdminNavigator() {
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 40 + insets.bottom : 50 + Math.max(insets.bottom, 6),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 6),
          paddingTop: 6,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="AdminDash"
        component={AdminDashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="AdminClasses"
        component={ClassStackNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'school' : 'school-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="AdminUsers"
        component={AdminUsersScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="AdminTransfers"
        component={AdminTransfersScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'swap-horizontal' : 'swap-horizontal-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="AdminSupport"
        component={AdminSupportSuggestionsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="AdminLogs"
        component={AdminLogsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'document-text' : 'document-text-outline'} focused={focused} /> }}
      />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
})