import React, { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import NetInfo from '@react-native-community/netinfo'
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
  const [retrying, setRetrying] = useState(false)

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

  // Re-probe connectivity. NetInfo broadcasts new state when it changes, so
  // useIsOffline will react and the banner will hide if we're actually back online.
  async function handleRetry() {
    if (retrying) return
    setRetrying(true)
    try {
      await NetInfo.refresh()
    } catch {
      // best-effort
    } finally {
      // Small delay so the spinner is visible even on instant probes.
      setTimeout(() => setRetrying(false), 400)
    }
  }

  return (
    <Animated.View style={[styles.banner, { height, opacity: anim }]}>
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text style={styles.text}>No internet connection — data may be outdated</Text>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={handleRetry}
        disabled={retrying}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {retrying
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.retryText}>Retry</Text>}
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.warning,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    overflow:        'hidden',
    paddingHorizontal: 16,
  },
  text: {
    color:      '#fff',
    fontSize:   12,
    fontWeight: '600',
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.6)',
    marginLeft:        4,
  },
  retryText: {
    color:      '#fff',
    fontSize:   11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
})