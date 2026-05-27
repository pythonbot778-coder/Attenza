import React, { useEffect, useRef } from 'react'
import {
  Animated, Easing, StyleSheet, View,
  Text, Dimensions, Image,
} from 'react-native'
import { VyndraFooter } from '../../components/VyndraFooter'

const { width, height } = Dimensions.get('window')

interface Props {
  onFinish: () => void
}

/**
 * Animated splash screen for Attenza.
 *
 * Sequence:
 * 0ms   — dark background fades in instantly
 * 200ms — logo scales in with spring
 * 600ms — ring orbit starts (continuous rotation)
 * 800ms — "Attenza" text fades + slides up
 * 1100ms — subtitle fades in
 * 2400ms — whole screen fades out
 * 2800ms — onFinish() called → app navigates away
 *
 * Place this in RootNavigator: show it while isLoading=true,
 * call onFinish when ready.
 */
export function AnimatedSplashScreen({ onFinish }: Props) {
  // Core animations
  const bgOpacity    = useRef(new Animated.Value(0)).current
  const logoScale    = useRef(new Animated.Value(0.4)).current
  const logoOpacity  = useRef(new Animated.Value(0)).current
  const ringRotation = useRef(new Animated.Value(0)).current
  const textOpacity  = useRef(new Animated.Value(0)).current
  const textY        = useRef(new Animated.Value(16)).current
  const subOpacity   = useRef(new Animated.Value(0)).current
  const exitOpacity  = useRef(new Animated.Value(1)).current

  // Dot pulse
  const dot1Scale = useRef(new Animated.Value(0)).current
  const dot2Scale = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // 1. Background
    Animated.timing(bgOpacity, {
      toValue: 1, duration: 300, useNativeDriver: true,
    }).start()

    // 2. Logo spring in
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1, friction: 6, tension: 70, useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }),
      ]),
    ]).start()

    // 3. Orbit ring — continuous
    Animated.delay(500).start(() => {
      Animated.loop(
        Animated.timing(ringRotation, {
          toValue: 1, duration: 2000,
          easing: Easing.linear, useNativeDriver: true,
        })
      ).start()
    })

    // 4. Dots bounce in staggered
    Animated.sequence([
      Animated.delay(700),
      Animated.stagger(120, [
        Animated.spring(dot1Scale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
        Animated.spring(dot2Scale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
      ]),
    ]).start()

    // 5. Text slides up
    Animated.sequence([
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(textY, {
          toValue: 0, duration: 400,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]),
    ]).start()

    // 6. Subtitle
    Animated.sequence([
      Animated.delay(1100),
      Animated.timing(subOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()

    // 7. Exit fade
    Animated.sequence([
      Animated.delay(2400),
      Animated.timing(exitOpacity, {
        toValue: 0, duration: 500,
        easing: Easing.in(Easing.quad), useNativeDriver: true,
      }),
    ]).start(() => onFinish())
  }, [])

  const ringStyle = {
    transform: [{
      rotate: ringRotation.interpolate({
        inputRange:  [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    }],
  }

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.bg, { opacity: bgOpacity }]} />

      {/* Logo + orbit ring group */}
      <Animated.View style={[
        styles.logoGroup,
        { opacity: logoOpacity, transform: [{ scale: logoScale }] },
      ]}>
        {/* Orbit ring */}
        <Animated.View style={[styles.orbitRing, ringStyle]}>
          <View style={styles.orbitDot} />
        </Animated.View>

        {/* App icon */}
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Floating dots (matching brand) */}
        <Animated.View style={[styles.floatDot, styles.floatDot1, { transform: [{ scale: dot1Scale }] }]} />
        <Animated.View style={[styles.floatDot, styles.floatDot2, { transform: [{ scale: dot2Scale }] }]} />
      </Animated.View>

      {/* Text block */}
      <Animated.View style={[
        styles.textBlock,
        { opacity: textOpacity, transform: [{ translateY: textY }] },
      ]}>
        <Text style={styles.appName}>Attenza</Text>
        <View style={styles.subtitleRow}>
          <View style={styles.subtitleLine} />
          <Animated.Text style={[styles.subtitle, { opacity: subOpacity }]}>
            Hub
          </Animated.Text>
          <View style={styles.subtitleLine} />
        </View>
        <Animated.Text style={[styles.tagline, { opacity: subOpacity }]}>
          Attendance That Syncs
        </Animated.Text>
      </Animated.View>

      {/* Vyndra footer — fades in with the rest of the splash */}
      <Animated.View style={[styles.brandFooter, { opacity: subOpacity }]}>
        <VyndraFooter light showLogo />
      </Animated.View>
    </Animated.View>
  )
}

const TEAL  = '#00C9A7'
const NAVY  = '#0D1B3E'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: NAVY,
  },
  bg: {
    backgroundColor: NAVY,
  },

  logoGroup: {
    width:  200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },

  logo: {
    width:  140,
    height: 140,
  },

  orbitRing: {
    position:   'absolute',
    width:      190,
    height:     190,
    borderRadius: 95,
    borderWidth: 2.5,
    borderColor: TEAL + '40',
    borderStyle: 'dashed',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  orbitDot: {
    width:         12,
    height:        12,
    borderRadius:  6,
    backgroundColor: TEAL,
    marginTop:    -6,
    shadowColor:  TEAL,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation:    8,
  },

  floatDot: {
    position: 'absolute',
    borderRadius: 50,
  },
  floatDot1: {
    width:  10, height: 10,
    backgroundColor: NAVY,
    borderWidth: 2, borderColor: TEAL,
    top: 20, right: 32,
  },
  floatDot2: {
    width:  7, height: 7,
    backgroundColor: TEAL + '80',
    top: 38, right: 26,
  },

  textBlock: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  appName: {
    fontSize:    42,
    fontWeight:  '900',
    color:       '#FFFFFF',
    letterSpacing: 1,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginTop:     4,
    marginBottom:  12,
  },
  subtitleLine: {
    width:           28,
    height:          2,
    backgroundColor: TEAL,
    borderRadius:    1,
  },
  subtitle: {
    fontSize:    20,
    fontWeight:  '700',
    color:       TEAL,
    letterSpacing: 2,
  },
  tagline: {
    fontSize:    14,
    fontWeight:  '500',
    color:       '#94A3B8',
    letterSpacing: 0.5,
  },
  brandFooter: {
    position: 'absolute',
    bottom:   28,
    left:     0,
    right:    0,
    alignItems: 'center',
  },
})