// src/components/NotificationBanner.tsx
import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNotificationBannerStore } from '../store/notificationBannerStore'
import { navigateTo } from '../navigation/navigationRef'

const BANNER_HEIGHT = 72
const AUTO_HIDE_MS = 4000

export const NotificationBanner: React.FC = () => {
  const { banner, isVisible, hideBanner } = useNotificationBannerStore()
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT - 20)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isVisible && banner) {
      // slide down
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()

      const timer = setTimeout(() => {
        handleClose()
      }, AUTO_HIDE_MS)

      return () => clearTimeout(timer)
    } else {
      // slide up (hide)
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -BANNER_HEIGHT - 20,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [isVisible, banner])

  const handleClose = () => {
    hideBanner()
  }

  const handlePress = () => {
    hideBanner()
    try {
      navigateTo('Notifications')
    } catch { }
  }

  if (!banner) return null

  return (
    <Animated.View
      pointerEvents={isVisible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
        <View style={styles.card}>
          <View style={styles.textContainer}>
            <Text numberOfLines={1} style={styles.title}>
              {banner.title || 'Notification'}
            </Text>
            <Text numberOfLines={2} style={styles.body}>
              {banner.body}
            </Text>
          </View>
          <Text style={styles.viewText}>View</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 32, // below status bar
    left: 12,
    right: 12,
    zIndex: 999,
    elevation: 10,
  },
  card: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#111827', // dark
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  body: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  viewText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '600',
  },
})