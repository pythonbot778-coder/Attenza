import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { COLORS } from '../constants/colors'

const GUIDE_STORAGE_KEY = '@attenza_guide_completed_v1'

type Props = {
  visible: boolean
  onClose: () => void
}

type Slide = {
  badge: string
  badgeIcon: keyof typeof Ionicons.glyphMap
  badgeColor: string
  title: string
  subtitle: string
  highlights: {
    icon: keyof typeof Ionicons.glyphMap
    title: string
    desc: string
    color: string
  }[]
  actionLabel: string
}

const SLIDES: Slide[] = [
  {
    badge: 'GRAND WELCOME',
    badgeIcon: 'sparkles',
    badgeColor: COLORS.primary,
    title: 'Welcome to Attenza! ✨',
    subtitle:
      'The modern, paperless attendance companion designed specifically for Class and Lady Representatives.',
    highlights: [
      {
        icon: 'flash-outline',
        title: 'Mark in 30 Seconds',
        desc: 'Quick actions like "All Present" and 1-tap absentee toggles make roll call instant.',
        color: '#F59E0B',
      },
      {
        icon: 'shield-checkmark-outline',
        title: '30-Minute Grace Window',
        desc: 'Accidentally marked someone absent? You can safely edit recent sessions anytime.',
        color: '#10B981',
      },
      {
        icon: 'document-text-outline',
        title: 'Instant CSV Export',
        desc: 'Export verified, department-ready spreadsheets directly to Excel or WhatsApp.',
        color: COLORS.primary,
      },
    ],
    actionLabel: 'Explore the 1-Minute Guide →',
  },
  {
    badge: 'STEP 1 OF 3',
    badgeIcon: 'library-outline',
    badgeColor: '#2563EB',
    title: 'Set Up Your Subjects 📚',
    subtitle:
      'Everything is organized neatly for your branch, academic year, semester, and section.',
    highlights: [
      {
        icon: 'add-circle-outline',
        title: 'Tap ＋ on the Home Screen',
        desc: 'Quickly create Theory classes and Lab sessions with faculty names.',
        color: '#2563EB',
      },
      {
        icon: 'flask-outline',
        title: 'Lab Batches Supported',
        desc: 'Split labs into Batch 1 & Batch 2 with automatic roll number splitting.',
        color: '#7C3AED',
      },
      {
        icon: 'stats-chart-outline',
        title: 'Detailed Subject Stats',
        desc: 'Long press any subject card to inspect average attendance rates and student standing.',
        color: '#059669',
      },
    ],
    actionLabel: 'Next: Taking Attendance →',
  },
  {
    badge: 'STEP 2 OF 3',
    badgeIcon: 'checkmark-done-circle-outline',
    badgeColor: '#15803D',
    title: 'Fast & Accurate Marking ⏱️',
    subtitle:
      'Never fumble with paper registers or lose track of students in noisy classrooms.',
    highlights: [
      {
        icon: 'checkmark-circle-outline',
        title: '1-Tap "All Present"',
        desc: 'Start by marking everyone present, then simply tap absent roll numbers.',
        color: '#15803D',
      },
      {
        icon: 'calculator-outline',
        title: 'Live Summary Bar',
        desc: 'Keep track of Present, Absent, Total count, and percentage rate in real-time.',
        color: COLORS.primary,
      },
      {
        icon: 'time-outline',
        title: '30-Min Safe Editing',
        desc: 'Late student arrived? Open History and update the session before the grace timer ends.',
        color: '#D97706',
      },
    ],
    actionLabel: 'Next: Reports & Concluding →',
  },
  {
    badge: 'STEP 3 OF 3',
    badgeIcon: 'ribbon-outline',
    badgeColor: '#7C3AED',
    title: 'Conclude & Export Semester 🎓',
    subtitle:
      'Seamless record-keeping and archiving when your semester concludes.',
    highlights: [
      {
        icon: 'calendar-outline',
        title: 'Attendance History Tab',
        desc: 'Review past sessions filtered by date, theory, or lab with full audit trails.',
        color: '#2563EB',
      },
      {
        icon: 'download-outline',
        title: 'End Semester CSV Export',
        desc: 'Visit Profile > "End Semester & Export CSV" to compile all verified logs into one spreadsheet.',
        color: '#7C3AED',
      },
      {
        icon: 'help-circle-outline',
        title: 'Re-open Guide Anytime',
        desc: 'You can revisit this walkthrough at any time from your Profile preferences.',
        color: '#059669',
      },
    ],
    actionLabel: 'Complete Guide & Start! 🚀',
  },
]

export function WelcomeGuideModal({ visible, onClose }: Props) {
  const [currentStep, setCurrentStep] = useState(0)

  async function handleComplete() {
    try {
      await AsyncStorage.setItem(GUIDE_STORAGE_KEY, 'true')
    } catch {}
    setCurrentStep(0)
    onClose()
  }

  function handleNext() {
    if (currentStep < SLIDES.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  const slide = SLIDES[currentStep]

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleComplete}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          {/* Top Bar with Step Indicators & Skip */}
          <View style={styles.topBar}>
            <View style={styles.stepDots}>
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentStep && styles.dotActive,
                    i < currentStep && styles.dotDone,
                  ]}
                />
              ))}
            </View>
            <TouchableOpacity onPress={handleComplete} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Slide Content Scroll */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Badge */}
            <View style={[styles.badge, { backgroundColor: slide.badgeColor + '18', borderColor: slide.badgeColor + '35' }]}>
              <Ionicons name={slide.badgeIcon} size={14} color={slide.badgeColor} style={{ marginRight: 6 }} />
              <Text style={[styles.badgeText, { color: slide.badgeColor }]}>{slide.badge}</Text>
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>

            {/* Feature Highlight Cards */}
            <View style={styles.highlightsWrap}>
              {slide.highlights.map((item, idx) => (
                <View key={idx} style={styles.highlightCard}>
                  <View style={[styles.iconCircle, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <View style={styles.highlightTextWrap}>
                    <Text style={styles.highlightTitle}>{item.title}</Text>
                    <Text style={styles.highlightDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleNext}
              activeOpacity={0.88}
            >
              <Text style={styles.actionBtnText}>{slide.actionLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 24 : 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    width: 34,
    backgroundColor: COLORS.primary,
  },
  dotDone: {
    backgroundColor: COLORS.primaryLight,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 10,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
    fontWeight: '500',
  },
  highlightsWrap: {
    gap: 14,
  },
  highlightCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTextWrap: {
    flex: 1,
  },
  highlightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  highlightDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  footer: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 3,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
})
