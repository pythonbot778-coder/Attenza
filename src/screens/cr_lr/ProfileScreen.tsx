import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native'
import { TabView, SceneMap } from 'react-native-tab-view'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { PersonalProfileTab } from './components/PersonalProfileTab'
import { ClassManagementTab } from './components/ClassManagementTab'

interface CustomTabBarProps {
  routes: { key: string; title: string; icon: keyof typeof Ionicons.glyphMap }[]
  index: number
  onIndexChange: (i: number) => void
}

function CustomTabBar({ routes, index, onIndexChange }: CustomTabBarProps) {
  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.tabBarPillTrack}>
        {routes.map((route, i) => {
          const active = i === index

          return (
            <TouchableOpacity
              key={route.key}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => onIndexChange(i)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={route.icon}
                size={16}
                color={active ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {route.title}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

export function ProfileScreen() {
  const layout = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const [routes] = useState([
    { key: 'profile', title: 'Personal Profile', icon: 'person' as const },
    { key: 'members', title: 'Class Management', icon: 'people' as const },
  ])

  const renderScene = SceneMap({
    profile: PersonalProfileTab,
    members: ClassManagementTab,
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account & Class</Text>
      </View>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={() => (
          <CustomTabBar
            routes={routes}
            index={index}
            onIndexChange={setIndex}
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },
  tabBarContainer: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBarPillTrack: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: COLORS.surface,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
})
