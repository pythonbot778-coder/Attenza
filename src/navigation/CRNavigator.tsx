import React from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
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

// ─── Stack param types ────────────────────────────────────────
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
}

// ─── Home Stack ───────────────────────────────────────────────
const HomeStack = createStackNavigator<HomeStackParams>()

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

// ─── History Stack ────────────────────────────────────────────
const HistoryStack = createStackNavigator<HistoryStackParams>()

function HistoryStackNavigator() {
    return (
        <HistoryStack.Navigator screenOptions={{ headerShown: false }}>
            <HistoryStack.Screen name="HistoryMain" component={HistoryScreen} />
            <HistoryStack.Screen name="SessionDetail" component={SessionDetailScreen} />
        </HistoryStack.Navigator>
    )
}

// ─── Bottom Tabs ──────────────────────────────────────────────
const Tab = createBottomTabNavigator()

function TabIcon({
    name, focused,
}: {
    name: keyof typeof Ionicons.glyphMap
    focused: boolean
}) {
    return (
        <View style={tabStyles.iconWrap}>
            <Ionicons
                name={name}
                size={26}
                color={focused ? COLORS.primary : COLORS.textMuted}
            />
            {focused && <View style={tabStyles.dot} />}
        </View>
    )
}

export function CRNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: tabStyles.tabBar,
                tabBarShowLabel: false,
                tabBarItemStyle: {
                    paddingVertical: 4,
                },
            }}
        >
            <Tab.Screen
                name="HomeTab"
                component={HomeStackNavigator}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon
                            name={focused ? 'home' : 'home-outline'}
                            focused={focused}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="HistoryTab"
                component={HistoryStackNavigator}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon
                            name={focused ? 'time' : 'time-outline'}
                            focused={focused}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="StudentTab"
                component={StudentNavigator}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon
                            name={focused ? 'school' : 'school-outline'}
                            focused={focused}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="ProfileTab"
                component={ProfileScreen}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon
                            name={focused ? 'person' : 'person-outline'}
                            focused={focused}
                        />
                    ),
                }}
            />
        </Tab.Navigator>
    )
}

const tabStyles = StyleSheet.create({
    tabBar: {
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        height: Platform.OS === 'ios' ? 80 : 58,
        paddingBottom: Platform.OS === 'ios' ? 24 : 4,
        paddingTop: 6,
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.primary,
    },
    // Remove iconLabel and iconLabelActive entirely
})
