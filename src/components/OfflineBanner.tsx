import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useIsOffline } from '../hooks/useNetworkStatus'
import { COLORS } from '../constants/colors'

/**
 * Drop this at the top of any screen's root View.
 * It auto-shows/hides based on network state.
 *
 * Usage:
 *   <View style={styles.container}>
 *     <OfflineBanner />
 *     ... rest of screen
 *   </View>
 */
export function OfflineBanner() {
  const isOffline = useIsOffline()
  const anim     = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue:         isOffline ? 1 : 0,
      duration:        250,
      useNativeDriver: false,
    }).start()
  }, [isOffline])

  const height = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 36],
  })

  const opacity = anim

  return (
    <Animated.View style={[styles.banner, { height, opacity }]}>
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text style={styles.text}>No internet connection — data may be outdated</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.warning,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    overflow:        'hidden',
    paddingHorizontal: 16,
  },
  text: {
    color:      '#fff',
    fontSize:   12,
    fontWeight: '600',
  },
})