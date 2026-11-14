import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  TextInput,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { COLORS } from '../../../constants/colors'
import { useAuthStore } from '../../../store/authStore'
import { supabase } from '../../../api/supabase'
import { getShowNames, setShowNames } from '../../../utils/attendancePrefs'
import { getArchivedSemesters, semesterLabel } from '../../../api/attendanceApi'
import { exportSemesterCsv } from '../../../utils/csvExport'
import { markCsvDownloaded } from '../../../utils/promotionTracker'
import { VyndraFooter } from '../../../components/VyndraFooter'
import {
  showErrorDialog,
  showSuccessDialog,
  showConfirmDialog,
} from '../../../store/dialogStore'
import { WelcomeGuideModal } from '../../../components/WelcomeGuideModal'

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  isLast?: boolean
}

function InfoRow({ icon, label, value, isLast }: InfoRowProps) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <View style={styles.infoRowLeft}>
        <View style={styles.infoIconWrap}>
          <Ionicons name={icon} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  )
}

export function PersonalProfileTab() {
  const {
    userId,
    name,
    email,
    rollNumber,
    role,
    branch,
    year,
    semester,
    section,
    avatarUrl,
    classId,
  } = useAuthStore()

  const [signingOut, setSigningOut] = useState(false)
  const navigation = useNavigation<any>()

  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [draftName, setDraftName] = useState(name ?? '')

  const [showNames, setShowNamesState] = useState(true)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [endingSemester, setEndingSemester] = useState(false)
  const [guideVisible, setGuideVisible] = useState(false)

  const [semesterLabels, setSemesterLabels] = useState<string[]>([])
  const [csvLoading, setCsvLoading] = useState<string | null>(null)
  const [labelsLoading, setLabelsLoading] = useState(true)

  const currentLabel =
    year != null && semester != null
      ? semesterLabel(Number(year), Number(semester))
      : null

  useEffect(() => {
    setDraftName(name ?? '')
  }, [name])

  useEffect(() => {
    getShowNames()
      .then((val) => setShowNamesState(val))
      .finally(() => setPrefsLoading(false))
  }, [])

  useEffect(() => {
    if (!classId) {
      setLabelsLoading(false)
      return
    }
    setLabelsLoading(true)
    getArchivedSemesters(classId)
      .then(setSemesterLabels)
      .catch(() => setSemesterLabels([]))
      .finally(() => setLabelsLoading(false))
  }, [classId])

  async function handleDownloadCsv(label: string) {
    if (!classId) return
    try {
      setCsvLoading(label)
      await exportSemesterCsv(classId, label, {
        branch: branch ?? '',
        year: year != null ? Number(year) : null,
        semester: semester != null ? Number(semester) : null,
        section: section,
      })
      await markCsvDownloaded(classId, label)
    } catch (e: any) {
      showErrorDialog('Export Failed', e?.message ?? 'Could not generate the CSV file.')
    } finally {
      setCsvLoading(null)
    }
  }

  async function handleSaveName() {
    const normalizedName = draftName.trim()

    if (!normalizedName) {
      showErrorDialog('Validation Error', 'Name cannot be empty.')
      return
    }

    if (!userId) {
      showErrorDialog('Session Error', 'No user session found. Please login again.')
      return
    }

    try {
      setSavingName(true)

      const { error } = await supabase
        .from('users')
        .update({ name: normalizedName })
        .eq('id', userId)

      if (error) throw error

      useAuthStore.getState().setUser({ name: normalizedName })
      setEditingName(false)
      showSuccessDialog('Profile Updated', 'Your name has been updated successfully.')
    } catch (e: any) {
      showErrorDialog('Save Failed', e?.message ?? 'Unable to update name.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleToggleNames(val: boolean) {
    setShowNamesState(val)
    await setShowNames(val)
  }

  function handleEndSemester() {
    if (!classId || !currentLabel) {
      showErrorDialog('Not Available', 'Class or semester information is not set.')
      return
    }

    showConfirmDialog(
      'End Semester & Export CSV',
      `Are you sure you want to conclude attendance for ${currentLabel}? All marked sessions will be compiled into the final semester attendance sheet and exported as a CSV report.`,
      async () => {
        setEndingSemester(true)
        try {
          await exportSemesterCsv(classId, currentLabel, {
            branch: branch ?? '',
            year: year != null ? Number(year) : null,
            semester: semester != null ? Number(semester) : null,
            section: section,
          })
          await markCsvDownloaded(classId, currentLabel)
          showSuccessDialog(
            'Semester Concluded',
            `Attendance records for ${currentLabel} have been successfully exported as CSV.`
          )
        } catch (e: any) {
          showErrorDialog('Export Error', e?.message ?? 'Could not export semester CSV.')
        } finally {
          setEndingSemester(false)
        }
      },
      undefined,
      'Export & End Semester',
      'Cancel',
      false
    )
  }

  function handleSignOut() {
    showConfirmDialog(
      'Sign Out',
      'Are you sure you want to sign out of Attenza?',
      async () => {
        setSigningOut(true)
        try {
          await supabase.auth.signOut()
          useAuthStore.getState().reset()
        } catch {
          useAuthStore.getState().reset()
        } finally {
          setSigningOut(false)
        }
      },
      undefined,
      'Sign Out',
      'Cancel',
      true
    )
  }

  const initials = name
    ? name
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'CR'

  const roleThemeColor = role === 'CR' ? COLORS.crColor : COLORS.lrColor

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header Hero */}
      <View style={styles.heroCard}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: roleThemeColor },
          ]}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>

        {editingName ? (
          <View style={styles.nameEditWrap}>
            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
              maxLength={80}
            />
            <View style={styles.nameActions}>
              <TouchableOpacity
                style={styles.nameCancelBtn}
                onPress={() => {
                  setDraftName(name ?? '')
                  setEditingName(false)
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.nameCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nameSaveBtn}
                onPress={handleSaveName}
                disabled={savingName}
                activeOpacity={0.8}
              >
                {savingName ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.nameSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{name ?? '—'}</Text>
            <TouchableOpacity
              onPress={() => setEditingName(true)}
              style={styles.editBtn}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.badgeRow}>
          <View style={[styles.roleBadge, {
            backgroundColor: role === 'CR' ? COLORS.crLight : COLORS.lrLight,
            borderColor: role === 'CR' ? COLORS.crBorder : COLORS.lrBorder,
            borderWidth: 1,
          }]}>
            <Ionicons
              name={role === 'CR' ? "shield-checkmark" : "sparkles"}
              size={13}
              color={roleThemeColor}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.roleBadgeText, { color: roleThemeColor }]}>
              {role === 'CR' ? 'Class Representative (CR)' : 'Lady Representative (LR)'}
            </Text>
          </View>
          {branch && (
            <View style={styles.subBadge}>
              <Text style={styles.subBadgeText}>{branch} - Sec {section ?? 'A'}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Account Info */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Account Details</Text>
        </View>
        <InfoRow icon="mail-outline" label="Email" value={email ?? '—'} />
        <InfoRow icon="card-outline" label="Roll Number" value={rollNumber ?? '—'} />
        <InfoRow icon="person-circle-outline" label="System Role" value={role ?? '—'} isLast />
      </View>

      {/* Class Info */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Class Information</Text>
        </View>
        <InfoRow icon="business-outline" label="Department" value={branch ?? '—'} />
        <InfoRow icon="calendar-outline" label="Academic Year" value={year ? `Year ${year}` : '—'} />
        <InfoRow icon="layers-outline" label="Semester" value={semester ? `Semester ${semester}` : '—'} />
        <InfoRow icon="grid-outline" label="Section" value={section ? `Section ${section}` : '—'} isLast />
      </View>

      {/* CSV Export */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="document-text-outline" size={17} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Attendance CSV Export</Text>
          </View>
        </View>
        <Text style={styles.csvHint}>
          Export verified attendance records for active and past semesters in spreadsheet format (.csv).
        </Text>

        {labelsLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 18 }} />
        ) : semesterLabels.length === 0 ? (
          <View style={styles.emptyCsvBox}>
            <Ionicons name="cloud-download-outline" size={28} color={COLORS.textMuted} />
            <Text style={styles.csvEmpty}>
              No attendance records archived yet. Records will show up as sessions are saved.
            </Text>
          </View>
        ) : (
          semesterLabels.map((label) => {
            const isCurrent = label === currentLabel
            const busy = csvLoading === label
            return (
              <View key={label} style={styles.csvRow}>
                <View style={styles.csvRowLeft}>
                  <Text style={styles.csvRowLabel}>{label}</Text>
                  <View style={[styles.csvPill, isCurrent ? styles.csvPillCurrent : styles.csvPillArchived]}>
                    <Text style={[styles.csvPillText, isCurrent ? styles.csvPillTextCurrent : styles.csvPillTextArchived]}>
                      {isCurrent ? 'Current' : 'Archived'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.csvBtn, busy && { opacity: 0.6 }]}
                  onPress={() => handleDownloadCsv(label)}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={14} color="#fff" />
                      <Text style={styles.csvBtnText}>Download</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )
          })
        )}
        {/* End Semester Action Button for CR / LR */}
        <View style={styles.endSemBox}>
          <View style={styles.endSemTextWrap}>
            <Text style={styles.endSemTitle}>Conclude Semester</Text>
            <Text style={styles.endSemSub}>
              Compile and export all attendance sessions for {currentLabel ?? 'this semester'} into a final CSV report.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.endSemBtn, endingSemester && { opacity: 0.6 }]}
            onPress={handleEndSemester}
            disabled={endingSemester}
            activeOpacity={0.85}
          >
            {endingSemester ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.endSemBtnInner}>
                <Ionicons name="document-text-outline" size={15} color="#fff" />
                <Text style={styles.endSemBtnText}>End Semester & Export CSV</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Attendance Preferences & Theme */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Preferences & Appearance</Text>
        </View>
        <View style={styles.prefRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefLabel}>Display Student Names</Text>
            <Text style={styles.prefSub}>
              {showNames
                ? 'Names are visible below roll digits on attendance cards'
                : 'Only compact roll digits are shown for high-density marking'}
            </Text>
          </View>

          {prefsLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Switch
              value={showNames}
              onValueChange={handleToggleNames}
              trackColor={{
                false: COLORS.border,
                true: COLORS.primaryLight,
              }}
              thumbColor={showNames ? COLORS.primary : COLORS.textMuted}
            />
          )}
        </View>

        {/* Dark Mode Toggle */}
        <View style={[styles.prefRow, styles.prefRowBorderTop]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={darkMode ? "moon" : "sunny-outline"} size={16} color={COLORS.primary} />
              <Text style={styles.prefLabel}>Dark Mode (Preview)</Text>
            </View>
            <Text style={styles.prefSub}>
              {darkMode ? 'Dark contrast theme active' : 'Clean light theme active'}
            </Text>
          </View>

          <Switch
            value={darkMode}
            onValueChange={(val) => setDarkMode(val)}
            trackColor={{
              false: COLORS.border,
              true: COLORS.primaryLight,
            }}
            thumbColor={darkMode ? COLORS.primary : COLORS.textMuted}
          />
        </View>
      </View>

      {/* Guide, Support & Feedback */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.supportRow}
          onPress={() => setGuideVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.supportLeft}>
            <View style={[styles.supportIconWrap, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons
                name="sparkles-outline"
                size={20}
                color={COLORS.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>App Guide & Walkthrough</Text>
              <Text style={styles.supportSub}>
                Quick tour of subjects, attendance marking & CSV export
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>

        <View style={{ height: 1, backgroundColor: COLORS.borderLight, marginVertical: 12 }} />

        <TouchableOpacity
          style={styles.supportRow}
          onPress={() => navigation.navigate('SupportSuggestions')}
          activeOpacity={0.85}
        >
          <View style={styles.supportLeft}>
            <View style={styles.supportIconWrap}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color={COLORS.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Support & Suggestions</Text>
              <Text style={styles.supportSub}>
                Have an issue or idea? Contact technical support
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity
        style={[styles.signOutBtn, signingOut && { opacity: 0.6 }]}
        onPress={handleSignOut}
        disabled={signingOut}
        activeOpacity={0.85}
      >
        {signingOut ? (
          <ActivityIndicator color={COLORS.absent} />
        ) : (
          <View style={styles.signOutInner}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.absent} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </View>
        )}
      </TouchableOpacity>

      <VyndraFooter showLogo style={{ marginTop: 24 }} />
      <View style={{ height: 36 }} />

      <WelcomeGuideModal
        visible={guideVisible}
        onClose={() => setGuideVisible(false)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameEditWrap: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  nameInput: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
  },
  nameActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  nameCancelBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  nameCancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  nameSaveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  nameSaveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  subBadge: {
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  infoRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '700',
    maxWidth: '55%',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  prefLabel: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  prefSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  csvHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyCsvBox: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  csvEmpty: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  csvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  csvRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  csvRowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  csvPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  csvPillCurrent: {
    backgroundColor: COLORS.primary + '18',
  },
  csvPillArchived: {
    backgroundColor: COLORS.borderLight,
  },
  csvPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  csvPillTextCurrent: {
    color: COLORS.primary,
  },
  csvPillTextArchived: {
    color: COLORS.textMuted,
  },
  csvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  csvBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  endSemBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: 12,
  },
  endSemTextWrap: {
    gap: 4,
  },
  endSemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  endSemSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  endSemBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  endSemBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  endSemBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  prefRowBorderTop: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 14,
    marginTop: 14,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  supportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  supportIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  supportSub: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  signOutBtn: {
    backgroundColor: COLORS.absent + '10',
    borderWidth: 1.5,
    borderColor: COLORS.absent + '40',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signOutText: {
    color: COLORS.absent,
    fontSize: 15,
    fontWeight: '800',
  },
})
