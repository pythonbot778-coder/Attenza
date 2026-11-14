// src/components/CustomDialog.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import {
  DialogButton,
  DialogButtonStyle,
  DialogStatus,
  hideDialog,
  useDialogStore,
} from '../store/dialogStore'

const STATUS_CONFIG: Record<
  DialogStatus,
  {
    icon: keyof typeof Ionicons.glyphMap
    color: string
    bgColor: string
    borderColor: string
  }
> = {
  success: {
    icon: 'checkmark-circle',
    color: COLORS.success,
    bgColor: COLORS.presentLight,
    borderColor: COLORS.success + '33',
  },
  warning: {
    icon: 'warning',
    color: COLORS.warning,
    bgColor: '#FEF3C7',
    borderColor: COLORS.warning + '33',
  },
  error: {
    icon: 'alert-circle',
    color: COLORS.error,
    bgColor: COLORS.absentLight,
    borderColor: COLORS.error + '33',
  },
  info: {
    icon: 'information-circle',
    color: COLORS.info,
    bgColor: '#DBEAFE',
    borderColor: COLORS.info + '33',
  },
  confirm: {
    icon: 'help-circle',
    color: COLORS.primary,
    bgColor: '#EEF2FF',
    borderColor: COLORS.primary + '33',
  },
}

export const CustomDialog: React.FC = () => {
  const { dialog, isOpen } = useDialogStore()
  const [isRendered, setIsRendered] = useState(false)
  const [loadingBtnText, setLoadingBtnText] = useState<string | null>(null)

  const backdropOpacity = useRef(new Animated.Value(0)).current
  const modalScale = useRef(new Animated.Value(0.92)).current
  const modalOpacity = useRef(new Animated.Value(0)).current
  const sheetTranslateY = useRef(new Animated.Value(450)).current

  const isActionSheet = dialog?.mode === 'action-sheet'

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true)

      if (isActionSheet) {
        backdropOpacity.setValue(0)
        sheetTranslateY.setValue(450)

        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(sheetTranslateY, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start()
      } else {
        backdropOpacity.setValue(0)
        modalScale.setValue(0.92)
        modalOpacity.setValue(0)

        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(modalOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(modalScale, {
            toValue: 1,
            friction: 8,
            tension: 70,
            useNativeDriver: true,
          }),
        ]).start()
      }
    } else if (isRendered) {
      if (isActionSheet) {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(sheetTranslateY, {
            toValue: 450,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsRendered(false)
          setLoadingBtnText(null)
        })
      } else {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }),
          Animated.timing(modalOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(modalScale, {
            toValue: 0.94,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsRendered(false)
          setLoadingBtnText(null)
        })
      }
    }
  }, [isOpen, isActionSheet])

  if (!isRendered && !isOpen) return null

  const handleDismiss = () => {
    if (dialog?.dismissable !== false) {
      dialog?.onDismiss?.()
      hideDialog()
    }
  }

  const handleButtonPress = async (button: DialogButton) => {
    if (loadingBtnText !== null) return // debounce if another button is running

    if (button.onPress) {
      try {
        setLoadingBtnText(button.text)
        await button.onPress()
      } catch (err) {
        console.error('[CustomDialog] Button action failed:', err)
      } finally {
        setLoadingBtnText(null)
      }
    }

    if (button.autoClose !== false) {
      hideDialog()
    }
  }

  const statusConfig = dialog?.status ? STATUS_CONFIG[dialog.status] : null

  // Ensure default buttons if none specified
  const rawButtons: DialogButton[] =
    dialog?.buttons && dialog.buttons.length > 0
      ? dialog.buttons
      : [{ text: 'OK', style: 'primary' }]

  const getButtonStyleInfo = (style?: DialogButtonStyle) => {
    switch (style) {
      case 'cancel':
        return {
          btnStyle: styles.btnCancel,
          textStyle: styles.btnCancelText,
          indicatorColor: COLORS.textSecondary,
        }
      case 'destructive':
      case 'danger':
        return {
          btnStyle: styles.btnDestructive,
          textStyle: styles.btnDestructiveText,
          indicatorColor: '#FFFFFF',
        }
      case 'secondary':
        return {
          btnStyle: styles.btnSecondary,
          textStyle: styles.btnSecondaryText,
          indicatorColor: COLORS.primary,
        }
      case 'outline':
        return {
          btnStyle: styles.btnOutline,
          textStyle: styles.btnOutlineText,
          indicatorColor: COLORS.primary,
        }
      case 'primary':
      case 'default':
      default:
        return {
          btnStyle: styles.btnPrimary,
          textStyle: styles.btnPrimaryText,
          indicatorColor: COLORS.textOnPrimary,
        }
    }
  }

  // -------------------------------------------------------------
  // Render Bottom Action Sheet
  // -------------------------------------------------------------
  if (isActionSheet) {
    const cancelButtons = rawButtons.filter(
      (b) => (b.style || b.variant) === 'cancel'
    )
    const actionButtons = rawButtons.filter(
      (b) => (b.style || b.variant) !== 'cancel'
    )

    return (
      <Modal
        visible={isRendered}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleDismiss}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetOverlay}
        >
          {/* Backdrop */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleDismiss}
          >
            <Animated.View
              style={[
                styles.backdrop,
                { opacity: backdropOpacity },
              ]}
            />
          </Pressable>

          {/* Action Sheet Card */}
          <Animated.View
            style={[
              styles.sheetCard,
              {
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            {/* Grab Handle Pill */}
            <View style={styles.sheetHandle} />

            {/* Header info */}
            {(dialog?.title || dialog?.message || statusConfig) && (
              <View style={styles.sheetHeader}>
                {statusConfig && (
                  <View
                    style={[
                      styles.sheetIconCircle,
                      {
                        backgroundColor: statusConfig.bgColor,
                        borderColor: statusConfig.borderColor,
                      },
                    ]}
                  >
                    <Ionicons
                      name={statusConfig.icon}
                      size={24}
                      color={statusConfig.color}
                    />
                  </View>
                )}
                {dialog?.title ? (
                  <Text style={styles.sheetTitle}>{dialog.title}</Text>
                ) : null}
                {dialog?.message ? (
                  <Text style={styles.sheetMessage}>{dialog.message}</Text>
                ) : null}
              </View>
            )}

            {/* Custom Content */}
            {dialog?.customContent && (
              <View style={styles.customContentContainer}>
                {dialog.customContent}
              </View>
            )}

            {/* Action Buttons List */}
            <View style={styles.sheetButtonContainer}>
              {actionButtons.map((btn, index) => {
                const styleType = btn.style || btn.variant || 'default'
                const isDestructive =
                  styleType === 'destructive' || styleType === 'danger'
                const isPrimary = styleType === 'primary'
                const isLoading =
                  btn.loading || loadingBtnText === btn.text

                return (
                  <TouchableOpacity
                    key={`${btn.text}-${index}`}
                    style={[
                      styles.sheetActionButton,
                      isPrimary && styles.sheetActionButtonPrimary,
                      index > 0 && styles.sheetButtonMarginTop,
                    ]}
                    activeOpacity={0.75}
                    disabled={loadingBtnText !== null}
                    onPress={() => handleButtonPress(btn)}
                  >
                    {isLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          isPrimary
                            ? COLORS.textOnPrimary
                            : isDestructive
                            ? COLORS.error
                            : COLORS.primary
                        }
                      />
                    ) : (
                      <Text
                        style={[
                          styles.sheetActionButtonText,
                          isPrimary && styles.sheetActionButtonTextPrimary,
                          isDestructive && styles.sheetActionButtonTextDestructive,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    )}
                  </TouchableOpacity>
                )
              })}

              {/* Explicit or Standard Cancel Button */}
              {cancelButtons.map((btn, index) => {
                const isLoading =
                  btn.loading || loadingBtnText === btn.text

                return (
                  <TouchableOpacity
                    key={`cancel-${index}`}
                    style={[styles.sheetCancelButton, styles.sheetCancelMarginTop]}
                    activeOpacity={0.75}
                    disabled={loadingBtnText !== null}
                    onPress={() => handleButtonPress(btn)}
                  >
                    {isLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.textSecondary}
                      />
                    ) : (
                      <Text style={styles.sheetCancelButtonText}>
                        {btn.text}
                      </Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    )
  }

  // -------------------------------------------------------------
  // Render Centered Floating Brand Modal
  // -------------------------------------------------------------
  // If 2 buttons and one is cancel, sort cancel to left, primary to right
  let modalButtons = [...rawButtons]
  if (modalButtons.length === 2) {
    const hasCancelFirst =
      (modalButtons[0].style || modalButtons[0].variant) === 'cancel'
    const hasCancelSecond =
      (modalButtons[1].style || modalButtons[1].variant) === 'cancel'

    if (!hasCancelFirst && hasCancelSecond) {
      modalButtons = [modalButtons[1], modalButtons[0]]
    }
  }

  const isTwoButtons = modalButtons.length === 2

  return (
    <Modal
      visible={isRendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        {/* Backdrop */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
        >
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropOpacity },
            ]}
          />
        </Pressable>

        {/* Floating Brand Modal Card */}
        <Animated.View
          style={[
            styles.modalCard,
            {
              opacity: modalOpacity,
              transform: [{ scale: modalScale }],
            },
          ]}
        >
          {/* Optional Top Right Close Button */}
          {dialog?.showCloseButton && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Status Icon */}
          {statusConfig && (
            <View
              style={[
                styles.modalIconCircle,
                {
                  backgroundColor: statusConfig.bgColor,
                  borderColor: statusConfig.borderColor,
                },
              ]}
            >
              <Ionicons
                name={statusConfig.icon}
                size={32}
                color={statusConfig.color}
              />
            </View>
          )}

          {/* Title */}
          {dialog?.title ? (
            <Text style={styles.modalTitle}>{dialog.title}</Text>
          ) : null}

          {/* Message */}
          {dialog?.message ? (
            <Text style={styles.modalMessage}>{dialog.message}</Text>
          ) : null}

          {/* Custom Content */}
          {dialog?.customContent && (
            <View style={styles.customContentContainer}>
              {dialog.customContent}
            </View>
          )}

          {/* Action Buttons */}
          <View
            style={[
              styles.modalButtonContainer,
              isTwoButtons ? styles.buttonRow : styles.buttonColumn,
            ]}
          >
            {modalButtons.map((btn, index) => {
              const { btnStyle, textStyle, indicatorColor } = getButtonStyleInfo(
                btn.style || btn.variant
              )
              const isLoading =
                btn.loading || loadingBtnText === btn.text

              return (
                <TouchableOpacity
                  key={`${btn.text}-${index}`}
                  style={[
                    styles.modalButtonBase,
                    btnStyle,
                    isTwoButtons && styles.buttonFlex,
                    !isTwoButtons && index > 0 && styles.buttonColumnMarginTop,
                  ]}
                  activeOpacity={0.8}
                  disabled={loadingBtnText !== null}
                  onPress={() => handleButtonPress(btn)}
                >
                  {isLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={indicatorColor}
                    />
                  ) : (
                    <Text style={[styles.modalButtonTextBase, textStyle]}>
                      {btn.text}
                    </Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.62)', // refined slate backdrop
  },

  // ---------------- Modal Styles ----------------
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    // Modern polished shadows
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: {
        elevation: 14,
      },
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  customContentContainer: {
    width: '100%',
    marginBottom: 18,
  },
  modalButtonContainer: {
    width: '100%',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonColumn: {
    flexDirection: 'column',
  },
  buttonColumnMarginTop: {
    marginTop: 10,
  },
  buttonFlex: {
    flex: 1,
  },
  modalButtonBase: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalButtonTextBase: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  // Button variants
  btnPrimary: {
    backgroundColor: COLORS.primary,
  },
  btnPrimaryText: {
    color: COLORS.textOnPrimary,
  },
  btnCancel: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  btnCancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  btnDestructive: {
    backgroundColor: COLORS.error,
  },
  btnDestructiveText: {
    color: '#FFFFFF',
  },
  btnSecondary: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: COLORS.primaryLight + '50',
  },
  btnSecondaryText: {
    color: COLORS.primary,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  btnOutlineText: {
    color: COLORS.primary,
  },

  // ---------------- Action Sheet Styles ----------------
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderBottomWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: {
        elevation: 18,
      },
    }),
  },
  sheetHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  sheetIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  sheetMessage: {
    fontSize: 13.5,
    lineHeight: 19,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  sheetButtonContainer: {
    width: '100%',
  },
  sheetActionButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sheetActionButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  sheetButtonMarginTop: {
    marginTop: 10,
  },
  sheetActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sheetActionButtonTextPrimary: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
  sheetActionButtonTextDestructive: {
    color: COLORS.error,
    fontWeight: '700',
  },
  sheetCancelButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sheetCancelMarginTop: {
    marginTop: 12,
  },
  sheetCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
})
