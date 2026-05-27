import React from 'react'
import { View, Text, Image, StyleSheet, ImageSourcePropType, StyleProp, ViewStyle } from 'react-native'
import { COLORS } from '../constants/colors'

/**
 * Vyndra branding footer.
 *
 * To enable the logo image:
 *   1. Save the Vyndra "V" mark as /assets/vyndra-mark.png (square, transparent BG, 180x180+).
 *   2. Uncomment the `require` line below.
 *   3. Pass `showLogo` to the footer where you want the icon — defaults to text-only.
 *
 * Defaults to compact text-only so the bundle never breaks if the asset is missing.
 */

// Uncomment after dropping the asset in /assets/:
// const VYNDRA_MARK: ImageSourcePropType = require('../../assets/vyndra-mark.png')
const VYNDRA_MARK: ImageSourcePropType | null = null

interface Props {
  /** Show the V mark above the wordmark. Defaults to false (text-only). */
  showLogo?: boolean
  /** Reverse layout — wordmark first, then logo (rarely used). */
  reverse?: boolean
  /** Tint the wordmark to a brighter color (for dark splash backgrounds). */
  light?: boolean
  /** Extra container style — override paddings, alignment, etc. */
  style?: StyleProp<ViewStyle>
}

export function VyndraFooter({ showLogo = false, reverse = false, light = false, style }: Props) {
  const canShowLogo = showLogo && VYNDRA_MARK !== null
  const textColor = light ? '#CBD5E1' : COLORS.textMuted
  const brandColor = light ? '#E2E8F0' : COLORS.textSecondary

  const logoEl = canShowLogo ? (
    <Image source={VYNDRA_MARK as ImageSourcePropType} style={styles.logo} resizeMode="contain" />
  ) : null

  const textEl = (
    <Text style={[styles.text, { color: textColor }]}>
      An app by <Text style={[styles.brand, { color: brandColor }]}>VYNDRA</Text>
    </Text>
  )

  return (
    <View style={[styles.container, style]}>
      {reverse ? (
        <>
          {textEl}
          {logoEl}
        </>
      ) : (
        <>
          {logoEl}
          {textEl}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  logo: {
    width: 28,
    height: 28,
  },
  text: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  brand: {
    fontWeight: '800',
    letterSpacing: 1.2,
  },
})
