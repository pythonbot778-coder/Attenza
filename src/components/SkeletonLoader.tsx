// src/components/SkeletonLoader.tsx
import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated, ViewStyle } from 'react-native'
import { COLORS } from '../constants/colors'

interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export function SkeletonItem({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  )
}

export function HomeCardSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <View style={styles.rowBetween}>
        <SkeletonItem width="60%" height={20} borderRadius={6} />
        <SkeletonItem width={60} height={22} borderRadius={11} />
      </View>
      <View style={{ height: 8 }} />
      <SkeletonItem width="40%" height={14} borderRadius={4} />
      <View style={{ height: 16 }} />
      <View style={styles.rowBetween}>
        <SkeletonItem width={80} height={24} borderRadius={12} />
        <SkeletonItem width={100} height={32} borderRadius={8} />
      </View>
    </View>
  )
}

export function HistoryCardSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <View style={styles.rowBetween}>
        <SkeletonItem width="50%" height={18} borderRadius={6} />
        <SkeletonItem width={50} height={22} borderRadius={11} />
      </View>
      <View style={{ height: 8 }} />
      <SkeletonItem width="35%" height={13} borderRadius={4} />
      <View style={{ height: 12 }} />
      <View style={styles.rowBetween}>
        <SkeletonItem width={120} height={16} borderRadius={4} />
        <SkeletonItem width={60} height={24} borderRadius={12} />
      </View>
    </View>
  )
}

export function AttendanceGridSkeleton() {
  return (
    <View style={styles.gridContainer}>
      {[...Array(15)].map((_, i) => (
        <View key={i} style={styles.gridPill}>
          <SkeletonItem width={40} height={18} borderRadius={4} />
          <View style={{ height: 4 }} />
          <SkeletonItem width={50} height={10} borderRadius={3} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#CBD5E1',
  },
  cardSkeleton: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
  },
  gridPill: {
    width: '31%',
    height: 52,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
})
